"use client";

import { LinkedElavonView } from "./elavon/LinkedElavonView";
import { UnlinkedElavonView } from "./elavon/UnlinkedElavonView";
import { useElavonTab } from "./elavon/useElavonTab";

/**
 * Elavon tab -- Phase 4 item 5. Fetched on its own, lazily, only once
 * this tab is actually selected (not alongside General/Facility
 * Policies on every facility switch) -- it's the least-visited tab day
 * to day, and eagerly fetching it on every click would work against
 * the same pool-exhaustion latency fix this page just got (see
 * `unitprep-api`'s `db.rs` doc comment).
 */
export function ElavonTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const tab = useElavonTab(companyId, facilityId);
  const { status } = tab;

  if (tab.loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {tab.loadError}
      </p>
    );
  }

  if (!status) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  if (status.status === "linked") {
    return (
      <LinkedElavonView
        status={status}
        resyncing={tab.resyncing}
        resyncError={tab.resyncError}
        onResync={tab.handleResync}
        confirmingUnlink={tab.confirmingUnlink}
        setConfirmingUnlink={tab.setConfirmingUnlink}
        unlinking={tab.unlinking}
        unlinkError={tab.unlinkError}
        onUnlink={tab.handleUnlink}
      />
    );
  }

  return (
    <UnlinkedElavonView
      status={status}
      manualRunId={tab.manualRunId}
      setManualRunId={tab.setManualRunId}
      linking={tab.linking}
      linkError={tab.linkError}
      onLink={tab.handleLink}
    />
  );
}
