"use client";

import { useCallback, useState } from "react";

import DedupSummaryStats from "@/components/dedup/DedupSummaryStats";
import FlaggedGroupsSection from "@/components/dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "@/components/dedup/RelatedTenantsSection";
import TypoVariantsSection from "@/components/dedup/TypoVariantsSection";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import { downloadToolRunOutput, downloadToolRunSource } from "@/components/facility/useToolRunOutputDownload";
import { deleteToolRun, listFacilityToolRuns } from "@/lib/clientsDetail";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";
import { useInfiniteLogFeed, type LogFeedResult } from "@/lib/useInfiniteLogFeed";
import type { ToolRunSummary } from "@/types/api";

const PAGE_SIZE = 20;

/**
 * Tool-display metadata, keyed by `ToolRunSummary.tool` -- today only
 * `"dedup"` is ever written (`client_ops.tool_runs`'s own `tool` CHECK
 * constraint), but keeping this a lookup rather than hardcoding
 * "Duplicate Check" everywhere means Unit Groups/Template Tagger only
 * need an entry here, not a rewrite of this file, once they start
 * writing their own run rows.
 */
const TOOL_LABELS: Record<string, string> = {
  dedup: "Duplicate Check",
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

function ordinal(n: number): string {
  const remainder10 = n % 10;
  const remainder100 = n % 100;
  if (remainder10 === 1 && remainder100 !== 11) return `${n}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${n}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function actorLabel(run: ToolRunSummary): string {
  const name = [run.actor_first_name, run.actor_last_name].filter(Boolean).join(" ").trim();
  return name || run.actor_email || "Unknown user";
}

const noIssuesFound = (report: ToolRunSummary["report_summary"]) =>
  report.flagged_groups.length === 0 &&
  report.typo_variant_candidates.length === 0 &&
  report.related_tenant_candidates.length === 0;

function RunOutputAction({
  companyId,
  facilityId,
  run,
}: {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (run.output_kind === "none") return null;

  if (run.output_kind === "dropbox") {
    const path = run.output_dropbox_path;
    if (!path) return null;

    return (
      <a
        href={dropboxFolderWebUrl(dropboxParentFolder(path))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded bg-[#0061FF] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0050d1]"
      >
        <DropboxLogo className="h-3.5 w-3.5" />
        Open in Dropbox
      </a>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    const result = await downloadToolRunOutput(
      companyId,
      facilityId,
      run.id,
      `${toolLabel(run.tool).toLowerCase().replace(/\s+/g, "_")}.csv`
    );

    setDownloading(false);
    if (result.kind !== "ok") setError(result.message);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="w-fit rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? "Downloading…" : "Download Output"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function RunSourceAction({
  companyId,
  facilityId,
  run,
}: {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!run.has_source_file) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    const result = await downloadToolRunSource(companyId, facilityId, run.id, run.source_file_name);

    setDownloading(false);
    if (result.kind !== "ok") setError(result.message);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="text-xs font-medium text-blue-400 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? "Downloading…" : "Download Source File"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/**
 * "Clear a mistaken run" action -- e.g. a Dedup check accidentally run
 * against the wrong facility's data (2026-09-23). Permanent, so it goes
 * through the same click-to-confirm shape `ElavonTab`'s own Unlink
 * button already uses, rather than a single click.
 */
function DeleteRunButton({
  companyId,
  facilityId,
  run,
  onDeleted,
}: {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
  onDeleted: (runId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    const result = await deleteToolRun(companyId, facilityId, run.id);

    setDeleting(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    onDeleted(run.id);
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400">Delete this run permanently?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
    >
      Delete
    </button>
  );
}

function RunCard({
  companyId,
  facilityId,
  run,
  onDeleted,
}: {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
  onDeleted: (runId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const report = run.report_summary;

  return (
    <div className="rounded border border-slate-800">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="font-semibold text-slate-100">
            {ordinal(run.sequence_number)} {toolLabel(run.tool)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {actorLabel(run)} &middot; {new Date(run.created_at).toLocaleString()}
          </div>
        </div>
        <span className="text-xs text-slate-500">{expanded ? "Collapse" : "Expand"}</span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-800 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500">Source: </span>
              {run.source_dropbox_path ? (
                <a
                  href={dropboxFolderWebUrl(run.source_dropbox_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {run.source_file_name}
                </a>
              ) : (
                <span className="text-slate-300">{run.source_file_name}</span>
              )}
            </div>
            <RunSourceAction companyId={companyId} facilityId={facilityId} run={run} />
            <RunOutputAction companyId={companyId} facilityId={facilityId} run={run} />
            <div className="ml-auto">
              <DeleteRunButton companyId={companyId} facilityId={facilityId} run={run} onDeleted={onDeleted} />
            </div>
          </div>

          <DedupSummaryStats report={report} />

          {noIssuesFound(report) ? (
            <div className="rounded bg-green-900 p-4 text-green-200">
              ✅ No duplicate tenants or name variants found across {report.unique_tenants} unique tenants.
            </div>
          ) : (
            <div className="space-y-6">
              <FlaggedGroupsSection groups={report.flagged_groups} />
              <TypoVariantsSection candidates={report.typo_variant_candidates} />
              <RelatedTenantsSection candidates={report.related_tenant_candidates} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Onboarding Work tab -- a facility's history of past tool runs,
 * starting with Dedup only (Unit Groups/Template Tagger recording their
 * own runs is deferred work). Built on the same generic
 * `useInfiniteLogFeed` pagination hook Security Logs/Activity Logs
 * already use.
 */
export function OnboardingWorkTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const query = useCallback(
    async (beforeId?: string): Promise<LogFeedResult<ToolRunSummary>> => {
      const result = await listFacilityToolRuns(companyId, facilityId, {
        tool: "dedup",
        limit: PAGE_SIZE,
        beforeId,
      });

      if (result.kind !== "ok") return { kind: "error", message: result.message };
      return { kind: "ok", entries: result.data.runs };
    },
    [companyId, facilityId]
  );

  const { entries, loading, loadingMore, loadError, exhausted, sentinelRef } = useInfiniteLogFeed(
    query,
    (run) => run.id,
    PAGE_SIZE
  );

  // Client-side only -- `useInfiniteLogFeed` is shared with Security/
  // Activity Logs and has no removal API of its own, so a deleted run
  // is just hidden from the already-fetched page rather than plumbed
  // back through the hook's fetch/cursor state, which a delete doesn't
  // otherwise need to disturb.
  const [deletedRunIds, setDeletedRunIds] = useState<Set<string>>(new Set());
  const visibleEntries = entries.filter((run) => !deletedRunIds.has(run.id));

  const handleDeleted = useCallback((runId: string) => {
    setDeletedRunIds((current) => new Set(current).add(runId));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Onboarding Work</h2>

      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No tool runs recorded for this facility yet.</p>
      ) : (
        <>
          <div className="space-y-3">
            {visibleEntries.map((run) => (
              <RunCard key={run.id} companyId={companyId} facilityId={facilityId} run={run} onDeleted={handleDeleted} />
            ))}
          </div>

          {exhausted ? (
            <p className="text-center text-xs text-slate-500">End of results</p>
          ) : (
            <div ref={sentinelRef} className="h-4">
              {loadingMore && <p className="text-center text-xs text-slate-500">Loading…</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
