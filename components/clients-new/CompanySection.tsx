import type { MappedCompany } from "@/lib/clientsImport";
import { formatPhone } from "@/lib/format";
import { COMPANY_FIELDS } from "./clientsNewHelpers";

interface CompanySectionProps {
  company: MappedCompany;
  editing: boolean;
  onFieldChange: (key: keyof MappedCompany, value: string) => void;
}

/**
 * The Review & Create page's own Company section -- one shared record
 * across every selected facility, seeded from whichever run
 * `pickCompanySourceRun` chose. Extracted verbatim out of the page,
 * which still owns `company`/`editing` state (edits here flow back up
 * through `onFieldChange`).
 */
export function CompanySection({ company, editing, onFieldChange }: CompanySectionProps) {
  return (
    <section className="rounded border border-blue-800 bg-blue-950/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{company.legal_name || "Company"}</h2>
        <span className="rounded bg-blue-900/60 px-2 py-1 text-xs uppercase tracking-wide text-blue-300">
          Company
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMPANY_FIELDS.map((field) => {
          const value = company[field.key];
          const displayValue =
            field.key === "corporate_phone" && typeof value === "string" ? formatPhone(value) : value;
          return (
            <div key={field.key} className="flex flex-col gap-1 text-sm">
              <dt className="text-slate-400">{field.label}</dt>
              {editing ? (
                <input
                  type="text"
                  value={value ?? ""}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              ) : (
                <dd className="break-words">{displayValue || "—"}</dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
