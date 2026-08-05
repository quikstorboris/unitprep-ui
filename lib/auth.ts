import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";

/**
 * Every `/auth/*` fetch needs `credentials: "include"` (the session/
 * ceremony cookies are on the API's own origin, not this app's) and a
 * JSON content type -- centralised here so a call site can't forget
 * either, the same reasoning `useSessionPost`/`useSessionAction` already
 * apply to the tool endpoints.
 */
async function authFetch(
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST"
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Structured result every function below returns, mirroring
 * `useSessionAction`'s `SessionActionResult` shape/reasoning: a caller
 * needs the outcome as a return value it can act on immediately, not a
 * state update that isn't visible until the next render.
 *
 * `unauthorized` carries the backend's own `message` rather than a bare
 * marker -- the Rust side deliberately crafts these to be exactly as
 * vague as anti-enumeration requires ("Could not sign in with that
 * address.", never "no such user" vs. "wrong passkey"). Re-wording that
 * in the frontend would mean the same fact -- what's safe to tell an
 * anonymous caller -- living in two places that could drift out of
 * agreement; reading the message the server already wrote keeps it in
 * one.
 */
export type AuthResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

async function parseAuthResult<T>(
  response: Response
): Promise<AuthResult<T>> {
  if (response.status === 401) {
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

async function tryAuthFetch<T>(
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST"
): Promise<AuthResult<T>> {
  try {
    return await parseAuthResult<T>(await authFetch(path, body, method));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** Mirrors unitprep-api's `Role` enum. `onboarding_manager` is schema-only
 * on the backend today -- nothing can grant it yet -- but the type exists
 * here so `WhoAmI`/`UserSummary` stop being a bare `string` for `role`. */
export type Role = "admin" | "onboarding_manager";

export interface WhoAmI {
  user_id: string;
  role: Role;
  totp_enrolled: boolean;
}

/**
 * Restores session state on load (or after a hard refresh) -- there is
 * no session data cached client-side to trust, so this is the only way
 * to know who, if anyone, is signed in. `unauthorized` here is the
 * ordinary "nobody is signed in" case, not a failure.
 */
export async function whoAmI(): Promise<AuthResult<WhoAmI>> {
  try {
    const response = await fetch(`${API_URL}/health/whoami`, {
      credentials: "include",
    });
    return await parseAuthResult<WhoAmI>(response);
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/**
 * Browser-native conversion between the JSON `webauthn-rs` sends/expects
 * and the real `ArrayBuffer`-bearing objects `navigator.credentials`
 * needs -- `PublicKeyCredential.parseCreationOptionsFromJSON` /
 * `.parseRequestOptionsFromJSON` (decoding challenge/id fields) and
 * `credential.toJSON()` (re-encoding the result) are WebAuthn Level 3,
 * standardised and implemented in current Chromium/Edge/Safari. Using
 * them instead of hand-rolling base64url<->ArrayBuffer conversion
 * removes an entire, notoriously bug-prone category of mistake (regular
 * base64 vs. base64url, padding, byte-order) in exchange for requiring a
 * reasonably current browser -- an acceptable trade for an internal tool
 * already tested only against Chrome/Edge-based authenticator flows
 * (Windows Hello, Proton Pass).
 */
function webauthnCreateSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.PublicKeyCredential.parseCreationOptionsFromJSON ===
      "function"
  );
}

function webauthnGetSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof window.PublicKeyCredential.parseRequestOptionsFromJSON ===
      "function"
  );
}

export const UNSUPPORTED_BROWSER_MESSAGE =
  "This browser doesn't support passkeys the way this app needs. Try a current version of Chrome, Edge, or Safari.";

interface ChallengeResponse {
  challenge: {
    publicKey: unknown;
  };
}

/**
 * The invite-redemption / add-a-passkey ceremony. `inviteToken` is
 * omitted entirely for an already-signed-in caller adding a second
 * passkey -- the backend resolves the target from the session in that
 * case and would ignore a token anyway (see auth_register.rs).
 */
export async function registerPasskey(
  inviteToken?: string,
  nickname?: string
): Promise<AuthResult<{ sessionIssued: boolean }>> {
  if (!webauthnCreateSupported()) {
    return { kind: "error", message: UNSUPPORTED_BROWSER_MESSAGE };
  }

  const begin = await tryAuthFetch<ChallengeResponse>(
    "/auth/register/begin",
    inviteToken ? { invite_token: inviteToken } : {}
  );

  if (begin.kind !== "ok") return begin;

  const creationOptions = PublicKeyCredential.parseCreationOptionsFromJSON(
    begin.data.challenge.publicKey as Parameters<
      typeof PublicKeyCredential.parseCreationOptionsFromJSON
    >[0]
  );

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({
      publicKey: creationOptions,
    });
  } catch (err) {
    // A cancelled prompt, a timeout, or an authenticator that refused --
    // all ordinary outcomes from the user's point of view, not a bug.
    return {
      kind: "error",
      message:
        err instanceof Error
          ? err.message
          : "The passkey could not be created.",
    };
  }

  if (!credential || !("toJSON" in credential)) {
    return { kind: "error", message: "No passkey was created." };
  }

  const finish = await tryAuthFetch<{
    success: boolean;
    session_issued: boolean;
  }>("/auth/register/finish", {
    credential: (
      credential as PublicKeyCredential & { toJSON(): unknown }
    ).toJSON(),
    nickname,
  });

  if (finish.kind !== "ok") return finish;

  return {
    kind: "ok",
    data: { sessionIssued: finish.data.session_issued },
  };
}

export async function loginBegin(
  email: string
): Promise<AuthResult<ChallengeResponse>> {
  return tryAuthFetch<ChallengeResponse>("/auth/login/begin", { email });
}

/**
 * The second half of passkey login. Split from a single "loginWithPasskey"
 * function so a caller can show the email step and the "waiting for your
 * authenticator" step as distinct UI states -- `begin` and `finish` are
 * two real network round trips with a browser prompt in between them,
 * not one atomic action.
 */
export async function loginFinish(
  challenge: ChallengeResponse
): Promise<AuthResult<{ success: boolean }>> {
  if (!webauthnGetSupported()) {
    return { kind: "error", message: UNSUPPORTED_BROWSER_MESSAGE };
  }

  const requestOptions = PublicKeyCredential.parseRequestOptionsFromJSON(
    challenge.challenge.publicKey as Parameters<
      typeof PublicKeyCredential.parseRequestOptionsFromJSON
    >[0]
  );

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({
      publicKey: requestOptions,
    });
  } catch (err) {
    return {
      kind: "error",
      message:
        err instanceof Error
          ? err.message
          : "The passkey could not be verified.",
    };
  }

  if (!credential || !("toJSON" in credential)) {
    return { kind: "error", message: "No passkey response was produced." };
  }

  return tryAuthFetch<{ success: boolean }>("/auth/login/finish", {
    credential: (
      credential as PublicKeyCredential & { toJSON(): unknown }
    ).toJSON(),
  });
}

export interface TotpEnrollment {
  provisioning_uri: string;
  secret: string;
}

export async function totpEnrollBegin(): Promise<
  AuthResult<TotpEnrollment>
> {
  return tryAuthFetch<TotpEnrollment>("/auth/totp/enroll/begin");
}

export async function totpEnrollConfirm(
  code: string
): Promise<AuthResult<{ confirmed: boolean }>> {
  return tryAuthFetch<{ confirmed: boolean }>("/auth/totp/enroll/confirm", {
    code,
  });
}

/**
 * Step-up verification for an already-signed-in session -- NOT a way to
 * log in. TOTP no longer has a login role at all (see unitprep-api's
 * auth_totp.rs module docs for why); this elevates the caller's own
 * session for a few minutes so a sensitive action (replacing a passkey)
 * can proceed. `totp_enrolled` on `WhoAmI` tells a caller whether this
 * will even succeed before they try.
 */
export async function totpStepUp(
  code: string
): Promise<AuthResult<{ confirmed: boolean }>> {
  return tryAuthFetch<{ confirmed: boolean }>("/auth/totp/step-up", {
    code,
  });
}

export async function logout(): Promise<
  AuthResult<{ success: boolean; revoked_count: number }>
> {
  return tryAuthFetch("/auth/logout");
}

export async function logoutEverywhere(): Promise<
  AuthResult<{ success: boolean; revoked_count: number }>
> {
  return tryAuthFetch("/auth/logout/everywhere");
}

export interface UserSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title: string | null;
  role: Role;
  status: string;
  created_at: string;
  credential_count: number;
  totp_enrolled: boolean;
  /** Most recent activity across every session this user has ever had,
   * or `null` if they've never had one (still `invited`). Backs the
   * admin Users table's dormant-account indicator. */
  last_seen_at: string | null;
}

export async function listUsers(): Promise<
  AuthResult<{ users: UserSummary[] }>
> {
  return tryAuthFetch("/auth/users", undefined, "GET");
}

/** Mirrors `VALID_COMPANIES` in unitprep-api's bootstrap.rs -- the two
 * cannot disagree about what a company is without one of them being
 * silently wrong. */
export const VALID_COMPANIES = ["trojan", "cobre", "quikstor"] as const;

/** Mirrors `Role::from_db_text`'s accepted values in unitprep-api. Order
 * here is display order in both role dropdowns. */
export const VALID_ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "onboarding_manager", label: "Onboarding Manager" },
];

