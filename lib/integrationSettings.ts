import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * Shared fetch/parse plumbing for the admin-only Integrations settings
 * pages (Process Street, Dropbox, and whatever follows -- ClickUp/Claude
 * per the vault's own design note). Factored out once a second
 * integration needed the identical GET/PUT-JSON-with-the-same-error-
 * shape pattern `lib/processStreetSettings.ts` originated -- each
 * integration keeps its own typed module (own response/request shapes,
 * own field names), just built on this instead of copy-pasting the
 * fetch wiring a third time.
 */
type HttpMethod = "GET" | "PUT";

export type SettingsResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

/** Mirrors `dropbox_settings.rs`/`process_street_settings.rs`'s `ConfigSource` --
 * whether a value came from a saved database row or is falling back to
 * the server's own environment variable (see `unitprep-api`'s
 * `integrations::env_source`). */
export type ConfigSource = "database" | "environment";

async function settingsFetch(path: string, body: unknown, method: HttpMethod): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

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

export async function trySettingsFetch<T>(
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
