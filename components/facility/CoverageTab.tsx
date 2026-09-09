"use client";

import { useState } from "react";

import { updateFacilityCoverage, type CommissionRow, type CoverageTierRow } from "@/lib/clientsDetail";

import { ManuallyMaintainedNote, PolicySectionHeader, QsxEmptyBanner, type PolicyTabProps } from "./PolicyTabShared";

const EMPTY_COMMISSION: CommissionRow = { commission_type_raw: null, dollar_amount_raw: null, percent_amount_raw: null };

export function CoverageTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [tiers, setTiers] = useState<CoverageTierRow[]>([]);
  const [commission, setCommission] = useState<CommissionRow>(EMPTY_COMMISSION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = policies.coverage_tiers.length === 0 && !policies.commission;

  function startEdit() {
    setTiers(
      policies.coverage_tiers.length > 0
        ? policies.coverage_tiers.map((tier) => ({ ...tier }))
        : [{ tier_number: 1, total_coverage_amount_raw: "", cost_to_tenant_raw: "" }]
    );
    setCommission(policies.commission ?? EMPTY_COMMISSION);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const cleanedTiers = tiers
      .filter((tier) => (tier.total_coverage_amount_raw ?? "").trim() !== "" || (tier.cost_to_tenant_raw ?? "").trim() !== "")
      .map((tier, index) => ({ ...tier, tier_number: index + 1 }));
    const hasCommission =
      (commission.commission_type_raw ?? "").trim() !== "" ||
      (commission.dollar_amount_raw ?? "").trim() !== "" ||
      (commission.percent_amount_raw ?? "").trim() !== "";

    const result = await updateFacilityCoverage(companyId, facilityId, cleanedTiers, hasCommission ? commission : null);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  function updateTier(index: number, patch: Partial<CoverageTierRow>) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <PolicySectionHeader
        title="Coverage"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.coverage_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="coverage" />}

      {!editing ? (
        isEmpty ? (
          <p className="text-sm text-slate-500">No coverage data captured for this facility yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {policies.coverage_tiers.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="pr-4 pb-2 font-medium">Tier</th>
                      <th className="pr-4 pb-2 font-medium">Total Coverage Amount</th>
                      <th className="pb-2 font-medium">Cost to Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.coverage_tiers.map((tier) => (
                      <tr key={tier.tier_number} className="border-t border-slate-800">
                        <td className="py-2 pr-4">{tier.tier_number}</td>
                        <td className="py-2 pr-4">{tier.total_coverage_amount_raw ?? "—"}</td>
                        <td className="py-2">{tier.cost_to_tenant_raw ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {policies.commission && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-slate-300">Commission</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 text-sm">
                    <dt className="text-slate-400">Type</dt>
                    <dd>{policies.commission.commission_type_raw || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <dt className="text-slate-400">Dollar Amount</dt>
                    <dd>{policies.commission.dollar_amount_raw || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <dt className="text-slate-400">Percent Amount</dt>
                    <dd>{policies.commission.percent_amount_raw || "—"}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-slate-300">Tiers</h3>
            {tiers.map((tier, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 text-sm text-slate-400">Tier {index + 1}</span>
                <input
                  type="text"
                  value={tier.total_coverage_amount_raw ?? ""}
                  onChange={(e) => updateTier(index, { total_coverage_amount_raw: e.target.value })}
                  placeholder="Total Coverage Amount"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                />
                <input
                  type="text"
                  value={tier.cost_to_tenant_raw ?? ""}
                  onChange={(e) => updateTier(index, { cost_to_tenant_raw: e.target.value })}
                  placeholder="Cost to Tenant"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                  className="shrink-0 rounded border border-red-900 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setTiers((prev) => [...prev, { tier_number: prev.length + 1, total_coverage_amount_raw: "", cost_to_tenant_raw: "" }])
              }
              className="w-fit rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              + Add Tier
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-slate-300">Commission</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={commission.commission_type_raw ?? ""}
                onChange={(e) => setCommission((prev) => ({ ...prev, commission_type_raw: e.target.value }))}
                placeholder="Type"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={commission.dollar_amount_raw ?? ""}
                onChange={(e) => setCommission((prev) => ({ ...prev, dollar_amount_raw: e.target.value }))}
                placeholder="Dollar Amount"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={commission.percent_amount_raw ?? ""}
                onChange={(e) => setCommission((prev) => ({ ...prev, percent_amount_raw: e.target.value }))}
                placeholder="Percent Amount"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
