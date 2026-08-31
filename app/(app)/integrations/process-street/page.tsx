"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import {
  getProcessStreetSettings,
  updateProcessStreetSettings,
} from "@/lib/processStreetSettings";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * First page under the "Integrations" nav group -- Process Street
 * today, Dropbox/ClickUp/Claude etc. are follow-ups per the vault's own
 * design note. Deliberately just the one setting for now (Boris's
 * explicit scope, 2026-08-31): when the nightly person-index sync runs.
 * `clients::sync::start_background_sync_task` no longer fires on server
 * startup at all -- only at this configured time, or via the "Sync Now"
 * button on the search page (`/clients/search`).
 */
export default function ProcessStreetIntegrationPage() {
  const [syncTime, setSyncTime] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getProcessStreetSettings();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      // "HH:MM:SS" -> "HH:MM", what <input type="time"> expects/produces.
      setSyncTime(result.data.sync_time.slice(0, 5));
    });
  }, []);

  async function handleSave() {
    if (!syncTime) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const result = await updateProcessStreetSettings(syncTime);
    setSaving(false);

    if (result.kind !== "ok") {
      setSaveError(result.message);
      return;
    }

    setSyncTime(result.data.sync_time.slice(0, 5));
    setSaved(true);
  }

  return (
    <RequirePermission permission="client_ops.perform">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Process Street</h1>
          <p className="mt-1 text-sm text-slate-400">
            Keeps the person-name search index (Owner/Manager/Signer/POC contacts) in sync
            with Process Street.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {!syncTime ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="max-w-lg rounded border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-100">Sync schedule</h2>
            <p className="mb-3 text-sm text-slate-400">
              Runs automatically once a day at this time (UTC), plus whenever &quot;Sync
              Now&quot; is used on the{" "}
              <Link href="/clients/search" className="underline hover:text-slate-200">
                search page
              </Link>
              . A running sync always finishes before the next scheduled one starts.
            </p>

            <div className="flex items-center gap-2">
              <label htmlFor="sync-time" className="text-sm text-slate-300">
                Sync time (UTC)
              </label>
              <input
                id="sync-time"
                type="time"
                value={syncTime}
                onChange={(event) => {
                  setSaved(false);
                  setSyncTime(event.target.value);
                }}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </div>

            {saveError && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {saveError}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
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
