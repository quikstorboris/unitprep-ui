"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import DetailSection from "@/components/clients/DetailSection";
import FacilityRail from "@/components/clients/FacilityRail";
import FieldReferenceHelp from "@/components/clients/FieldReferenceHelp";
import PartyCard from "@/components/clients/PartyCard";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import {
  addFacilityPerson,
  getFacilityDetail,
  getFacilityElavon,
  getFacilityPeople,
  getFacilityPolicies,
  linkFacilityElavon,
  unlinkFacilityElavon,
  unlinkFacilityPerson,
  updateFacilityCoverage,
  updateFacilityDelinquency,
  updateFacilityFees,
  updateFacilitySpecials,
  updateFacilityTaxes,
  type CommissionRow,
  type CoverageTierRow,
  type DelinquencyStepRow,
  type ElavonStatus,
  type FacilityDetail,
  type FacilityPeople,
  type FacilityPerson,
  type FacilityPolicies,
  type FeeRow,
  type PersonAssignment,
  type TaxesRow,
} from "@/lib/clientsDetail";
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

const TAX_FIELD_LABELS: { key: keyof TaxesRow; label: string }[] = [
  { key: "sales_tax_applies_raw", label: "Sales Tax Applies" },
  { key: "sales_tax_rate_raw", label: "Sales Tax Rate" },
  { key: "rent_tax_applies_raw", label: "Rent Tax Applies" },
  { key: "rent_tax_rate_raw", label: "Rent Tax Rate" },
  { key: "rent_tax_applies_to_all_units_raw", label: "Rent Tax Applies to All Units" },
  { key: "other_one_time_taxes_raw", label: "Other One-Time Taxes" },
  { key: "other_recurring_taxes_raw", label: "Other Recurring Taxes" },
];

const EMPTY_TAXES: TaxesRow = {
  sales_tax_applies_raw: null,
  sales_tax_rate_raw: null,
  rent_tax_applies_raw: null,
  rent_tax_rate_raw: null,
  rent_tax_applies_to_all_units_raw: null,
  other_one_time_taxes_raw: null,
  other_recurring_taxes_raw: null,
};

function TaxesTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaxesRow>(EMPTY_TAXES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = !policies.taxes;

  function startEdit() {
    setForm(policies.taxes ?? EMPTY_TAXES);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const result = await updateFacilityTaxes(companyId, facilityId, form);

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
        isEmpty ? (
          <p className="text-sm text-slate-500">No tax data captured for this facility yet.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TAX_FIELD_LABELS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1 text-sm">
                <dt className="text-slate-400">{label}</dt>
                <dd>{policies.taxes?.[key] || "—"}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TAX_FIELD_LABELS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-slate-400">{label}</span>
              <input
                type="text"
                value={form[key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
          ))}
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

function DelinquencyTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DelinquencyStepRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = policies.delinquency_steps.length === 0;

  function startEdit() {
    setRows(
      policies.delinquency_steps.length > 0
        ? policies.delinquency_steps.map((step) => ({ ...step }))
        : [{ step_order: 1, step_type: "other", raw_value: "" }]
    );
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const cleaned = rows
      .filter((row) => row.raw_value.trim() !== "")
      .map((row, index) => ({ ...row, step_order: index + 1 }));
    const result = await updateFacilityDelinquency(companyId, facilityId, cleaned);

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setEditing(false);
    await onSaved();
  }

  function updateRow(index: number, patch: Partial<DelinquencyStepRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
        isEmpty ? (
          <p className="text-sm text-slate-500">No delinquency steps captured for this facility yet.</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {policies.delinquency_steps.map((step) => (
              <li key={step.step_order} className="flex gap-3">
                <span className="w-24 shrink-0 text-slate-400">{STEP_TYPE_LABELS[step.step_type] ?? step.step_type}</span>
                <span>{step.raw_value}</span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={row.step_type}
                onChange={(e) => updateRow(index, { step_type: e.target.value })}
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
            onClick={() => setRows((prev) => [...prev, { step_order: prev.length + 1, step_type: "other", raw_value: "" }])}
            className="w-fit rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            + Add Step
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

function SpecialsTab({ companyId, facilityId, policies, onSaved }: PolicyTabProps) {
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = !policies.specials_raw_text;

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
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={8}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
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
function formatRosterForClipboard(roster: FacilityPerson[]): string {
  return roster
    .map((person) => [person.full_name, person.phone ? formatPhone(person.phone) : null, person.email]
      .filter((line): line is string => !!line)
      .join("\n"))
    .join("\n\n");
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
 */
function UsersTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const [people, setPeople] = useState<FacilityPeople | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      : await addFacilityPerson(companyId, facilityId, candidate);

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
                  <th className="pb-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {people.roster.map((person) => (
                  <tr key={`${person.person_id}-${person.role}`} className="border-t border-slate-800">
                    <td className="py-2 pr-4">{person.full_name}</td>
                    <td className="py-2 pr-4 text-slate-400">{person.email ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-400">{person.phone ? formatPhone(person.phone) : "—"}</td>
                    <td className="py-2">
                      <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
                        {ROLE_LABELS[person.role] ?? person.role}
                      </span>
                    </td>
                  </tr>
                ))}
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
          automatically next time this tab loads.
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
      <div className="mx-auto flex max-w-5xl gap-8">
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
              <p className="text-sm text-slate-500">
                This tab isn&apos;t built yet -- coming in a later pass of Phase 4.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
