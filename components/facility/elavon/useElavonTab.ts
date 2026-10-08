"use client";

import { useCallback, useEffect, useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import {
  getFacilityElavon,
  linkFacilityElavon,
  resyncElavonData,
  unlinkFacilityElavon,
  type ElavonStatus,
} from "@/lib/clientsDetail";

/** A mutation's busy flag + last error, so the three actions share one shape. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { busy, setBusy, error, setError };
}

/**
 * State and actions for the Elavon tab: the status load plus link,
 * unlink and resync. After each successful mutation the tab reloads
 * its own status AND refetches the company, so a newly-linked
 * facility's Elavon/Owner data shows up on the Company page too without
 * a full reload -- that page's own `elavon_active`/`owners` are
 * computed across the company's facilities, and its data only comes
 * from `CompanyDetailProvider` (fetched once per company).
 */
export function useElavonTab(companyId: string, facilityId: string) {
  const { refetch: refetchCompany } = useCompanyDetail();

  const [status, setStatus] = useState<ElavonStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualRunId, setManualRunId] = useState("");
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const link = useAction();
  const unlink = useAction();
  const resync = useAction();
  const { setError: setLinkError } = link;
  const { setError: setUnlinkError } = unlink;
  const { setError: setResyncError } = resync;

  const load = useCallback(async () => {
    const result = await getFacilityElavon(companyId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setStatus(result.data);
  }, [companyId, facilityId]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setStatus(null);
      setLoadError(null);
      setLinkError(null);
      setManualRunId("");
      setConfirmingUnlink(false);
      setUnlinkError(null);
      setResyncError(null);
      await load();
    });

    return () => {
      cancelled = true;
    };
  }, [load, setLinkError, setUnlinkError, setResyncError]);

  async function handleLink(runId: string) {
    const trimmed = runId.trim();
    if (!trimmed) return;

    link.setBusy(true);
    link.setError(null);
    const result = await linkFacilityElavon(companyId, facilityId, trimmed);
    link.setBusy(false);

    if (result.kind !== "ok") {
      link.setError(result.message);
      return;
    }
    await load();
    refetchCompany();
  }

  async function handleUnlink() {
    unlink.setBusy(true);
    unlink.setError(null);
    const result = await unlinkFacilityElavon(companyId, facilityId);
    unlink.setBusy(false);

    if (result.kind !== "ok") {
      unlink.setError(result.message);
      return;
    }
    setConfirmingUnlink(false);
    await load();
    refetchCompany();
  }

  async function handleResync() {
    resync.setBusy(true);
    resync.setError(null);
    const result = await resyncElavonData(companyId, facilityId);
    resync.setBusy(false);

    if (result.kind !== "ok") {
      resync.setError(result.message);
      return;
    }
    await load();
    refetchCompany();
  }

  return {
    status,
    loadError,
    manualRunId,
    setManualRunId,
    confirmingUnlink,
    setConfirmingUnlink,
    linking: link.busy,
    linkError: link.error,
    unlinking: unlink.busy,
    unlinkError: unlink.error,
    resyncing: resync.busy,
    resyncError: resync.error,
    handleLink,
    handleUnlink,
    handleResync,
  };
}
