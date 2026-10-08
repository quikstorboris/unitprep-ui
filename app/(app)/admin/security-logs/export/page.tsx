"use client";

import { useCallback, useState } from "react";

import LogExportPage, {
  logExportInputClass,
  logExportLabelClass,
  type LogExportColumn,
  type LogExportParams,
} from "@/components/audit/LogExportPage";
import {
  exportAuditLogsPdf,
  previewAuditLogsExport,
  type AuditLogPreviewRow,
} from "@/lib/auth-audit";
import { useAuditLogFilterData } from "@/lib/useAuditLogFilterData";

const columns: LogExportColumn<AuditLogPreviewRow>[] = [
  {
    header: "Time",
    cell: (row) => row.created_at,
    className: "whitespace-nowrap font-mono text-xs text-slate-400",
  },
  { header: "Event", cell: (row) => row.event_type, className: "text-slate-200" },
  { header: "Actor", cell: (row) => row.actor_label, className: "text-xs text-slate-300" },
  { header: "Target", cell: (row) => row.target_label, className: "text-xs text-slate-300" },
  { header: "IP", cell: (row) => row.ip_address ?? "—", className: "font-mono text-xs text-slate-500" },
  { header: "Details", cell: (row) => row.details, className: "text-xs text-slate-400" },
];

/** Export page for the security (audit) log: the shared export page plus an
 * IP-address filter. */
export default function SecurityLogExportPage() {
  // Canonical event-type list, Users list, and the live filter
  // selections -- shared with the inline Security Logs page, which fetches/
  // manages the exact same data.
  const filterData = useAuditLogFilterData();
  const [ipAddress, setIpAddress] = useState("");

  const request = useCallback(
    (params: LogExportParams) => ({ ...params, ipAddress: ipAddress.trim() || undefined }),
    [ipAddress],
  );

  const preview = useCallback(
    (params: LogExportParams) => previewAuditLogsExport(request(params)),
    [request],
  );
  const exportPdf = useCallback((params: LogExportParams) => exportAuditLogsPdf(request(params)), [request]);

  return (
    <LogExportPage
      permission="audit_logs.read"
      backHref="/admin/security-logs"
      backLabel="Back to Security Logs"
      title="Export Security Log"
      description="A formal PDF report of matching events. Date range is required; every other filter is optional."
      userLabel="User (actor or target)"
      fallbackFileName="unitprep-security-log.pdf"
      filterData={filterData}
      extraFilters={
        <div className="flex items-center gap-3">
          <span className={logExportLabelClass}>IP address</span>
          <input
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder="e.g. 203.0.113.1"
            className={`${logExportInputClass} w-40 font-mono text-xs`}
          />
        </div>
      }
      columns={columns}
      preview={preview}
      exportPdf={exportPdf}
    />
  );
}
