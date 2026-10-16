"use client";

import { useState } from "react";

import { updateCompanyInfo } from "@/lib/clientsCompanies";
import type { CompanyInfoFields } from "@/types/generated/CompanyInfoFields";

const FIELDS: {
  key: keyof CompanyInfoFields;
  label: string;
  section: "Company" | "Financial";
}[] = [
  { key: "legal_name", label: "Legal Name", section: "Company" },
  { key: "corporate_email", label: "Email", section: "Company" },
  { key: "corporate_phone", label: "Phone", section: "Company" },
  {
    key: "corporate_address_street",
    label: "Street Address",
    section: "Company",
  },
  { key: "corporate_address_city", label: "City", section: "Company" },
  { key: "corporate_address_state", label: "State", section: "Company" },
  { key: "corporate_address_zip", label: "ZIP", section: "Company" },
  { key: "subdomain", label: "Subdomain", section: "Company" },
  { key: "website_url", label: "Website", section: "Company" },
  {
    key: "accepted_payment_methods",
    label: "Accepted Payment Methods",
    section: "Financial",
  },
  { key: "accounting_basis", label: "Accounting Basis", section: "Financial" },
  { key: "payment_scheme", label: "Payment Scheme", section: "Financial" },
  {
    key: "offers_tenant_insurance_raw",
    label: "Offers Tenant Insurance",
    section: "Financial",
  },
  {
    key: "insurance_provider",
    label: "Insurance Provider",
    section: "Financial",
  },
];

/**
 * Edit form for the company's own information (Company + Financial
 * sections of the company page). Saved values are protected from being
 * overwritten by the next Process Street sync, field by field -- see the
 * backend `clients_company_edit` module doc.
 */
export default function CompanyInfoForm({
  companyId,
  initial,
  onSaved,
  onCancel,
}: {
  companyId: string;
  initial: CompanyInfoFields;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CompanyInfoFields>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!values.legal_name?.trim()) {
      setError("A company needs a name.");
      return;
    }
    setSaving(true);
    setError(null);

    const result = await updateCompanyInfo(companyId, values);

    setSaving(false);
    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      {(["Company", "Financial"] as const).map((section) => (
        <section key={section} className="rounded border border-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold">{section} Information</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.filter((field) => field.section === section).map(
              (field) => (
                <label key={field.key} className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">{field.label}</span>
                  <input
                    type="text"
                    value={values[field.key] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                    className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100"
                  />
                </label>
              ),
            )}
          </div>
        </section>
      ))}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
