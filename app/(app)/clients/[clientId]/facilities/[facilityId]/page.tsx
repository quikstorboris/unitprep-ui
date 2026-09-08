"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import DetailSection from "@/components/clients/DetailSection";
import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import FacilityRail from "@/components/clients/FacilityRail";
import FieldReferenceHelp from "@/components/clients/FieldReferenceHelp";
import PartyCard from "@/components/clients/PartyCard";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import {
  addFacilityPerson,
  editFacilityPerson,
  getFacilityDetail,
  getFacilityElavon,
  getFacilityPeople,
  getFacilityPolicies,
  linkFacilityElavon,
  unlinkFacilityElavon,
  unlinkFacilityPerson,
  updateFacilityCoverage,
  updateFacilityDelinquency,
  updateFacilityDropboxFolder,
  updateFacilityFees,
  updateFacilitySpecials,
  updateFacilityTaxes,
  type CommissionRow,
  type CoverageTierRow,
  type DelinquencyEntryInput,
  type ElavonStatus,
  type FacilityDetail,
  type FacilityPeople,
  type FacilityPerson,
  type FacilityPolicies,
  type FeeRow,
  type PersonAssignment,
  type TaxEntryInput,
  type TaxesRow,
} from "@/lib/clientsDetail";
import { dropboxFolderWebUrl } from "@/lib/dropbox";
import { formatDateOnly, formatPhone } from "@/lib/format";

/**
 * Facility page -- originally General | Users | DropBox | Elavon |
 * Facility Policies per the vault's Phase 4 design note, revised
 * 2026-09-04 (Boris's call): the single Facility Policies tab is now
 * five separate tabs -- Fees | Taxes | Delinquency | Coverage |
 * Specials -- since each became independently editable (see
 * `PolicySectionHeader`'s own doc comment) and stacking five edit forms
 * on one tab would be unwieldy. DropBox is the one remaining
 * placeholder.
 */
type Tab = "general" | "users" | "dropbox" | "elavon" | "fees" | "taxes" | "delinquency" | "coverage" | "specials";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "users", label: "Users" },
  { key: "dropbox", label: "DropBox" },
  { key: "elavon", label: "Elavon" },
  { key: "fees", label: "Fees" },
  { key: "taxes", label: "Taxes" },
  { key: "delinquency", label: "Delinquency" },
  { key: "coverage", label: "Coverage" },
  { key: "specials", label: "Specials" },
];

function tabButtonClass(active: boolean) {
  return `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
  }`;
}

function GeneralTab({ facility }: { facility: FacilityDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailSection
        title="General"
        fields={[
          { label: "Facility Name", value: facility.name },
          { label: "Street Address", value: facility.street_address },
          { label: "City", value: facility.city },
          { label: "State", value: facility.state },
          { label: "ZIP", value: facility.zip },
          { label: "Phone", value: formatPhone(facility.phone) },
          { label: "Email", value: facility.email },
          { label: "Units Count", value: facility.units_count },
          { label: "Primary Storage Offering", value: facility.primary_storage_offering },
          { label: "Previous PMS", value: facility.previous_pms },
          { label: "Access Control System", value: facility.access_control_system },
          { label: "Original Go Live Date", value: facility.go_live_date },
          { label: "Subdomain", value: facility.subdomain },
          { label: "Subdomain Exists in QMS", value: facility.subdomain_exists_in_qms_raw },
          { label: "System Email", value: facility.system_email },
          { label: "Website", value: facility.website_url },
        ]}
      />

      <section className="rounded border border-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold">Dropbox</h2>
        {facility.dropbox_folder_url ? (
          <a
            href={facility.dropbox_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
          >
            <DropboxLogo className="h-4 w-4" />
            Go to DropBox
          </a>
        ) : (
          <p className="text-sm text-slate-500">No Dropbox folder on file for this facility.</p>
        )}
      </section>
    </div>
  );
}

const FEE_TYPE_LABELS: Record<string, string> = {
  security_deposit: "Security Deposit",
  nsf_chargeback: "NSF / Chargeback Fee",
  move_in_admin: "Move-In Admin Fee",
  transfer: "Transfer Fee",
  cleaning: "Cleaning Fee",
  other: "Other",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  late_fee: "Late Fee",
  pre_lien: "Pre-Lien",
  lien: "Lien",
  cut_lock: "Cut Lock",
  auction: "Auction",
  notice: "Notice",
  other: "Other",
};

/**
 * Shared header for every split Facility Policies tab -- the first
 * editable data anywhere in this app (2026-09-04). Read mode shows an
 * "Edit" button; edit mode swaps it for Cancel/Save, matching the
 * global edit convention the original Phase 4 plan called for but never
 * built until now.
 */
function PolicySectionHeader({
  title,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Edit
        </button>
      )}
    </div>
  );
}

