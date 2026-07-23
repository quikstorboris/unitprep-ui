import type { DedupReportView } from "@/types/api";

interface DedupSummaryStatsProps {
  report: DedupReportView;
}

const STATS: Array<{
  label: string;
  value: (
    report: DedupReportView
  ) => number;
}> = [
  {
    label: "Total Rows",
    value: (r) => r.total_rows,
  },
  {
    label: "Unique Tenants",
    value: (r) => r.unique_tenants,
  },
  {
    label: "Multi-Unit Tenants",
    value: (r) => r.multi_unit_tenants,
  },
  {
    label: "Flagged Groups",
    value: (r) => r.flagged_groups.length,
  },
  {
    label: "Typo Variants",
    value: (r) =>
      r.typo_variant_candidates.length,
  },
  {
    label: "Related Tenants",
    value: (r) =>
      r.related_tenant_candidates
        .length,
  },
];

export default function DedupSummaryStats({
  report,
}: DedupSummaryStatsProps) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {STATS.map(
        ({ label, value }) => (
          <div
            key={label}
            className="rounded border border-slate-700 p-4"
          >
            <div className="text-sm text-slate-400">
              {label}
            </div>

            <div className="text-2xl font-bold">
              {value(report)}
            </div>
          </div>
        )
      )}
    </div>
  );
}
