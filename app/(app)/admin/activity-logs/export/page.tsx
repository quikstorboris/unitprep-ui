"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import {
  exportActivityLogsPdf,
  previewActivityLogsExport,
  type ActivityLogPreviewRow,
} from "@/lib/activity-log";
import { useActivityLogFilterData } from "@/lib/useActivityLogFilterData";
import { downloadBlob } from "@/lib/useSessionAction";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const dateInputClass = `${inputClass} [color-scheme:dark]`;

const filterLabelClass = "w-40 shrink-0 text-sm text-slate-300";

const linkButtonClass = "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

const PREVIEW_DEBOUNCE_MS = 350;

export default function ActivityLogExportPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    selectedActorIds,
    setSelectedActorIds,
    filterDataError,
  } = useActivityLogFilterData();

  const [previewRows, setPreviewRows] = useState<ActivityLogPreviewRow[]>([]);
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
    const result = await previewActivityLogsExport({
      dateFrom,
      dateTo,
      eventTypes: selectedEventTypes.length === allEventTypes.length ? undefined : selectedEventTypes,
      actorUserIds: selectedActorIds.length > 0 ? selectedActorIds : undefined,
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
  }, [dateFrom, dateTo, dateRangeSet, noEventsSelected, allEventTypes, selectedEventTypes, selectedActorIds]);

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

    const result = await exportActivityLogsPdf({
      dateFrom,
      dateTo,
      eventTypes: selectedEventTypes.length === allEventTypes.length ? undefined : selectedEventTypes,
      actorUserIds: selectedActorIds.length > 0 ? selectedActorIds : undefined,
    });
    setExporting(false);

    if (result.kind !== "ok") {
      setExportError(result.message);
      return;
    }

    const blob = await result.response.blob();
    downloadBlob(blob, result.response.headers.get("Content-Disposition"), "unitprep-activity-log.pdf");
  }

  const exportDisabled = !dateRangeSet || noEventsSelected || exporting;
  const exportTitle = !dateRangeSet
    ? "Select a date range to export"
    : noEventsSelected
      ? "Select at least one event type to export"
      : undefined;

  return (
    <RequirePermission permission="activity_logs.read">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <Link href="/admin/activity-logs" className={linkButtonClass}>
            ← Back to Activity Logs
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">Export Activity Log</h1>
          <p className="mt-1 text-sm text-slate-400">
            A formal PDF report of matching activity. Date range is required; every other filter is optional.
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

          <div className="flex items-start gap-3">
            <span className={`${filterLabelClass} pt-2`}>User</span>
            <UserMultiSelect
              users={allUsers}
              selected={selectedActorIds}
              onChange={setSelectedActorIds}
              className="w-72"
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

        {filterDataError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {filterDataError}
          </p>
        )}

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
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-400">
                      {row.created_at}
                    </td>
                    <td className="px-4 py-2 text-slate-200">{row.event_type}</td>
                    <td className="px-4 py-2 text-xs text-slate-300">{row.actor_label}</td>
                    <td className="px-4 py-2 text-xs text-slate-300">{row.target_label}</td>
                    <td className="px-4 py-2 text-xs text-slate-400">{row.details}</td>
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
