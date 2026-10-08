"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import UserMultiSelect from "@/components/audit/UserMultiSelect";
import RequirePermission from "@/components/auth/RequirePermission";
import MultiSelectDropdown from "@/components/shared/MultiSelectDropdown";
import type { FileDownloadResult } from "@/lib/auth-shared";
import { resolveEventTypeFilter } from "@/lib/eventTypeFilter";
import type { ApiResult } from "@/lib/http";
import { useLatestRequest } from "@/lib/useLatestRequest";
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
// horizontal row of fields: a horizontal flex row aligned by items-end
// broke the moment the User field grew taller than its neighbors (its
// chips push the input down but not the sibling fields), leaving
// everything visually misaligned. A vertical stack has no such coupling
// -- each row's height is its own.
const filterLabelClass = "w-40 shrink-0 text-sm text-slate-300";

const linkButtonClass = "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

// Debounces the live preview -- every filter change (including each
// keystroke in an extra text filter) would otherwise fire its own request.
const PREVIEW_DEBOUNCE_MS = 350;

/** The filters every log export shares; a page's own extra filter is
 * baked into the `preview` / `exportPdf` functions it passes in. */
export interface LogExportParams {
  dateFrom: string;
  dateTo: string;
  /** `undefined` means "every event type". */
  eventTypes: string[] | undefined;
  /** `undefined` means "any user". */
  userIds: string[] | undefined;
}

/** What `useAuditLogFilterData` / `useActivityLogFilterData` provide, under
 * one name. */
export interface LogExportFilterData {
  allEventTypes: string[];
  selectedEventTypes: string[];
  setSelectedEventTypes: (selected: string[]) => void;
  noEventsSelected: boolean;
  allUsers: Parameters<typeof UserMultiSelect>[0]["users"];
  selectedUserIds: string[];
  setSelectedUserIds: (selected: string[]) => void;
  filterDataError: string | null;
}

export interface LogExportColumn<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
  /** Extra classes for the `<td>` (the base padding is always applied). */
  className?: string;
}

interface LogExportPageProps<Row extends { id: string | number }> {
  permission: string;
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  /** Label of the user filter ("User", "User (actor or target)"). */
  userLabel: string;
  /** The file name used when the response names none. */
  fallbackFileName: string;
  filterData: LogExportFilterData;
  /** An extra filter control, rendered after the user filter. Its value
   * lives in the page; changing it must change the identity of `preview`
   * and `exportPdf` (wrap them in `useCallback`) so the preview refreshes. */
  extraFilters?: ReactNode;
  columns: LogExportColumn<Row>[];
  preview: (params: LogExportParams, signal: AbortSignal) => Promise<ApiResult<{ rows: Row[]; truncated: boolean }>>;
  exportPdf: (params: LogExportParams) => Promise<FileDownloadResult>;
}

/**
 * The export-a-log page both the Security Log and the Activity Log use: a
 * required date range, event-type and user filters (and, for the security
 * log, an IP filter), a live preview of what the PDF will contain, and the
 * export button. The two pages differ only in their permission, wording,
 * filter-data hook, extra filter, preview columns and API calls -- all of
 * which they pass in here.
 */
export default function LogExportPage<Row extends { id: string | number }>({
  permission,
  backHref,
  backLabel,
  title,
  description,
  userLabel,
  fallbackFileName,
  filterData,
  extraFilters,
  columns,
  preview,
  exportPdf,
}: LogExportPageProps<Row>) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    selectedUserIds,
    setSelectedUserIds,
    filterDataError,
  } = filterData;

  const [previewRows, setPreviewRows] = useState<Row[]>([]);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const beginPreviewRequest = useLatestRequest();

  const dateRangeSet = dateFrom !== "" && dateTo !== "";

  const params = useCallback(
    (): LogExportParams => ({
      dateFrom,
      dateTo,
      eventTypes: resolveEventTypeFilter(selectedEventTypes, allEventTypes),
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
    }),
    [dateFrom, dateTo, selectedEventTypes, allEventTypes, selectedUserIds],
  );

  const runPreview = useCallback(async () => {
    if (!dateRangeSet || noEventsSelected) {
      setPreviewRows([]);
      setPreviewTruncated(false);
      setPreviewError(null);
      return;
    }

    // A newer filter change aborts this request; its answer must not land.
    const signal = beginPreviewRequest();
    setPreviewLoading(true);
    const result = await preview(params(), signal);
    if (signal.aborted) return;
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
  }, [dateRangeSet, noEventsSelected, beginPreviewRequest, preview, params]);

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

    const result = await exportPdf(params());
    setExporting(false);

    if (result.kind !== "ok") {
      setExportError(result.message);
      return;
    }

    const blob = await result.response.blob();
    downloadBlob(blob, result.response.headers.get("Content-Disposition"), fallbackFileName);
  }

  const exportDisabled = !dateRangeSet || noEventsSelected || exporting;
  const exportTitle = !dateRangeSet
    ? "Select a date range to export"
    : noEventsSelected
      ? "Select at least one event type to export"
      : undefined;

  const exportButton = (
    <button
      type="button"
      disabled={exportDisabled}
      title={exportTitle}
      onClick={handleExport}
      className={primaryButtonClass}
    >
      {exporting ? "Exporting…" : "Export PDF"}
    </button>
  );

  return (
    <RequirePermission permission={permission}>
      <div className="flex-1 p-8">
        <div className="mb-6">
          <Link href={backHref} className={linkButtonClass}>
            ← {backLabel}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
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
            <MultiSelectDropdown
              options={allEventTypes.map((eventType) => ({ value: eventType, label: eventType }))}
              selected={selectedEventTypes}
              onChange={setSelectedEventTypes}
              noun="events"
              className="w-64"
            />
          </div>

          {/* items-start, not items-center: the label sits beside the
              input specifically, not vertically centered against the
              chip row that grows underneath it. */}
          <div className="flex items-start gap-3">
            <span className={`${filterLabelClass} pt-2`}>{userLabel}</span>
            <UserMultiSelect
              users={allUsers}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
              className="w-72"
            />
          </div>

          {extraFilters}

          <div className="flex items-center gap-3">
            <span className={filterLabelClass} aria-hidden="true" />
            {exportButton}
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
                  {columns.map((column) => (
                    <th key={column.header} className="px-4 py-2 font-medium">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    {columns.map((column) => (
                      <td key={column.header} className={`px-4 py-2 ${column.className ?? ""}`}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">{exportButton}</div>
      </div>
    </RequirePermission>
  );
}

export { inputClass as logExportInputClass, filterLabelClass as logExportLabelClass };
