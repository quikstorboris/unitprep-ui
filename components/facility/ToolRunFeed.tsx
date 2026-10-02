"use client";

import { useCallback, useState } from "react";

import { RunCard } from "@/components/facility/RunCard";
import { listFacilityToolRuns } from "@/lib/clientsDetail";
import {
  useInfiniteLogFeed,
  type LogFeedResult,
} from "@/lib/useInfiniteLogFeed";
import type { ToolRunSummary } from "@/types/api";

const PAGE_SIZE = 20;

/**
 * One activity's recorded runs, newest first (the API returns them in
 * reverse chronological order and pages backwards from the newest), built
 * on the same generic `useInfiniteLogFeed` pagination hook Security Logs/
 * Activity Logs already use.
 */
export function ToolRunFeed({
  companyId,
  facilityId,
  tool,
  emptyMessage,
}: {
  companyId: string;
  facilityId: string;
  tool: ToolRunSummary["tool"];
  emptyMessage: string;
}) {
  const query = useCallback(
    async (beforeId?: string): Promise<LogFeedResult<ToolRunSummary>> => {
      const result = await listFacilityToolRuns(companyId, facilityId, {
        tool,
        limit: PAGE_SIZE,
        beforeId,
      });

      if (result.kind !== "ok")
        return { kind: "error", message: result.message };
      return { kind: "ok", entries: result.data.runs };
    },
    [companyId, facilityId, tool],
  );

  const { entries, loading, loadingMore, loadError, exhausted, sentinelRef } =
    useInfiniteLogFeed(query, (run) => run.id, PAGE_SIZE);

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
      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="space-y-3">
            {visibleEntries.map((run) => (
              <RunCard
                key={run.id}
                companyId={companyId}
                facilityId={facilityId}
                run={run}
                onDeleted={handleDeleted}
              />
            ))}
          </div>

          {exhausted ? (
            <p className="text-center text-xs text-slate-500">End of results</p>
          ) : (
            <div ref={sentinelRef} className="h-4">
              {loadingMore && (
                <p className="text-center text-xs text-slate-500">Loading…</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
