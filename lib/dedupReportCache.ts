import type { DedupReportView } from "@/types/api";

/**
 * Bridges a dedup report from DedupUploadPage (which already has it, as
 * part of POST /dedup/check's response) across the client-side
 * navigation to /clients/[clientId]/dedup/[sessionId], whose page mounts
 * fresh and would otherwise re-fetch the identical report via
 * POST /dedup/report a moment later -- a second full round trip
 * (network, a fresh AuthenticatedUser session resolution on the backend,
 * the server re-deriving the same view) for data already in hand.
 *
 * Single-slot, single-use (read-and-clear) rather than a general cache:
 * only one check-then-navigate flow is ever in flight per browser tab,
 * and clearing on read means a later direct visit or refresh of the same
 * URL correctly falls back to the network instead of serving a
 * (potentially stale) cached copy indefinitely.
 */
let pending: { sessionId: string; report: DedupReportView } | null = null;

export function stashDedupReport(
  sessionId: string,
  report: DedupReportView
): void {
  pending = { sessionId, report };
}

/**
 * Read-and-clear. Returns `undefined` on a miss -- no report staged, or
 * staged for a different sessionId (e.g. a direct navigation/refresh
 * that never went through DedupUploadPage at all).
 */
export function takeDedupReport(
  sessionId: string
): DedupReportView | undefined {
  if (pending?.sessionId !== sessionId) {
    return undefined;
  }

  const { report } = pending;
  pending = null;
  return report;
}