export interface CreateInviteRequest {
  email: string;
  first_name: string;
  last_name: string;
  company: (typeof VALID_COMPANIES)[number];
  job_title?: string;
  role: Role;
}

export interface InviteIssued {
  user_id: string;
  invite_token: string;
  expires_at: string;
  reissued: boolean;
}

/** Same endpoint creates a brand-new user or reissues for an existing
 * `invited`, zero-credential one -- the backend decides which from the
 * email alone. */
export async function createInvite(
  request: CreateInviteRequest
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>("/auth/invites", request);
}

/** Revokes every existing access path on the target account (passkeys,
 * TOTP, live sessions, any outstanding invite) and issues a fresh one --
 * for an account that has lost its only passkey. Only valid for a
 * currently `active` account. */
export async function recoverAccount(
  email: string
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>("/auth/invites/recover", { email });
}

/** The standalone disable-user action -- distinct from `recoverAccount`,
 * which also passes an account through `deactivated` but only as one step
 * of reissuing a lost credential. This is an admin deciding someone should
 * lose access, with nothing reissued afterward. */
export async function disableUser(
  userId: string
): Promise<AuthResult<{ user_id: string; status: string }>> {
  return tryAuthFetch(`/auth/users/${userId}/deactivate`, undefined, "POST");
}