/** Shown on an empty category for a QSX-legacy facility -- Process
 * Street has no equivalent step for these categories under QSX, so
 * "empty" here means "genuinely nothing to sync," not "hasn't answered
 * yet." */
function QsxEmptyBanner({ category }: { category: string }) {
  return (
    <p className="mb-4 rounded border border-amber-900 bg-amber-950/10 p-3 text-sm text-amber-300">
      This is a QSX client -- Process Street has no {category} data for it. Click Edit to enter it manually.
    </p>
  );
}

/** Shown once a category has been flagged exempt -- see the backend's
 * `clients::policy_exemption` module doc for why this is permanent. */
function ManuallyMaintainedNote() {
  return (
    <p className="mb-4 text-xs text-slate-500">
      Manually maintained for this QSX client -- a Process Street sync will never overwrite it.
    </p>
  );
}

interface PolicyTabProps {
  companyId: string;
  facilityId: string;
  policies: FacilityPolicies;
  onSaved: () => Promise<void>;
}

function FeesTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
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

function TaxesTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
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

function describeTrigger(entry: DelinquencyEntryOrDraft): string {
  const base =
    entry.trigger_type === PAID_THROUGH_DATE
      ? "Paid Through Date"
      : (STEP_TYPE_LABELS[entry.trigger_category ?? ""] ?? entry.trigger_category ?? "—");
  return entry.days_after === null || entry.days_after === undefined || entry.days_after === ""
    ? base
    : `${entry.days_after} days after ${base}`;
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

function DelinquencyTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
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

const EMPTY_COMMISSION: CommissionRow = { commission_type_raw: null, dollar_amount_raw: null, percent_amount_raw: null };

function CoverageTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
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

/** Grows a textarea to fit its own content -- reset to "auto" first so
 * a shrink (text deleted, or a fresh shorter value loaded in) actually
 * shrinks the box instead of only ever growing from whatever height it
 * last settled at. */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function SpecialsTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = !policies.specials_raw_text;

  // Sizes to whatever's already there the moment the textarea appears
  // (a long pasted block shouldn't start scrolled/clipped) -- the
  // `onChange` handler below covers every edit after that.
  useEffect(() => {
    if (editing) autoResizeTextarea(textareaRef.current);
  }, [editing]);

  function startEdit() {
    setRawText(policies.specials_raw_text ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const result = await updateFacilitySpecials(companyId, facilityId, rawText.trim() === "" ? null : rawText);

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
        title="Specials"
        editing={editing}
        saving={saving}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
        onSave={save}
      />

      {policies.specials_manually_exempt && <ManuallyMaintainedNote />}
      {!editing && isEmpty && policies.is_qsx_legacy && <QsxEmptyBanner category="specials" />}

      {!editing ? (
        isEmpty ? (
          <p className="text-sm text-slate-500">No specials captured for this facility yet.</p>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-200">{policies.specials_raw_text}</pre>
        )
      ) : (
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            autoResizeTextarea(e.target);
          }}
          className="min-h-[14rem] w-full resize-none overflow-hidden rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        />
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  district_manager: "District Manager",
  manager: "Manager",
};

/**
 * Formats the roster for "Copy All" -- one person per paragraph, name
 * then phone then email (each only if present), blank line between
 * people. Plain text, not CSV/markdown -- meant to be pasted straight
 * into an email or a PS field, not parsed back.
 */
/** Section heading per role, in the fixed order Boris asked for --
 * Owner(s), District Manager(s), Manager(s) -- not alphabetical or
 * table order, and skipped entirely when this facility has none of
 * that role. */
const ROLE_CLIPBOARD_HEADINGS: { role: string; heading: string }[] = [
  { role: "owner", heading: "Owner(s):" },
  { role: "district_manager", heading: "District Manager(s):" },
  { role: "manager", heading: "Manager(s):" },
];

function formatRosterForClipboard(roster: FacilityPerson[]): string {
  return ROLE_CLIPBOARD_HEADINGS.filter(({ role }) => roster.some((person) => person.role === role))
    .map(({ role, heading }) => {
      const people = roster
        .filter((person) => person.role === role)
        .map((person) =>
          [person.full_name, person.phone ? formatPhone(person.phone) : null, person.email]
            .filter((line): line is string => !!line)
            .join("\n")
        )
        .join("\n\n");
      return `${heading}\n\n${people}`;
    })
    .join("\n\n\n");
}

const SOURCE_LABELS: Record<string, string> = {
  process_street: "Process Street",
  manual: "Manual",
};

interface PersonFormState {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

function emptyPersonForm(): PersonFormState {
  return { full_name: "", email: "", phone: "", role: "manager" };
}

function personFormToAssignment(form: PersonFormState): PersonAssignment {
  return {
    full_name: form.full_name,
    email: form.email.trim() === "" ? null : form.email,
    phone: form.phone.trim() === "" ? null : form.phone,
    role: form.role,
  };
}

/**
 * Users tab -- Phase 4 item 4. `candidates` are already-indexed rows off
 * this facility's own Process Street Intake run
 * (`clients.ps_person_index`, refreshed nightly, independent of when the
 * facility was created) -- no search box, no live PS call, just chips.
 * A not-yet-linked candidate's chip adds them; an already-linked one's
 * chip renders red and unlinks them instead (2026-09-04, Boris's own
 * call) -- the self-heal `addFacilityPerson` used to do on that same
 * click now happens automatically every time the tab loads instead (see
 * `getFacilityPeople`'s own backend doc comment), precisely so this
 * click was free to mean something else.
 *
 * 2026-09-08: every roster row now has a Source (Process Street or
 * Manual) and an Edit action. A manually-added person (its own "+ Add
 * Person Manually" form below) is permanently exempt from the self-heal
 * pass. Editing a Process Street person offers a choice, right at edit
 * time, to protect that edit the same way -- otherwise the next self-heal
 * pass can silently revert it back to whatever the index says.
 */
function UsersTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const [people, setPeople] = useState<FacilityPeople | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonFormState>(emptyPersonForm());
  const [editProtect, setEditProtect] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [addingManually, setAddingManually] = useState(false);
  const [manualForm, setManualForm] = useState<PersonFormState>(emptyPersonForm());
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function load() {
    const result = await getFacilityPeople(companyId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setPeople(result.data);
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setPeople(null);
      setLoadError(null);
      setActionError(null);
      setCopied(false);
      setEditingKey(null);
      setAddingManually(false);
      await load();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is stable in shape; only re-run on facility change
  }, [companyId, facilityId]);

  async function handleChipClick(candidate: PersonAssignment, linkedPersonId: string | null) {
    const key = `${candidate.email ?? candidate.full_name}:${candidate.role}`;
    setPendingKey(key);
    setActionError(null);

    const result = linkedPersonId
      ? await unlinkFacilityPerson(companyId, facilityId, linkedPersonId, candidate.role)
      : await addFacilityPerson(companyId, facilityId, candidate, "process_street");

    setPendingKey(null);

    if (result.kind !== "ok") {
      setActionError(result.message);
      return;
    }

    await load();
  }

  async function handleCopyAll() {
    if (!people || people.roster.length === 0) return;

    try {
      await navigator.clipboard.writeText(formatRosterForClipboard(people.roster));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Could not copy to the clipboard -- your browser may be blocking clipboard access.");
    }
  }

  function startEdit(person: FacilityPerson) {
    setEditingKey(`${person.person_id}-${person.role}`);
    setEditForm({
      full_name: person.full_name,
      email: person.email ?? "",
      phone: person.phone ?? "",
      role: person.role,
    });
    setEditProtect(false);
    setEditError(null);
  }

  async function saveEdit(person: FacilityPerson) {
    setEditSaving(true);
    setEditError(null);

    const result = await editFacilityPerson(
      companyId,
      facilityId,
      person.person_id,
      person.role,
      personFormToAssignment(editForm),
      editProtect
    );

    setEditSaving(false);

    if (result.kind !== "ok") {
      setEditError(result.message);
      return;
    }

    setEditingKey(null);
    await load();
  }

  async function submitManualAdd() {
    setManualSaving(true);
    setManualError(null);

    if (manualForm.full_name.trim() === "") {
      setManualSaving(false);
      setManualError("Name is required.");
      return;
    }

    const result = await addFacilityPerson(companyId, facilityId, personFormToAssignment(manualForm), "manual");

    setManualSaving(false);

    if (result.kind !== "ok") {
      setManualError(result.message);
      return;
    }

    setAddingManually(false);
    setManualForm(emptyPersonForm());
    await load();
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {loadError}
      </p>
    );
  }

  if (!people) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  // Keyed by "email:role" (both lowercased on email) -- how a candidate
  // chip finds the roster row it corresponds to, since a candidate off
  // ps_person_index carries no person_id of its own.
  const rosterByEmailAndRole = new Map(
    people.roster
      .filter((person) => !!person.email)
      .map((person) => [`${person.email!.toLowerCase()}:${person.role}`, person])
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-slate-800 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Users</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAddingManually((prev) => !prev);
                setManualError(null);
              }}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              + Add Person Manually
            </button>
            {people.roster.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                {copied ? "Copied!" : "Copy All"}
              </button>
            )}
          </div>
        </div>

        {addingManually && (
          <div className="mb-4 flex flex-col gap-2 rounded border border-slate-800 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={manualForm.full_name}
                onChange={(e) => setManualForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Name"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={manualForm.email}
                onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={manualForm.phone}
                onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <select
                value={manualForm.role}
                onChange={(e) => setManualForm((prev) => ({ ...prev, role: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitManualAdd}
                disabled={manualSaving}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {manualSaving ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setAddingManually(false)}
                disabled={manualSaving}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <span className="text-xs text-slate-500">Never overwritten by a Process Street sync.</span>
            </div>
            {manualError && (
              <p role="alert" className="text-sm text-red-400">
                {manualError}
              </p>
            )}
          </div>
        )}

        {people.roster.length === 0 ? (
          <p className="text-sm text-slate-500">No users linked to this facility yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="w-56 pr-4 pb-2 font-medium">Email</th>
                  <th className="w-40 pr-4 pb-2 font-medium">Phone</th>
                  <th className="pr-4 pb-2 font-medium">Role</th>
                  <th className="pr-4 pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {people.roster.map((person) => {
                  const key = `${person.person_id}-${person.role}`;
                  const isEditing = editingKey === key;

                  if (isEditing) {
                    return (
                      <tr key={key} className="border-t border-slate-800">
                        <td colSpan={6} className="py-3">
                          <div className="flex flex-col gap-2 rounded border border-slate-800 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={editForm.full_name}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                                placeholder="Name"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <input
                                type="text"
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <input
                                type="text"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="Phone"
                                className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <select
                                value={editForm.role}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {person.source === "process_street" && (
                              <label className="flex items-center gap-2 text-xs text-amber-300">
                                <input
                                  type="checkbox"
                                  checked={editProtect}
                                  onChange={(e) => setEditProtect(e.target.checked)}
                                />
                                This person came from Process Street -- without protecting, a future sync could
                                silently revert this edit. Protect it from that.
                              </label>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(person)}
                                disabled={editSaving}
                                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingKey(null)}
                                disabled={editSaving}
                                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                            {editError && (
                              <p role="alert" className="text-sm text-red-400">
                                {editError}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={key} className="border-t border-slate-800">
                      <td className="py-2 pr-4">{person.full_name}</td>
                      <td className="py-2 pr-4 text-slate-400">{person.email ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-400">{person.phone ? formatPhone(person.phone) : "—"}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
                          {ROLE_LABELS[person.role] ?? person.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{SOURCE_LABELS[person.source] ?? person.source}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => startEdit(person)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded border border-slate-800 p-5">
        <h2 className="mb-2 text-lg font-semibold">Add User</h2>
        <p className="mb-1 text-sm text-slate-400">
          Pulled from this facility&apos;s own Process Street Intake run, kept up to date automatically. A red chip
          is already linked -- click it to unlink.
        </p>
        <p className="mb-4 text-sm text-slate-500">
          To correct a name, email, phone, or role, edit it in Process Street -- it&apos;ll show up here
          automatically next time this tab loads. (Or use the roster&apos;s own Edit button above, with the
          protection option, for a quicker one-off fix.)
        </p>
        {people.candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No Process Street contacts found for this facility.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {people.candidates.map((candidate) => {
              const key = `${candidate.email ?? candidate.full_name}:${candidate.role}`;
              const linkedPerson = candidate.email
                ? rosterByEmailAndRole.get(`${candidate.email.toLowerCase()}:${candidate.role}`)
                : undefined;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleChipClick(candidate, linkedPerson?.person_id ?? null)}
                  disabled={pendingKey === key}
                  title={
                    linkedPerson
                      ? `Unlink ${candidate.full_name}`
                      : (candidate.email ?? undefined)
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    linkedPerson
                      ? "border-red-900 bg-red-950/20 text-red-300 hover:bg-red-950/40"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {linkedPerson ? "✕ " : "+ "}
                  {candidate.full_name}
                  <span className="ml-1.5 text-xs text-slate-400">
                    ({ROLE_LABELS[candidate.role] ?? candidate.role})
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {actionError}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * DropBox tab -- Phase 4 item 6, the last placeholder. Lets a manager
 * change (or link, for the first time) which Dropbox folder this
 * facility points to -- reuses the same `DropboxFolderPicker` every
 * other Dropbox-import flow in the app already uses. The Company
 * page's own "Go to DropBox" launchpad links stay put (Boris's own
 * call, 2026-09-04) -- this tab is only about changing the link, not
 * displaying it a second place.
 */
function DropboxTab({
  companyId,
  facilityId,
  dropboxFolderUrl,
  onSaved,
}: {
  companyId: string;
  facilityId: string;
  dropboxFolderUrl: string | null;
  onSaved: () => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [pickedPath, setPickedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startChange() {
    setPickedPath("");
    setError(null);
    setChanging(true);
  }

  async function save() {
    if (pickedPath.trim() === "") return;

    setSaving(true);
    setError(null);

    const result = await updateFacilityDropboxFolder(companyId, facilityId, dropboxFolderWebUrl(pickedPath));

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setChanging(false);
    await onSaved();
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <h2 className="mb-4 text-lg font-semibold">DropBox</h2>

      {!changing ? (
        <div className="flex flex-col gap-4">
          {dropboxFolderUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={dropboxFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
              >
                <DropboxLogo className="h-4 w-4" />
                Go to DropBox
              </a>
              <button
                type="button"
                onClick={startChange}
                className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Change Folder
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">No Dropbox folder linked for this facility yet.</p>
              <button
                type="button"
                onClick={startChange}
                className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Link a Folder
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <DropboxFolderPicker value={pickedPath} mode="select-folder" onChange={setPickedPath} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || pickedPath.trim() === ""}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setChanging(false)}
              disabled={saving}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
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

/**
 * Elavon tab -- Phase 4 item 5. Fetched on its own, lazily, only once
 * this tab is actually selected (not alongside General/Facility
 * Policies on every facility switch) -- it's the least-visited tab day
 * to day, and eagerly fetching it on every click would work against
 * the same pool-exhaustion latency fix this page just got (see
 * `unitprep-api`'s `db.rs` doc comment).
 */
function ElavonTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  // So a newly-linked facility's Elavon/Owner data shows up on the
  // Company page too without a full reload -- that page's own
  // `elavon_active`/`owners` are computed across the company's
  // facilities, and its data only comes from `CompanyDetailProvider`
  // (fetched once per company, see that module's own doc comment).
  const { refetch: refetchCompany } = useCompanyDetail();

  const [status, setStatus] = useState<ElavonStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualRunId, setManualRunId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  async function load() {
    const result = await getFacilityElavon(companyId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setStatus(result.data);
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setStatus(null);
      setLoadError(null);
      setLinkError(null);
      setManualRunId("");
      setConfirmingUnlink(false);
      setUnlinkError(null);
      await load();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is stable in shape; only re-run on facility change
  }, [companyId, facilityId]);

  async function handleLink(runId: string) {
    const trimmed = runId.trim();
    if (!trimmed) return;

    setLinking(true);
    setLinkError(null);

    const result = await linkFacilityElavon(companyId, facilityId, trimmed);

    setLinking(false);

    if (result.kind !== "ok") {
      setLinkError(result.message);
      return;
    }

    await load();
    refetchCompany();
  }

  async function handleUnlink() {
    setUnlinking(true);
    setUnlinkError(null);

    const result = await unlinkFacilityElavon(companyId, facilityId);

    setUnlinking(false);

    if (result.kind !== "ok") {
      setUnlinkError(result.message);
      return;
    }

    setConfirmingUnlink(false);
    await load();
    refetchCompany();
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {loadError}
      </p>
    );
  }

  if (!status) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  if (status.status === "linked") {
    return (
      <div className="flex flex-col gap-6">
        <DetailSection
          title="Elavon"
          action={
            confirmingUnlink ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400">Remove this link and its owner/financial data?</span>
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {unlinking ? "Unlinking…" : "Yes, unlink"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingUnlink(false)}
                  disabled={unlinking}
                  className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingUnlink(true)}
                className="rounded border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
              >
                Unlink
              </button>
            )
          }
          fields={[
            { label: "Rate Provided", value: status.rate_provided },
            { label: "Application Status", value: status.application_status },
            { label: "Credentials Added to QMS", value: status.credentials_added_to_qms ? "Yes" : "No" },
            { label: "Process Street Run ID", value: status.ps_new_merchant_run_id },
          ]}
        />
        {unlinkError && (
          <p role="alert" className="text-sm text-red-400">
            {unlinkError}
          </p>
        )}

        {/* Confirmed per-facility, not per-company (2026-09-03) -- Prairie
            Enterprises' 3 real facilities each answered these differently
            on their own separate New Merchant Account runs, so there is no
            single company-wide figure to show on the Company page instead. */}
        <DetailSection
          title="Financials"
          fields={[
            { label: "EIN", value: status.financials.ein },
            { label: "Bank Routing Number", value: status.financials.bank_routing_number_masked },
            { label: "Bank Account Number", value: status.financials.bank_account_number_masked },
            { label: "Total Annual Business Revenue", value: status.financials.total_annual_business_revenue_raw },
            { label: "Total Monthly Sales", value: status.financials.total_monthly_sales_raw },
            { label: "Offers ACH", value: status.financials.offers_ach_raw },
            {
              label: "Annual Electronic Check (ACH) Volume",
              value: status.financials.annual_electronic_check_volume_raw,
            },
            {
              label: "Average Electronic Check Amount",
              value: status.financials.average_electronic_check_amount_raw,
            },
            {
              label: "Maximum Electronic Check Amount",
              value: status.financials.maximum_electronic_check_amount_raw,
            },
            {
              label: "Average Credit Card Payment Amount",
              value: status.financials.average_credit_card_payment_amount_raw,
            },
            {
              label: "Highest Credit Card Payment Amount",
              value: status.financials.highest_credit_card_payment_amount_raw,
            },
            {
              label: "# Times Per Year for the High CC Payment",
              value: status.financials.high_cc_payment_times_per_year_raw,
            },
          ]}
        />

        <section className="rounded border border-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold">Owner(s) / Signer</h2>
          {status.parties.length === 0 ? (
            <p className="text-sm text-slate-500">None on file.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {status.parties.map((party, index) => (
                <PartyCard key={index} party={party} badge={party.party_role} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Unlinked -- a single suggested candidate, several ambiguous ones
  // (a real duplicate submission on the PS side -- see the backend's
  // own module doc), or nothing; any of the three still ends with
  // manual entry below.
  return (
    <div className="flex flex-col gap-6">
      {status.candidate ? (
        <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
          <h2 className="mb-2 text-lg font-semibold">New Merchant Account Flow Found</h2>
          <p className="mb-4 text-sm text-slate-300">
            <a
              href={`https://app.process.st/runs/${status.candidate.merchant_account_run_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-400 hover:underline"
            >
              {status.candidate.run_name}
            </a>
            <br />
            <span className="text-slate-500">Process Street run ID: {status.candidate.merchant_account_run_id}</span>
          </p>
          <p className="mb-4 text-sm text-slate-400">
            Click through and confirm it&apos;s the right one before linking -- this isn&apos;t confirmed
            automatically.
          </p>
          <button
            type="button"
            onClick={() => handleLink(status.candidate!.merchant_account_run_id)}
            disabled={linking}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {linking ? "Linking…" : "Confirm this link"}
          </button>
        </section>
      ) : status.ambiguous_candidates.length > 0 ? (
        <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
          <h2 className="mb-2 text-lg font-semibold">Multiple Possible Matches Found</h2>
          <p className="mb-4 text-sm text-slate-400">
            More than one Merchant Account run&apos;s name matches this facility -- likely a duplicate submission in
            Process Street. Click through each to confirm which is the right one before linking.
          </p>
          <div className="flex flex-col gap-3">
            {status.ambiguous_candidates.map((candidate) => (
              <div
                key={candidate.merchant_account_run_id}
                className="flex items-center justify-between gap-3 rounded border border-slate-800 p-3"
              >
                <div className="text-sm">
                  <a
                    href={`https://app.process.st/runs/${candidate.merchant_account_run_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-400 hover:underline"
                  >
                    {candidate.run_name}
                  </a>
                  <div className="text-slate-500">
                    {candidate.merchant_account_run_id} · updated {formatDateOnly(candidate.updated_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLink(candidate.merchant_account_run_id)}
                  disabled={linking}
                  className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linking ? "Linking…" : "Link this one"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          No Merchant Account run automatically matched to this facility. If you know its Process Street run ID,
          enter it below to link it manually.
        </p>
      )}

      <section className="rounded border border-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold">Link Manually</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualRunId}
            onChange={(e) => setManualRunId(e.target.value)}
            placeholder="Process Street run ID"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={() => handleLink(manualRunId)}
            disabled={linking || !manualRunId.trim()}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linking ? "Linking…" : "Link"}
          </button>
        </div>
        {linkError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {linkError}
          </p>
        )}
      </section>
    </div>
  );
}

export default function FacilityDetailPage() {
  const { clientId, facilityId } = useParams<{ clientId: string; facilityId: string }>();
  const { company, loadError: companyLoadError } = useCompanyDetail();

  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [policies, setPolicies] = useState<FacilityPolicies | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");

  // Re-fetches just the policies -- passed to each split Fees/Taxes/
  // Delinquency/Coverage/Specials tab as `onSaved`, so a save reflects
  // its own (possibly just-flagged-exempt) fresh state immediately
  // without a full page reload.
  async function loadPolicies() {
    const result = await getFacilityPolicies(clientId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setPolicies(result.data);
  }

  // Same idea as `loadPolicies` above, for the DropBox tab's own save.
  async function loadFacility() {
    const result = await getFacilityDetail(clientId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setFacility(result.data);
  }

  // Company data comes from the shared `CompanyDetailProvider` (fetched
  // once per company, not per facility -- see that module's own doc
  // comment). Only the facility-specific reads re-fetch here, on
  // `facilityId` alone.
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      // Reset here (inside the effect's async callback, not
      // synchronously in the effect body) per the
      // `react-hooks/set-state-in-effect` rule.
      if (cancelled) return;
      setFacility(null);
      setPolicies(null);
      setLoadError(null);

      const [facilityResult, policiesResult] = await Promise.all([
        getFacilityDetail(clientId, facilityId),
        getFacilityPolicies(clientId, facilityId),
      ]);

      if (cancelled) return;
      if (facilityResult.kind !== "ok") {
        setLoadError(facilityResult.message);
        return;
      }
      if (policiesResult.kind !== "ok") {
        setLoadError(policiesResult.message);
        return;
      }

      setLoadError(null);
      setFacility(facilityResult.data);
      setPolicies(policiesResult.data);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, facilityId]);

  const effectiveLoadError = companyLoadError ?? loadError;

  if (effectiveLoadError) {
    return (
      <main className="p-8">
        <p role="alert" className="text-sm text-red-400">
          {effectiveLoadError}
        </p>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="p-8">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  // The rail (and company data behind it) is already loaded by this
  // point -- only the facility-specific content below needs its own
  // "Loading…" state while switching facilities, so the rail and page
  // chrome stay put instead of the whole page blanking out.
  return (
    <main className="p-8">
      <div className="mx-auto flex max-w-6xl gap-8">
        <FacilityRail companyId={clientId} facilities={company.facilities} activeFacilityId={facilityId} />

        {!facility || !policies ? (
          <div className="flex flex-1 flex-col gap-6">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold">{facility.name}</h1>
              <FieldReferenceHelp />
            </div>

            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={tabButtonClass(tab === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "general" && <GeneralTab facility={facility} />}
            {tab === "fees" && (
              <FeesTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "taxes" && (
              <TaxesTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "delinquency" && (
              <DelinquencyTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "coverage" && (
              <CoverageTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "specials" && (
              <SpecialsTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "elavon" && <ElavonTab companyId={clientId} facilityId={facilityId} />}
            {tab === "users" && <UsersTab companyId={clientId} facilityId={facilityId} />}
            {tab === "dropbox" && (
              <DropboxTab
                companyId={clientId}
                facilityId={facilityId}
                dropboxFolderUrl={facility.dropbox_folder_url}
                onSaved={loadFacility}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
