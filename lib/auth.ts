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
  body?: unknown
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
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
  body?: unknown
): Promise<AuthResult<T>> {
  try {
    return await parseAuthResult<T>(await authFetch(path, body));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

export interface WhoAmI {
  user_id: string;
  role: string;
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

export async function totpDisable(): Promise<
  AuthResult<{ confirmed: boolean }>
> {
  return tryAuthFetch<{ confirmed: boolean }>("/auth/totp/disable");
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
