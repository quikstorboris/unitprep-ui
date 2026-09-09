import { type ConfigSource, type SettingsResult, trySettingsFetch } from "@/lib/integrationSettings";

export type { SettingsResult };

/**
 * Settings for the Dropbox integration -- the app-wide credentials
 * `unitprep-api`'s `dropbox::DropboxConfig` uses, previously exclusively
 * `DROPBOX_*` env vars, now `client_ops.dropbox_configuration` first,
 * falling back to those same env vars until an admin saves a value here
 * (see `source` below). Own module, same reasoning
 * `lib/processStreetSettings.ts`'s own doc comment gives for keeping
 * integration config separate from client data.
 */

/** Mirrors `DropboxSettingsResponse` in `unitprep-api`'s
 * `dropbox_settings.rs`. Carries real, current values (masked/revealed
 * client-side, see `DropboxIntegrationPage`) -- `source` says whether
 * they came from a saved row or are the live `DROPBOX_*` env var
 * fallback. */
export interface DropboxSettings {
  app_key: string;
  app_secret: string;
  refresh_token: string;
  root_namespace_id: string;
  root_path: string;
  source: ConfigSource;
  updated_at: string;
  updated_by: string | null;
}

export async function getDropboxSettings(): Promise<SettingsResult<DropboxSettings>> {
  return trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");
}

export async function updateDropboxSettings(input: {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  rootNamespaceId: string;
  rootPath: string;
}): Promise<SettingsResult<DropboxSettings>> {
  return trySettingsFetch(
    "/integrations/dropbox/settings",
    {
      app_key: input.appKey,
      app_secret: input.appSecret,
      refresh_token: input.refreshToken,
      root_namespace_id: input.rootNamespaceId,
      root_path: input.rootPath,
    },
    "PUT"
  );
}
