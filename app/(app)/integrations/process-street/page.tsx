"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import { SecretField } from "@/components/integrations/SecretField";
import {
  getProcessStreetSettings,
  updateProcessStreetSettings,
  type ProcessStreetSettings,
} from "@/lib/processStreetSettings";
import { useSaveStatus } from "@/lib/useSaveStatus";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_HOURS = 168;

type FormState = {
  intervalHours: number;
  apiKey: string;
};

function formFromSettings(settings: ProcessStreetSettings): FormState {
  return { intervalHours: settings.sync_interval_hours, apiKey: settings.api_key };
}

/**
 * First page under the "Integrations" nav group -- Process Street
 * today, Dropbox/ClickUp/Claude etc. are follow-ups per the vault's own
 * design note.
 *
 * **Interval, not a fixed clock time (2026-09-02)** -- replaced the
 * original once-a-day "Sync time (UTC)" setting once it was clear the
 * sync's own delta mechanism (see `clients::sync`'s own module doc)
 * makes a much tighter cadence realistic: a run that hasn't changed in
 * Process Street costs almost nothing beyond one shared list call, so
 * there's no real reason to wait a full day between checks by default.
 * `clients::sync::start_background_sync_task` still never fires on
 * server startup -- only on this interval, or via the "Sync Now" button
 * on the search page (`/clients/search`) or a client's own "Re-sync"
 * button on its detail page.
 *
 * **API key added 2026-09-09** -- the form is pre-filled with the real,
 * currently-effective value (masked, revealable, copyable via
 * `SecretField`), pulled from the saved database row if one exists,
 * otherwise from the server's own `PROCESS_STREET_API_KEY` environment
 * variable (see `api_key_source` below).
 */
export default function ProcessStreetIntegrationPage() {
  const [settings, setSettings] = useState<ProcessStreetSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { saving, saved, saveError, runSave, clearSaved } = useSaveStatus<ProcessStreetSettings>();

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getProcessStreetSettings();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setSettings(result.data);
      setForm(formFromSettings(result.data));
    });
  }, []);

  async function handleSave() {
    if (form === null) return;

    const saved = await runSave(() =>
      updateProcessStreetSettings({
        syncIntervalHours: form.intervalHours,
        apiKey: form.apiKey,
      })
    );
    if (!saved) return;

    setSettings(saved);
    setForm(formFromSettings(saved));
  }

  const invalid =
    form === null ||
    !Number.isInteger(form.intervalHours) ||
    form.intervalHours < MIN_INTERVAL_HOURS ||
    form.intervalHours > MAX_INTERVAL_HOURS ||
    form.apiKey.length === 0;

  return (
    <RequirePermission permission="integrations.manage">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Process Street</h1>
          <p className="mt-1 text-sm text-slate-400">
            Keeps the person-name search index (Owner/Manager/Signer/POC contacts) and every
            imported client&apos;s own fields in sync with Process Street.
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
            {settings?.api_key_source === "environment" && (
              <p className="mb-3 rounded border border-amber-900 bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
                No API key saved here yet -- showing the value currently configured via
                environment variables. Save to move it into the database.
              </p>
            )}

            <h2 className="mb-1 text-sm font-semibold text-slate-100">API key</h2>
            <p className="mb-3 text-sm text-slate-400">
              The org-wide Process Street API key this app authenticates every request with.
            </p>
            <SecretField
              label="API key"
              value={form.apiKey}
              onChange={(value) => {
                clearSaved();
                setForm((current) => (current ? { ...current, apiKey: value } : current));
              }}
            />

            <h2 className="mb-1 mt-6 text-sm font-semibold text-slate-100">Sync schedule</h2>
            <p className="mb-3 text-sm text-slate-400">
              Runs automatically on this interval, plus whenever &quot;Sync Now&quot; is used
              on the{" "}
              <Link href="/clients/search" className="underline hover:text-slate-200">
                search page
              </Link>{" "}
              or &quot;Re-sync&quot; is used on a client&apos;s own page. A run that finds
              nothing changed in Process Street costs almost nothing, so a short interval is
              safe to set. A running sync always finishes before the next scheduled one starts.
            </p>

            <div className="flex items-center gap-2">
              <label htmlFor="sync-interval-hours" className="text-sm text-slate-300">
                Sync every
              </label>
              <input
                id="sync-interval-hours"
                type="number"
                min={MIN_INTERVAL_HOURS}
                max={MAX_INTERVAL_HOURS}
                step={1}
                value={form.intervalHours}
                onChange={(event) => {
                  clearSaved();
                  const value = event.target.valueAsNumber;
                  setForm((current) =>
                    current ? { ...current, intervalHours: Number.isNaN(value) ? 0 : value } : current
                  );
                }}
                className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
              <span className="text-sm text-slate-300">hours</span>
            </div>

            {(form.intervalHours < MIN_INTERVAL_HOURS || form.intervalHours > MAX_INTERVAL_HOURS) && (
              <p className="mt-2 text-xs text-slate-500">
                Must be a whole number between {MIN_INTERVAL_HOURS} and {MAX_INTERVAL_HOURS}.
              </p>
            )}

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
