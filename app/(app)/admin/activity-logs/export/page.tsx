"use client";

import LogExportPage, {
  type LogExportColumn,
  type LogExportParams,
} from "@/components/audit/LogExportPage";
import {
  exportActivityLogsPdf,
  previewActivityLogsExport,
  type ActivityLogPreviewRow,
} from "@/lib/activity-log";
import { useActivityLogFilterData } from "@/lib/useActivityLogFilterData";

const columns: LogExportColumn<ActivityLogPreviewRow>[] = [
  {
    header: "Time",
    cell: (row) => row.created_at,
    className: "whitespace-nowrap font-mono text-xs text-slate-400",
  },
  { header: "Event", cell: (row) => row.event_type, className: "text-slate-200" },
  { header: "User", cell: (row) => row.actor_label, className: "text-xs text-slate-300" },
  { header: "Entity", cell: (row) => row.target_label, className: "text-xs text-slate-300" },
  { header: "Details", cell: (row) => row.details, className: "text-xs text-slate-400" },
];

// The activity log filters on the acting user only, so the shared page's
// `userIds` is sent as `actorUserIds`.
const request = ({ userIds, ...rest }: LogExportParams) => ({ ...rest, actorUserIds: userIds });

const preview = (params: LogExportParams) => previewActivityLogsExport(request(params));
const exportPdf = (params: LogExportParams) => exportActivityLogsPdf(request(params));

/** Export page for the activity log: the shared export page with its own
 * wording, columns and API calls. */
export default function ActivityLogExportPage() {
  const { selectedActorIds, setSelectedActorIds, ...rest } = useActivityLogFilterData();

  return (
    <LogExportPage
      permission="activity_logs.read"
      backHref="/admin/activity-logs"
      backLabel="Back to Activity Logs"
      title="Export Activity Log"
      description="A formal PDF report of matching activity. Date range is required; every other filter is optional."
      userLabel="User"
      fallbackFileName="unitprep-activity-log.pdf"
      filterData={{ ...rest, selectedUserIds: selectedActorIds, setSelectedUserIds: setSelectedActorIds }}
      columns={columns}
      preview={preview}
      exportPdf={exportPdf}
    />
  );
}
