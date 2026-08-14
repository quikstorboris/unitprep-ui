"use client";

import { useEffect, useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import {
  getAuthConfiguration,
  updateAuthConfiguration,
  KNOWN_STEP_UP_ACTIONS,
} from "@/lib/auth-config";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Org-wide auth policy. Deliberately narrow today -- see `lib/auth.ts`'s
 * `AuthConfiguration` doc comment for why `allowed_factors` has no
 * control here, and the vault for why session-length/passkey-count
 * limits aren't here at all yet (no backing columns exist).
 */
export default function AdminSecurityPoliciesPage() {
  const [stepUpActions, setStepUpActions] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getAuthConfiguration();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setStepUpActions(result.data.step_up_actions);
    });
  }, []);

  function toggleAction(action: string, enabled: boolean) {
    setSaved(false);
    setStepUpActions((current) => {
      const base = current ?? [];
      return enabled
        ? [...base, action]
        : base.filter((value) => value !== action);
    });
  }

  async function handleSave() {
    if (!stepUpActions) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const result = await updateAuthConfiguration(stepUpActions);
    setSaving(false);

    if (result.kind !== "ok") {
      setSaveError(result.message);
      return;
    }

    setStepUpActions(result.data.step_up_actions);
    setSaved(true);
  }

  return (
    <RequirePermission permission="security_policies.manage">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">
            Security Policies
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Org-wide authentication policy.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {!stepUpActions ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="max-w-lg rounded border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-100">
              Step-up requirements
            </h2>
            <p className="mb-3 text-sm text-slate-400">
              Require a fresh authenticator-app code for these actions on
              an already-signed-in session, even one with TOTP confirmed
              and no anomaly detected.
            </p>

            <ul className="flex flex-col gap-2">
              {KNOWN_STEP_UP_ACTIONS.map(({ value, label }) => (
                <li key={value} className="flex items-start gap-2">
                  <input
                    id={`step-up-${value}`}
                    type="checkbox"
                    checked={stepUpActions.includes(value)}
                    onChange={(event) =>
                      toggleAction(value, event.target.checked)
                    }
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`step-up-${value}`}
                    className="text-sm text-slate-300"
                  >
                    {label}
                  </label>
                </li>
              ))}
            </ul>

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
              {saved && (
                <span className="text-sm text-green-400">Saved.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
