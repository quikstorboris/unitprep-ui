import type { AnalyzeResponse } from "@/types/api";

interface SummaryStatsProps {
  analysis: AnalyzeResponse;
}

const STATS: Array<{
  label: string;
  value: (
    analysis: AnalyzeResponse
  ) => number;
}> = [
  {
    label: "Facilities",
    value: (a) => a.facilities,
  },
  {
    label: "Global Groups",
    value: (a) => a.global_groups,
  },
  {
    label: "Net New",
    value: (a) => a.net_new_groups,
  },
  {
    label: "Similar",
    value: (a) => a.similar_groups,
  },
  {
    label: "Advisory",
    value: (a) => a.advisory_issues,
  },
];

export default function SummaryStats({
  analysis,
}: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
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
              {value(analysis)}
            </div>
          </div>
        )
      )}
    </div>
  );
}
