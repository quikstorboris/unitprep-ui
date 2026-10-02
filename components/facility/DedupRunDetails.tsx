"use client";

import { useState } from "react";

import DedupSummaryStats from "@/components/dedup/DedupSummaryStats";
import DuplicateCustomerRecordsSection from "@/components/dedup/DuplicateCustomerRecordsSection";
import FlaggedGroupsSection from "@/components/dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "@/components/dedup/RelatedTenantsSection";
import TypoVariantsSection from "@/components/dedup/TypoVariantsSection";
import UnidentifiedTenantsSection from "@/components/dedup/UnidentifiedTenantsSection";
import { hasPermission } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";
import { rematchToolRun } from "@/lib/dedupUnidentified";
import type { DedupReportView, UnidentifiedMode } from "@/types/api";

const noIssuesFound = (report: DedupReportView) =>
  report.flagged_groups.length === 0 &&
  (report.duplicate_customer_records?.length ?? 0) === 0 &&
  report.typo_variant_candidates.length === 0 &&
  report.related_tenant_candidates.length === 0;

/** A Duplicate Check run's results, with the re-check for tenants that
 * had no customer id. */
export function DedupRunDetails({
  companyId,
  facilityId,
  runId,
  initialReport,
  canRematchRun,
}: {
  companyId: string;
  facilityId: string;
  runId: string;
  initialReport: DedupReportView;
  /** The run kept what a re-check needs. */
  canRematchRun: boolean;
}) {
  const { user } = useCurrentUser();
  // Starts as the stored report; a re-check replaces it in place.
  const [report, setReport] = useState<DedupReportView>(initialReport);
  const [rematching, setRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);

  // Re-checking rewrites the run's stored report and output file, so it
  // takes client_ops.perform, and the run must have kept what it needs.
  const canRematch = canRematchRun && hasPermission(user, "client_ops.perform");

  const handleRematch = async (mode: UnidentifiedMode) => {
    setRematching(true);
    setRematchError(null);

    const result = await rematchToolRun(companyId, facilityId, runId, mode);

    setRematching(false);
    if (result.kind === "ok") {
      setReport(result.data.report);
    } else {
      setRematchError(result.message);
    }
  };

  return (
    <>
      <DedupSummaryStats report={report} />

      {noIssuesFound(report) && !report.unidentified ? (
        <div className="rounded bg-green-900 p-4 text-green-200">
          ✅ No duplicate tenants or name variants found across{" "}
          {report.unique_tenants} unique tenants.
        </div>
      ) : (
        <div className="space-y-6">
          <FlaggedGroupsSection groups={report.flagged_groups} />
          <DuplicateCustomerRecordsSection
            records={report.duplicate_customer_records}
          />
          <TypoVariantsSection candidates={report.typo_variant_candidates} />
          <RelatedTenantsSection
            candidates={report.related_tenant_candidates}
          />
        </div>
      )}

      <UnidentifiedTenantsSection
        section={report.unidentified}
        onChoose={canRematch ? handleRematch : undefined}
        busy={rematching}
        error={rematchError}
      />
    </>
  );
}
