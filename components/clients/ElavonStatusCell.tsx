import type { FacilityOnboardingSummary } from "@/lib/clientsDetail";

/**
 * Elavon Status cell of the Onboarding Summary. Two separate questions
 * (2026-10-06, Boris):
 *
 * - **Complete** depends only on the credentials step of the facility's
 *   Merchant Account run -- `elavon_complete`, true once every visible
 *   task mapped to that role (Process Street settings > Task mapping:
 *   "Document Credentials" on new runs, "Add Credentials to QMS" on
 *   older ones) is Completed. An earlier step left open does not stop
 *   it reading Complete.
 * - **Otherwise** the cell shows the earliest incomplete visible step,
 *   `elavon_next_step` (resolved server-side, capped at the credentials
 *   step -- see `clients_onboarding_summary`'s module doc).
 *
 * `elavon_linked` separates "never started" from the rest.
 * `elavon_awaiting_credentials` flags that the pending step is the
 * manual, out-of-PS credentials step -- worth a nudge. The same reminder
 * repeats under "Complete" (2026-09-24, Boris): "Complete" only means
 * PS's checklist says the step is checked off, not that OO verified
 * anyone actually did it in QMS.
 */
export function ElavonStatusCell({ facility }: { facility: FacilityOnboardingSummary }) {
  if (!facility.elavon_linked) {
    return <span className="text-slate-500">Not Started</span>;
  }

  if (facility.elavon_complete) {
    return (
      <div>
        <span className="text-green-400">Complete</span>
        <p className="mt-0.5 text-xs text-slate-500">Be sure to add credentials to QMS.</p>
      </div>
    );
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

  // Linked, nothing outstanding, but no credentials step found on the
  // run either (neither complete nor pending) -- show the neutral
  // started state rather than claiming Complete.
  return <span className="text-slate-400">In progress</span>;
}
