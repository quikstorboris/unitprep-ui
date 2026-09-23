"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getCompanyOnboardingSummary, type FacilityOnboardingSummary } from "@/lib/clientsDetail";

/**
 * Elavon Status cell -- the next outstanding step in this facility's
 * Merchant Account Process Street workflow, per `elavon_next_step`
 * (already resolved server-side to the first incomplete task at or
 * before "Add Credentials to QMS" in PS checklist order -- see
 * `clients_onboarding_summary`'s own module doc for why the walk stops
 * there rather than at the run's actual last task). `elavon_linked`
 * disambiguates the two cases that both leave `elavon_next_step`
 * empty: never started vs. every step through QMS credentials done.
 * `elavon_awaiting_credentials` flags the one remaining step that's a
 * manual, out-of-PS action -- worth a nudge there, since nothing about
 * the PS application itself completes it. The same reminder repeats
 * under "Complete" (2026-09-24, Boris) -- "Complete" here only means
 * PS's own checklist says the credentials step is checked off, not
 * that OO has independently verified someone actually did it in QMS,
 * so the nudge belongs at both the "still pending" and "PS says done"
 * points, not just the first.
 */
function ElavonStatusCell({ facility }: { facility: FacilityOnboardingSummary }) {
  if (!facility.elavon_linked) {
    return <span className="text-slate-500">Not Started</span>;
  }

  if (facility.elavon_next_step) {
    return (
      <div>
        <span className="text-slate-200">{facility.elavon_next_step}</span>
        {facility.elavon_awaiting_credentials && (
          <p className="mt-0.5 text-xs text-amber-400">Be sure to add credentials to QMS.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <span className="text-green-400">Complete</span>
      <p className="mt-0.5 text-xs text-slate-500">Be sure to add credentials to QMS.</p>
    </div>
  );
}

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
