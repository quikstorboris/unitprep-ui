import AdvisoryIssuesTable from "@/components/export/AdvisoryIssuesTable";
import NetNewGroupsTable from "@/components/export/NetNewGroupsTable";
import SimilarGroupsTable from "@/components/export/SimilarGroupsTable";
import SummaryStats from "@/components/export/SummaryStats";
import type { UnitGroupRunSummary } from "@/types/api";

/** A Unit Groups run's analysis: which files it read, the headline
 * counts, and the same tables the export step shows. */
export function UnitGroupRunDetails({
  summary,
}: {
  summary: UnitGroupRunSummary;
}) {
  return (
    <>
      <div className="space-y-1 text-sm text-slate-300">
        <div>
          <span className="text-slate-500">Unit files: </span>
          {summary.unit_files.length > 0
            ? summary.unit_files.join(", ")
            : "none recorded"}
        </div>
        <div>
          <span className="text-slate-500">Master group file: </span>
          {summary.group_file ?? "none (every group counts as new)"}
        </div>
      </div>

      <SummaryStats analysis={summary} />

      <div className="space-y-6">
        <NetNewGroupsTable groups={summary.net_new_group_details} />
        <SimilarGroupsTable matches={summary.similar_group_details} />
        <AdvisoryIssuesTable issues={summary.advisory_issue_details} />
      </div>
    </>
  );
}
