import { formatUnits } from "@/lib/format";
import type {
  DuplicateTenantView,
  DuplicateCustomerRecordView,
  FieldCategory,
} from "@/types/api";

interface DuplicateCustomerRecordsSectionProps {
  /** Optional: reports cached before this finding existed lack it. */
  records?: DuplicateCustomerRecordView[];
}

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  Phone: "phone number",
  Email: "email",
  Address: "address",
  AltContact: "alternate contact",
  Company: "company",
  Name: "name",
};

function tenantPhrase(tenant: DuplicateTenantView): string {
  return tenant.units.length === 0
    ? `ID ${tenant.tenant_id}`
    : `ID ${tenant.tenant_id} — ${formatUnits(tenant.units)}`;
}

function ContactBadge({ categories }: { categories: FieldCategory[] }) {
  if (categories.length === 0) {
    return <span className="text-green-400">Contact details match</span>;
  }
  return (
    <span className="text-yellow-400">
      Also differs:{" "}
      {categories.map((category) => CATEGORY_LABELS[category]).join(", ")}
    </span>
  );
}

export default function DuplicateCustomerRecordsSection({
  records,
}: DuplicateCustomerRecordsSectionProps) {
  if (!records || records.length === 0) {
    return null;
  }

  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Possible duplicate customer records ({records.length})
      </summary>

      <div className="mt-4">
        <p className="mb-3 text-sm text-slate-400">
          One person recorded under more than one customer ID. These usually
          agree on every contact field, so they would never appear as a
          mismatch.
        </p>

        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800">
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Customer IDs</th>
                <th className="p-3 text-left">Contact Info</th>
                <th className="p-3 text-left">Note</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record, index) => (
                <tr
                  key={`${record.display_name}-${index}`}
                  className="border-t border-slate-800"
                >
                  <td className="p-3">{record.display_name}</td>

                  <td className="p-3">
                    <ul className="space-y-1">
                      {record.tenants.map((tenant) => (
                        <li key={tenant.tenant_id}>{tenantPhrase(tenant)}</li>
                      ))}
                    </ul>
                  </td>

                  <td className="p-3">
                    <ContactBadge categories={record.differing_categories} />
                  </td>

                  <td className="p-3">{record.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
