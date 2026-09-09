import { type ConfigSource, type SettingsResult, trySettingsFetch } from "@/lib/integrationSettings";

export type { SettingsResult };

/**
 * Settings for the Process Street integration -- the sync schedule plus
 * (2026-09-09) the integration's own API key, previously
 * `PROCESS_STREET_API_KEY`-env-var-only. Own module rather than folded
 * into `lib/clientsSearch.ts`: that one is the `clients` schema's own
 * domain (search/sync-trigger), this one is
 * `client_ops.process_street_settings` -- config, not client data, same
 * schema-boundary reasoning `lib/clientOps.ts`'s own doc comment already
 * gives for keeping it separate from `lib/auth.ts`.
 */

/** Mirrors `ProcessStreetSettingsResponse` in `unitprep-api`'s
 * `process_street_settings.rs`. `api_key` is the real, current value
 * (masked/revealed client-side) -- `api_key_source` says whether it
 * came from a saved row or is the live `PROCESS_STREET_API_KEY` env var
 * fallback. */
export interface ProcessStreetSettings {
  sync_interval_hours: number;
  api_key: string;
  api_key_source: ConfigSource;
  updated_at: string;
  updated_by: string | null;
}

export async function getProcessStreetSettings(): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch("/integrations/process-street/settings", undefined, "GET");
}

export async function updateProcessStreetSettings(input: {
  syncIntervalHours: number;
  apiKey: string;
}): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch(
    "/integrations/process-street/settings",
    { sync_interval_hours: input.syncIntervalHours, api_key: input.apiKey },
    "PUT"
  );
}
