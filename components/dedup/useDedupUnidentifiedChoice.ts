"use client";

import { useCallback, useState } from "react";

import { setDedupUnidentifiedMode } from "@/lib/dedupUnidentified";
import type { DedupReportView, UnidentifiedMode } from "@/types/api";

interface UseDedupUnidentifiedChoiceResult {
  /** The report returned by the last successful choice, or `null` until
   * the user has made one (the page keeps showing its original report). */
  updatedReport: DedupReportView | null;
  busy: boolean;
  error: string | null;
  sessionExpired: boolean;
  choose: (mode: UnidentifiedMode) => Promise<void>;
}

/**
 * The user's choice for tenants with no customer id on the live results
 * page. A failure leaves the page's current report in place.
 */
export function useDedupUnidentifiedChoice(sessionId: string): UseDedupUnidentifiedChoiceResult {
  const [updatedReport, setUpdatedReport] = useState<DedupReportView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const choose = useCallback(
    async (mode: UnidentifiedMode) => {
      setBusy(true);
      setError(null);

      const result = await setDedupUnidentifiedMode(sessionId, mode);

      setBusy(false);

      if (result.kind === "ok") {
        setUpdatedReport(result.data.report);
        return;
      }

      // The session can have expired while the page sat open.
      if (result.kind === "error" && /session/i.test(result.message) && /not found|expired/i.test(result.message)) {
        setSessionExpired(true);
        return;
      }

      setError(result.message);
    },
    [sessionId]
  );

  return { updatedReport, busy, error, sessionExpired, choose };
}