/** The counterpart to `disableUser`, only valid for a currently
 * `deactivated` account. A deactivated account already had every
 * credential wiped at deactivation time, so this can't simply flip status
 * back to `active` -- it goes to `invited` with a fresh invite instead,
 * same destination `recoverAccount` uses and for the same reason. */
export async function reactivateUser(
  userId: string
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>(
    `/auth/users/${userId}/reactivate`,
    undefined,
    "POST"
  );
}

/** Changes an already-enrolled user's role -- distinct from picking a
 * role at invite-creation time (`createInvite`'s `role` field), which
 * only applies to a brand-new or not-yet-enrolled account. */
export async function changeUserRole(
  userId: string,
  role: Role
): Promise<AuthResult<{ user_id: string; role: Role }>> {
  return tryAuthFetch(`/auth/users/${userId}/role`, { role }, "POST");
}

export interface AuditLogEntry {
  id: number;
  event_type: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  limit?: number;
  /** Keyset pagination: only entries older than (lower id than) this one --
   * pass the last entry's `id` from the previous page to fetch the next. */
  beforeId?: number;
  eventType?: string;
  userId?: string;
}

export async function listAuditLogs(
  filters: AuditLogFilters = {}
): Promise<AuthResult<{ entries: AuditLogEntry[] }>> {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.beforeId !== undefined) {
    params.set("before_id", String(filters.beforeId));
  }
  if (filters.eventType) params.set("event_type", filters.eventType);
  if (filters.userId) params.set("user_id", filters.userId);

  const query = params.toString();
  return tryAuthFetch(
    `/auth/audit-logs${query ? `?${query}` : ""}`,
    undefined,
    "GET"
  );
}
