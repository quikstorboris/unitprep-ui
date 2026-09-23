"use client";

import { useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import { manualLink, type ManualLinkWorkflow } from "@/lib/clientsCompanies";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Company page's "Manual Link" button (2026-09-23) -- repoints one
 * facility's Intake or Merchant Account run at a different Process
 * Street run id, in place, whether or not something is already linked.
 * Built after Knapp's Self Stor of Milton Freewater ended up linked to
 * a different real business's Merchant Account run purely on a fuzzy
 * title/DBA match -- this is the "fix it without deleting and
 * recreating the client" escape hatch. Distinct from the Elavon tab's
 * own "Link Manually", which only covers the not-yet-linked Merchant
 * Account case (see `api::clients_manual_link`'s own module doc).
 */
export default function ManualLinkDialog({ companyId }: { companyId: string }) {
  const { company, refetch } = useCompanyDetail();

  const [open, setOpen] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [workflow, setWorkflow] = useState<ManualLinkWorkflow>("merchant_account");
  const [runId, setRunId] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const facilities = company?.facilities ?? [];

  function openDialog() {
    setError(null);
    setResult(null);
    setRunId("");
    setFacilityId(facilities[0]?.id ?? "");
    setWorkflow("merchant_account");
    setOpen(true);
  }

  async function handleLink() {
    const trimmedRunId = runId.trim();
    if (!facilityId || !trimmedRunId) return;

    setLinking(true);
    setError(null);

    const response = await manualLink(companyId, {
      facility_id: facilityId,
      workflow,
      run_id: trimmedRunId,
    });

    setLinking(false);

    if (response.kind !== "ok") {
      setError(response.message);
      return;
    }

    setOpen(false);
    setResult("Linked.");
    refetch();
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button type="button" onClick={openDialog} disabled={facilities.length === 0} className={buttonClass}>
          Manual Link
        </button>
        {result && <span className="text-sm text-green-400">{result}</span>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Manual Link</h2>
            <p className="mt-1 text-sm text-slate-400">
              Point a facility&apos;s Intake or Merchant Account record at a different Process Street run --
              use this to fix a wrong link without deleting and recreating the client. This always overwrites,
              whether or not something is already linked, and there&apos;s no undo.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Facility</label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Workflow</label>
                <div className="flex gap-4 text-sm text-slate-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="manual-link-workflow"
                      checked={workflow === "merchant_account"}
                      onChange={() => setWorkflow("merchant_account")}
                    />
                    Merchant Account (Elavon)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="manual-link-workflow"
                      checked={workflow === "intake"}
                      onChange={() => setWorkflow("intake")}
                    />
                    Intake
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Process Street run ID</label>
                <input
                  type="text"
                  value={runId}
                  onChange={(e) => setRunId(e.target.value)}
                  placeholder="e.g. h_CH_HP9sv2FxY_3c3FPXw"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Open the run in Process Street and copy the id out of its own URL -- it&apos;s the segment right
                  after the run&apos;s name, just before <span className="font-mono">/tasks/</span>. For example:
                </p>
                <p className="mt-1 break-all rounded bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-500">
                  https://app.process.st/runs/Milton-Self-Storage-New-Elavon-Account-
                  <span className="font-bold text-red-500">h_CH_HP9sv2FxY_3c3FPXw</span>
                  /tasks/gGkUh4u-X0ya-MZBtERI1g
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} disabled={linking} className={buttonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLink}
                disabled={linking || !facilityId || !runId.trim()}
                className={primaryButtonClass}
              >
                {linking ? "Linking…" : "Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
