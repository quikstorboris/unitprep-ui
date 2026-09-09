"use client";

import { useState } from "react";

import { updateFacilityTaxes, type TaxEntryInput, type TaxesRow } from "@/lib/clientsDetail";

import { ManuallyMaintainedNote, PolicySectionHeader, QsxEmptyBanner, type PolicyTabProps } from "./PolicyTabShared";

const TAX_NAME_LABELS: Record<string, string> = {
  sales: "Sales",
  rental: "Rental",
};

const LEGACY_TAX_FIELD_LABELS: { key: keyof TaxesRow; label: string }[] = [
  { key: "sales_tax_applies_raw", label: "Sales Tax Applies" },
  { key: "sales_tax_rate_raw", label: "Sales Tax Rate" },
  { key: "rent_tax_applies_raw", label: "Rent Tax Applies" },
  { key: "rent_tax_rate_raw", label: "Rent Tax Rate" },
  { key: "rent_tax_applies_to_all_units_raw", label: "Rent Tax Applies to All Units" },
  { key: "other_one_time_taxes_raw", label: "Other One-Time Taxes" },
  { key: "other_recurring_taxes_raw", label: "Other Recurring Taxes" },
];

/** A tax entry mid-edit -- numbers stay as strings while typing so a
 * half-entered value ("-", "") doesn't get silently coerced to 0 or
 * NaN; parsed to a real number only on Save. */
interface TaxEntryDraft {
  tax_name: string;
  description: string;
  flat_amount: string;
  attribute_payable_percent: string;
  is_recurring: boolean;
}

function emptyTaxDraft(): TaxEntryDraft {
  return { tax_name: "sales", description: "", flat_amount: "", attribute_payable_percent: "", is_recurring: false };
}

export function TaxesTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<TaxEntryDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = policies.tax_entries.length === 0;

  function startEdit() {
    setDrafts(
      policies.tax_entries.length > 0
        ? policies.tax_entries.map((entry) => ({
            tax_name: entry.tax_name,
            description: entry.description ?? "",
            flat_amount: entry.flat_amount === null ? "" : String(entry.flat_amount),
            attribute_payable_percent:
              entry.attribute_payable_percent === null ? "" : String(entry.attribute_payable_percent),
            is_recurring: entry.is_recurring,
          }))
        : [emptyTaxDraft()]
    );
    setError(null);
    setEditing(true);
  }

  function updateDraft(index: number, patch: Partial<TaxEntryDraft>) {
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  async function save() {
    setSaving(true);
    setError(null);

    const taxes: TaxEntryInput[] = drafts.map((draft) => ({
      tax_type: "fixed",
      tax_name: draft.tax_name,
      description: draft.description.trim() === "" ? null : draft.description,
      flat_amount: draft.flat_amount.trim() === "" ? null : Number(draft.flat_amount),
      attribute_payable_percent:
        draft.attribute_payable_percent.trim() === "" ? null : Number(draft.attribute_payable_percent),
      is_recurring: draft.is_recurring,
    }));

    const result = await updateFacilityTaxes(companyId, facilityId, taxes);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  const hasLegacyData = !!policies.taxes;

  return (
    <div className="rounded border border-slate-800 p-5">
      <PolicySectionHeader
        title="Taxes"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.taxes_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="tax" />}

      {!editing ? (
        <div className="flex flex-col gap-6">
          {isEmpty ? (
            <p className="text-sm text-slate-500">No tax data captured for this facility yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pr-4 pb-2 font-medium">Tax Name</th>
                    <th className="pr-4 pb-2 font-medium">Description</th>
                    <th className="pr-4 pb-2 font-medium">Flat Price</th>
                    <th className="pr-4 pb-2 font-medium">Attribute Payable</th>
                    <th className="pb-2 font-medium">Recurring</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.tax_entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-800">
                      <td className="py-2 pr-4">{TAX_NAME_LABELS[entry.tax_name] ?? entry.tax_name}</td>
                      <td className="py-2 pr-4">{entry.description || "—"}</td>
                      <td className="py-2 pr-4">{entry.flat_amount === null ? "—" : `$${entry.flat_amount}`}</td>
                      <td className="py-2 pr-4">
                        {entry.attribute_payable_percent === null ? "—" : `${entry.attribute_payable_percent}%`}
                      </td>
                      <td className="py-2">{entry.is_recurring ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasLegacyData && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                From an Earlier Process Street Import
              </h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {LEGACY_TAX_FIELD_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-1 text-sm">
                    <dt className="text-slate-400">{label}</dt>
                    <dd>{policies.taxes?.[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 rounded border border-slate-800 p-3">
              <select
                value={draft.tax_name}
                onChange={(e) => updateDraft(index, { tax_name: e.target.value })}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                {Object.entries(TAX_NAME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => updateDraft(index, { description: e.target.value })}
                placeholder="Description (e.g. Parking Space County Tax)"
                className="min-w-[18rem] flex-[3] rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="number"
                step="0.01"
                value={draft.flat_amount}
                onChange={(e) => updateDraft(index, { flat_amount: e.target.value })}
                placeholder="Flat Price ($)"
                className="w-24 shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="number"
                step="0.01"
                value={draft.attribute_payable_percent}
                onChange={(e) => updateDraft(index, { attribute_payable_percent: e.target.value })}
                placeholder="Payable (%)"
                className="w-24 shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <fieldset className="flex items-center gap-3 text-sm text-slate-300">
                <legend className="sr-only">Recurring</legend>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={draft.is_recurring}
                    onChange={() => updateDraft(index, { is_recurring: true })}
                  />
                  Recurring
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={!draft.is_recurring}
                    onChange={() => updateDraft(index, { is_recurring: false })}
                  />
                  One-Time
                </label>
              </fieldset>
              <button
                type="button"
                onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                className="shrink-0 rounded border border-red-900 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDrafts((prev) => [...prev, emptyTaxDraft()])}
            className="w-fit rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            + Add Tax
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
