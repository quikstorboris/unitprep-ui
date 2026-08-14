"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import {
  exportAuditLogsPdf,
  previewAuditLogsExport,
  type AuditLogPreviewRow,
} from "@/lib/auth-audit";
import { useAuditLogFilterData } from "@/lib/useAuditLogFilterData";
import { downloadBlob } from "@/lib/useSessionAction";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

// `color-scheme` is the only lever a browser exposes over a native
// <input type="date">'s popup calendar -- there's no CSS selector into it
// otherwise. This switches it to the browser's own dark rendering (a
// distinct gray from this page's slate palette, not a match for it, so
// the popup stays visible against the page rather than blending in).
const dateInputClass = `${inputClass} [color-scheme:dark]`;

// Every filter row shares this label width so the controls themselves
// start at one consistent left edge -- deliberately not a single
// horizontal row of fields (the previous layout): a horizontal flex row
// aligned by items-end broke the moment the User field grew taller than
// its neighbors (its chips push the input down but not the sibling
// fields), leaving everything visually misaligned. A vertical stack has
// no such coupling -- each row's height is its own.
const filterLabelClass = "w-40 shrink-0 text-sm text-slate-300";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

// Debounces the live preview -- every filter change (including each
// keystroke in the IP field) would otherwise fire its own request.
const PREVIEW_DEBOUNCE_MS = 350;

export default function AuditLogExportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Canonical event-type list, Users list, and the live filter
  // selections -- shared with the inline Audit Logs page, which fetches/
  // manages the exact same data.
  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    selectedUserIds,
    setSelectedUserIds,
  } = useAuditLogFilterData();

  const [ipAddress, setIpAddress] = useState("");

  const [previewRows, setPreviewRows] = useState<AuditLogPreviewRow[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const dateRangeSet = dateFrom !== "" && dateTo !== "";

  const runPreview = useCallback(async () => {
    if (!dateRangeSet || noEventsSelected) {
      setPreviewRows([]);
      setPreviewTruncated(false);
      setPreviewError(null);
      return;
    }

    setPreviewLoading(true);
    const result = await previewAuditLogsExport({
      dateFrom,
      dateTo,
      eventTypes:
        selectedEventTypes.length === allEventTypes.length
          ? undefined
          : selectedEventTypes,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      ipAddress: ipAddress.trim() || undefined,
    });
    setPreviewLoading(false);

    if (result.kind !== "ok") {
      setPreviewError(result.message);
      setPreviewRows([]);
      setPreviewTruncated(false);
      return;
    }

    setPreviewError(null);
    setPreviewRows(result.data.rows);
    setPreviewTruncated(result.data.truncated);
  }, [
    dateFrom,
    dateTo,
    dateRangeSet,
    noEventsSelected,
    allEventTypes,
    selectedEventTypes,
    selectedUserIds,
    ipAddress,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      runPreview();
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [runPreview]);

  async function handleExport() {
    if (!dateRangeSet || noEventsSelected) return;

    setExportError(null);
    setExporting(true);

    const result = await exportAuditLogsPdf({
      dateFrom,
      dateTo,
      eventTypes:
        selectedEventTypes.length === allEventTypes.length
          ? undefined
          : selectedEventTypes,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      ipAddress: ipAddress.trim() || undefined,
    });
    setExporting(false);

    if (result.kind !== "ok") {
      setExportError(result.message);
      return;
    }

    const blob = await result.response.blob();
    downloadBlob(
      blob,
      result.response.headers.get("Content-Disposition"),
      "unitprep-audit-log.pdf"
    );
  }

  const exportDisabled = !dateRangeSet || noEventsSelected || exporting;
  const exportTitle = !dateRangeSet
    ? "Select a date range to export"
    : noEventsSelected
      ? "Select at least one event type to export"
      : undefined;

  return (
    <RequirePermission permission="audit_logs.read">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <Link href="/admin/audit-logs" className={linkButtonClass}>
            ← Back to Audit Logs
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">
            Export Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            A formal PDF report of matching events. Date range is required;
            every other filter is optional.
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className={filterLabelClass}>Date range</span>
            <input
              type="date"
              required
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              className={dateInputClass}
            />
            <span className="text-sm text-slate-500">to</span>
            <input
              type="date"
              required
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              className={dateInputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className={filterLabelClass}>Event type</span>
            <EventTypeMultiSelect
              allEventTypes={allEventTypes}
              selected={selectedEventTypes}
              onChange={setSelectedEventTypes}
              className="w-64"
            />
          </div>

          {/* items-start, not items-center: the label sits beside the
              input specifically, not vertically centered against the
              chip row that grows underneath it. */}
          <div className="flex items-start gap-3">
            <span className={`${filterLabelClass} pt-2`}>
              User (actor or target)
            </span>
            <UserMultiSelect
              users={allUsers}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
              className="w-72"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className={filterLabelClass}>IP address</span>
            <input
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
              placeholder="e.g. 203.0.113.1"
              className={`${inputClass} w-40 font-mono text-xs`}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className={filterLabelClass} aria-hidden="true" />
            <button
              type="button"
              disabled={exportDisabled}
              title={exportTitle}
              onClick={handleExport}
              className={primaryButtonClass}
            >
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        </div>

        {exportError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {exportError}
          </p>
        )}

        <div className="mb-2 text-sm text-slate-400">
          {!dateRangeSet
            ? "Select a date range to see a preview."
            : previewLoading
              ? "Loading preview…"
              : `Preview: ${previewRows.length}${previewTruncated ? "+" : ""} matching event${previewRows.length === 1 ? "" : "s"}${previewTruncated ? " (showing the first batch -- narrow your filters to see fewer)" : ""}.`}
        </div>

        {previewError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {previewError}
          </p>
        )}

        {dateRangeSet && !previewLoading && previewRows.length > 0 && (
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-400">
                      {row.created_at}
                    </td>
                    <td className="px-4 py-2 text-slate-200">
                      {row.event_type}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-300">
                      {row.actor_label}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-300">
                      {row.target_label}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {row.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {row.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={exportDisabled}
            title={exportTitle}
            onClick={handleExport}
            className={primaryButtonClass}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>
    </RequirePermission>
  );
}
