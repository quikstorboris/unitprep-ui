"use client";

import { useState } from "react";

import { updateFacilityFees, type FeeRow } from "@/lib/clientsDetail";

import { ManuallyMaintainedNote, PolicySectionHeader, QsxEmptyBanner, type PolicyTabProps } from "./PolicyTabShared";

const FEE_TYPE_LABELS: Record<string, string> = {
  security_deposit: "Security Deposit",
  nsf_chargeback: "NSF / Chargeback Fee",
  move_in_admin: "Move-In Admin Fee",
  transfer: "Transfer Fee",
  cleaning: "Cleaning Fee",
  other: "Other",
};

export function FeesTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = policies.fees.length === 0;

  function startEdit() {
    setRows(
      policies.fees.length > 0 ? policies.fees.map((fee) => ({ ...fee })) : [{ fee_type: "other", label: "", raw_value: "" }]
    );
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const cleaned = rows.filter((row) => row.raw_value.trim() !== "");
    const result = await updateFacilityFees(companyId, facilityId, cleaned);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  function updateRow(index: number, patch: Partial<FeeRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <PolicySectionHeader
        title="Fees"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.fees_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="fee" />}

      {!editing ? (
        isEmpty ? (
          <p className="text-sm text-slate-500">No fee data captured for this facility yet.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {policies.fees.map((fee, index) => (
              <div key={index} className="flex flex-col gap-1 text-sm">
                <dt className="text-slate-400">{fee.label || FEE_TYPE_LABELS[fee.fee_type] || fee.fee_type}</dt>
                <dd>{fee.raw_value}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={row.fee_type}
                onChange={(e) => updateRow(index, { fee_type: e.target.value })}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                {Object.entries(FEE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {row.fee_type === "other" && (
                <input
                  type="text"
                  value={row.label ?? ""}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                  placeholder="Label"
                  className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                />
              )}
              <input
                type="text"
                value={row.raw_value}
                onChange={(e) => updateRow(index, { raw_value: e.target.value })}
                placeholder="Value"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                className="shrink-0 rounded border border-red-900 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { fee_type: "other", label: "", raw_value: "" }])}
            className="w-fit rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            + Add Fee
          </button>
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
