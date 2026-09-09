"use client";

import { useState } from "react";

import { updateFacilityDelinquency, type DelinquencyEntryInput } from "@/lib/clientsDetail";

import { ManuallyMaintainedNote, PolicySectionHeader, QsxEmptyBanner, type PolicyTabProps } from "./PolicyTabShared";

const STEP_TYPE_LABELS: Record<string, string> = {
  late_fee: "Late Fee",
  pre_lien: "Pre-Lien",
  lien: "Lien",
  cut_lock: "Cut Lock",
  auction: "Auction",
  notice: "Notice",
  other: "Other",
};

const PAID_THROUGH_DATE = "paid_through_date";

/** A delinquency entry mid-edit -- `amount`/`days_after` stay strings
 * while typing, same reasoning as `TaxEntryDraft`. `triggerValue` folds
 * `trigger_type`/`trigger_category` into one dropdown value:
 * `PAID_THROUGH_DATE` or another row's own `category`. */
interface DelinquencyDraft {
  category: string;
  name: string;
  amount: string;
  days_after: string;
  triggerValue: string;
}

function emptyDelinquencyDraft(): DelinquencyDraft {
  return { category: "other", name: "", amount: "0", days_after: "", triggerValue: PAID_THROUGH_DATE };
}

/** Just enough of either a saved `DelinquencyEntry` or an in-progress
 * draft (post-parse) to share `describeTrigger` between the read view
 * and a live preview, without either shape needing to fake the other's
 * unrelated fields. */
interface DelinquencyEntryOrDraft {
  trigger_type: string;
  trigger_category: string | null;
  days_after: number | string | null;
}

function describeTrigger(entry: DelinquencyEntryOrDraft): string {
  const base =
    entry.trigger_type === PAID_THROUGH_DATE
      ? "Paid Through Date"
      : (STEP_TYPE_LABELS[entry.trigger_category ?? ""] ?? entry.trigger_category ?? "—");
  return entry.days_after === null || entry.days_after === undefined || entry.days_after === ""
    ? base
    : `${entry.days_after} days after ${base}`;
}

export function DelinquencyTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DelinquencyDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = policies.delinquency_entries.length === 0;

  function startEdit() {
    setDrafts(
      policies.delinquency_entries.length > 0
        ? policies.delinquency_entries.map((entry) => ({
            category: entry.category,
            name: entry.name,
            amount: String(entry.amount),
            days_after: entry.days_after === null ? "" : String(entry.days_after),
            triggerValue: entry.trigger_type === PAID_THROUGH_DATE ? PAID_THROUGH_DATE : (entry.trigger_category ?? PAID_THROUGH_DATE),
          }))
        : [emptyDelinquencyDraft()]
    );
    setError(null);
    setEditing(true);
  }

  function updateDraft(index: number, patch: Partial<DelinquencyDraft>) {
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  async function save() {
    setError(null);

    const categories = drafts.map((d) => d.category);
    const duplicate = categories.find((category, index) => categories.indexOf(category) !== index);
    if (duplicate) {
      setError(`"${STEP_TYPE_LABELS[duplicate] ?? duplicate}" is used more than once -- each category can only appear once.`);
      return;
    }
    if (drafts.some((d) => d.amount.trim() === "" || Number.isNaN(Number(d.amount)))) {
      setError("Every entry needs a dollar amount -- 0 is fine, but it can't be blank.");
      return;
    }

    setSaving(true);

    const entries: DelinquencyEntryInput[] = drafts.map((draft) => ({
      category: draft.category,
      name: draft.name,
      amount: Number(draft.amount),
      days_after: draft.days_after.trim() === "" ? null : Number(draft.days_after),
      trigger_type: draft.triggerValue === PAID_THROUGH_DATE ? PAID_THROUGH_DATE : "step_category",
      trigger_category: draft.triggerValue === PAID_THROUGH_DATE ? null : draft.triggerValue,
    }));

    const result = await updateFacilityDelinquency(companyId, facilityId, entries);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <PolicySectionHeader
        title="Delinquency"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.delinquency_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="delinquency" />}

      {!editing ? (
        <div className="flex flex-col gap-6">
          {isEmpty ? (
            <p className="text-sm text-slate-500">No delinquency entries captured for this facility yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="pr-4 pb-2 font-medium">Category</th>
                    <th className="pr-4 pb-2 font-medium">Name</th>
                    <th className="pr-4 pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.delinquency_entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-800">
                      <td className="py-2 pr-4">{STEP_TYPE_LABELS[entry.category] ?? entry.category}</td>
                      <td className="py-2 pr-4">{entry.name}</td>
                      <td className="py-2 pr-4">${entry.amount}</td>
                      <td className="py-2">{describeTrigger(entry)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {policies.delinquency_steps.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-300">
                From an Earlier Process Street Import
              </h3>
              <ol className="flex flex-col gap-2 text-sm">
                {policies.delinquency_steps.map((step) => (
                  <li key={step.step_order} className="flex gap-3">
                    <span className="w-24 shrink-0 text-slate-400">
                      {STEP_TYPE_LABELS[step.step_type] ?? step.step_type}
                    </span>
                    <span>{step.raw_value}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((draft, index) => {
            const otherCategories = drafts
              .map((d) => d.category)
              .filter((category, i) => i !== index)
              .filter((category, i, arr) => arr.indexOf(category) === i);

            return (
              <div key={index} className="flex flex-col gap-2 rounded border border-slate-800 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={draft.category}
                    onChange={(e) => updateDraft(index, { category: e.target.value })}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  >
                    {Object.entries(STEP_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateDraft(index, { name: e.target.value })}
                    placeholder="Name (e.g. 1st Late Fee)"
                    className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.amount}
                    onChange={(e) => updateDraft(index, { amount: e.target.value })}
                    placeholder="Amount ($)"
                    className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                    className="shrink-0 rounded border border-red-900 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  <input
                    type="number"
                    value={draft.days_after}
                    onChange={(e) => updateDraft(index, { days_after: e.target.value })}
                    placeholder="Days after"
                    className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                  <span className="text-slate-400">after</span>
                  <select
                    value={draft.triggerValue}
                    onChange={(e) => updateDraft(index, { triggerValue: e.target.value })}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  >
                    <option value={PAID_THROUGH_DATE}>Paid Through Date</option>
                    {otherCategories.map((category) => (
                      <option key={category} value={category}>
                        {STEP_TYPE_LABELS[category] ?? category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setDrafts((prev) => [...prev, emptyDelinquencyDraft()])}
            className="w-fit rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            + Add Entry
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
