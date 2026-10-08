import { apiRequest, type ApiResult } from "@/lib/http";

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

/** The shared `ApiResult` under this domain's own name. */
export type SettingsResult<T> = ApiResult<T>;

/** Mirrors `dropbox_settings.rs`/`process_street_settings.rs`'s `ConfigSource` --
 * whether a value came from a saved database row or is falling back to
 * the server's own environment variable (see `unitprep-api`'s
 * `integrations::env_source`). */
export type ConfigSource = "database" | "environment";

export async function trySettingsFetch<T>(
  path: string,
  body: unknown,
  method: HttpMethod
): Promise<SettingsResult<T>> {
  return apiRequest<T>(method, path, body);
}
