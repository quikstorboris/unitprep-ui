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

/** `"interval"` | `"daily_time"` -- mirrors `schedule_mode` in
 * `unitprep-api`'s `process_street_settings.rs`. */
export type ScheduleMode = "interval" | "daily_time";

/** The closed set of timezones the "daily_time" schedule mode offers --
 * must match `ALLOWED_TIMEZONES` in `unitprep-api`'s
 * `process_street_settings.rs` exactly, since the backend validates
 * against that same list. Real IANA zone names (not fixed UTC offsets)
 * so Daylight Saving Time is handled automatically. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
  { value: "America/Denver", label: "Mountain (MST/MDT)" },
  { value: "America/Chicago", label: "Central (CST/CDT)" },
  { value: "America/New_York", label: "Eastern (EST/EDT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/Belgrade", label: "Serbia (CET/CEST)" },
];

/** Mirrors `ProcessStreetSettingsResponse` in `unitprep-api`'s
 * `process_street_settings.rs`. `api_key` is the real, current value
 * (masked/revealed client-side) -- `api_key_source` says whether it
 * came from a saved row or is the live `PROCESS_STREET_API_KEY` env var
 * fallback. `sync_time`/`sync_timezone` are only meaningful (non-`null`)
 * when `schedule_mode === "daily_time"`. */
export interface ProcessStreetSettings {
  schedule_mode: ScheduleMode;
  sync_interval_hours: number;
  /** `"HH:MM:SS"` or `null`. */
  sync_time: string | null;
  sync_timezone: string | null;
  api_key: string;
  api_key_source: ConfigSource;
  updated_at: string;
  updated_by: string | null;
}

export async function getProcessStreetSettings(): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch("/integrations/process-street/settings", undefined, "GET");
}

export async function updateProcessStreetSettings(input: {
  scheduleMode: ScheduleMode;
  syncIntervalHours: number;
  /** `"HH:MM"`, required when `scheduleMode === "daily_time"`. */
  syncTime: string | null;
  syncTimezone: string | null;
  apiKey: string;
}): Promise<SettingsResult<ProcessStreetSettings>> {
  return trySettingsFetch(
    "/integrations/process-street/settings",
    {
      schedule_mode: input.scheduleMode,
      sync_interval_hours: input.syncIntervalHours,
      sync_time: input.syncTime,
      sync_timezone: input.syncTimezone,
      api_key: input.apiKey,
    },
    "PUT"
  );
}
