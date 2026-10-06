"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { ElavonStatusCell } from "@/components/clients/ElavonStatusCell";
import { getCompanyOnboardingSummary, type FacilityOnboardingSummary } from "@/lib/clientsDetail";

/**
 * Onboarding Summary tab -- Company page's per-facility rollup, added
 * alongside General (2026-09-23). One row per facility: where its
 * Elavon application stands, and how many Dedup checks it has on
 * record (linking straight to that facility's own Onboarding Work tab
 * for the detail).
 */
export default function OnboardingSummaryPage() {
  const { clientId } = useParams<{ clientId: string }>();

  const [facilities, setFacilities] = useState<FacilityOnboardingSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setFacilities(null);
      setLoadError(null);

      const result = await getCompanyOnboardingSummary(clientId);
      if (cancelled) return;

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setFacilities(result.data.facilities);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loadError) {
    return (
      <main className="p-8">
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      </main>
    );
  }

  if (!facilities) {
    return (
      <main className="p-8">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-bold">Onboarding Summary</h1>

        {facilities.length === 0 ? (
          <p className="text-sm text-slate-500">No facilities on this company yet.</p>
        ) : (
          <div className="overflow-hidden rounded border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Elavon Status</th>
                  <th className="px-4 py-3 font-medium">Duplicate Checks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {facilities.map((facility) => (
                  <tr key={facility.facility_id}>
                    <td className="px-4 py-3 text-slate-100">{facility.facility_name}</td>
                    <td className="px-4 py-3">
                      <ElavonStatusCell facility={facility} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${clientId}/facilities/${facility.facility_id}?tab=onboarding_work`}
                        className="text-blue-400 hover:underline"
                      >
                        {facility.duplicate_checks_completed}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
