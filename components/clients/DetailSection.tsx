/**
 * Read-only label/value grid, one per Company/Facility page section --
 * shared shape for Company Information, Financial Information,
 * Facility General, etc. Display only for now; the vault's "global edit
 * convention" (per-section Edit button) is real future work, sequenced
 * after read access exists to build against.
 */
export interface DetailField {
  label: string;
  value: string | number | null | undefined;
}

export default function DetailSection({
  title,
  fields,
  action,
}: {
  title: string;
  fields: DetailField[];
  /** e.g. a Re-sync button, rendered top-right of the section heading. */
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded border border-slate-800 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-1 text-sm">
            <dt className="text-slate-400">{field.label}</dt>
            <dd>{field.value === null || field.value === undefined || field.value === "" ? "—" : field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
