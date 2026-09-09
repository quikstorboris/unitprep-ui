"use client";

import { useEffect, useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { SecretField } from "@/components/integrations/SecretField";
import {
  getDropboxSettings,
  updateDropboxSettings,
  type DropboxSettings,
} from "@/lib/dropboxSettings";
import { useSaveStatus } from "@/lib/useSaveStatus";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";

type FormState = {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  rootNamespaceId: string;
  rootPath: string;
};

function formFromSettings(settings: DropboxSettings): FormState {
  return {
    appKey: settings.app_key,
    appSecret: settings.app_secret,
    refreshToken: settings.refresh_token,
    rootNamespaceId: settings.root_namespace_id,
    rootPath: settings.root_path,
  };
}

/**
 * Admin-only settings for the Dropbox integration -- the app-wide
 * credentials `dropbox::DropboxConfig` loads, previously exclusively
 * from `DROPBOX_*` env vars (see `unitprep-api`'s `dropbox::config`
 * module doc). A saved change here takes effect on the API's next
 * restart, not live -- there is no background loop re-reading this the
 * way Process Street's sync interval is re-read every cycle.
 *
 * The form is pre-filled with the real, currently-effective values
 * (masked, revealable, copyable via `SecretField`) -- pulled from the
 * saved database row if one exists, otherwise from the server's own
 * `DROPBOX_*` environment variables (see `source` below), so this page
 * always shows what Dropbox access is actually running on rather than a
 * blank form the first time it's opened.
 */
export default function DropboxIntegrationPage() {
  const [settings, setSettings] = useState<DropboxSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { saving, saved, saveError, runSave, clearSaved } = useSaveStatus<DropboxSettings>();

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getDropboxSettings();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setSettings(result.data);
      setForm(formFromSettings(result.data));
    });
  }, []);

  function updateField(field: keyof FormState, value: string) {
    clearSaved();
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  const invalid =
    form === null ||
    form.appKey.trim().length === 0 ||
    form.appSecret.length === 0 ||
    form.refreshToken.length === 0 ||
    form.rootNamespaceId.trim().length === 0 ||
    form.rootPath.trim().length === 0;

  async function handleSave() {
    if (form === null) return;

    const saved = await runSave(() =>
      updateDropboxSettings({
        appKey: form.appKey,
        appSecret: form.appSecret,
        refreshToken: form.refreshToken,
        rootNamespaceId: form.rootNamespaceId,
        rootPath: form.rootPath,
      })
    );
    if (!saved) return;

    setSettings(saved);
    setForm(formFromSettings(saved));
  }

  return (
    <RequirePermission permission="integrations.manage">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">DropBox</h1>
          <p className="mt-1 text-sm text-slate-400">
            Credentials for the single Dropbox Business account this app authorizes as. Takes
            effect the next time the API server starts.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {form === null && !loadError ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : form === null ? null : (
          <div className="max-w-lg rounded border border-slate-800 bg-slate-900 p-4">
            {settings?.source === "environment" && (
              <p className="mb-3 rounded border border-amber-900 bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
                Nothing saved here yet -- showing the values currently configured via environment
                variables. Save to move configuration into the database.
              </p>
            )}

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-300">App key</span>
                <input
                  value={form.appKey}
                  onChange={(event) => updateField("appKey", event.target.value)}
                  className={inputClass}
                />
              </label>

              <SecretField
                label="App secret"
                value={form.appSecret}
                onChange={(value) => updateField("appSecret", value)}
              />

              <SecretField
                label="Refresh token"
                value={form.refreshToken}
                onChange={(value) => updateField("refreshToken", value)}
              />

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-300">Root namespace ID</span>
                <input
                  value={form.rootNamespaceId}
                  onChange={(event) => updateField("rootNamespaceId", event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-300">Root path</span>
                <input
                  value={form.rootPath}
                  onChange={(event) => updateField("rootPath", event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            {saveError && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {saveError}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving || invalid}
                onClick={handleSave}
                className={primaryButtonClass}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && <span className="text-sm text-green-400">Saved.</span>}
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
