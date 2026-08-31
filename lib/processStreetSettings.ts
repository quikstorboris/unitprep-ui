import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * Settings for the Process Street integration -- currently just the
 * nightly sync schedule, per Boris's explicit scope (only one setting
 * for now). Own module rather than folded into `lib/clientsSearch.ts`:
 * that one is the `clients` schema's own domain (search/sync-trigger),
 * this one is `client_ops.process_street_settings` -- config, not
 * client data, same schema-boundary reasoning `lib/clientOps.ts`'s own
 * doc comment already gives for keeping it separate from `lib/auth.ts`.
 */
type HttpMethod = "GET" | "PUT";

async function settingsFetch(path: string, body: unknown, method: HttpMethod): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export type SettingsResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

async function parseSettingsResult<T>(response: Response): Promise<SettingsResult<T>> {
  if (response.status === 401) {
    notifyUnauthorized();
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

async function trySettingsFetch<T>(
  path: string,
  body: unknown,
  method: HttpMethod
): Promise<SettingsResult<T>> {
  try {
    return await parseSettingsResult<T>(await settingsFetch(path, body, method));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** Mirrors `ProcessStreetSettingsResponse` in `unitprep-api`'s `process_street_settings.rs`. */
export interface ProcessStreetSettings {
  /** `"HH:MM:SS"`, UTC. */
  sync_time: string;
  updated_at: string;
  updated_by: string | null;
}

export async function getProcessStreetSettings(): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch("/integrations/process-street/settings", undefined, "GET");
}

/** `syncTime` as `"HH:MM"` (what `<input type="time">` produces). */
export async function updateProcessStreetSettings(
  syncTime: string
): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch(
    "/integrations/process-street/settings",
    { sync_time: syncTime },
    "PUT"
  );
}
