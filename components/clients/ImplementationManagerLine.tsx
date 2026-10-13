import type { StaffRef } from "@/types/generated/StaffRef";

/**
 * "Implementation manager: John Doe" under the company page's title row.
 * The manager is the Process Street Intake's conductor, matched to the OO
 * user with that email; a conductor with no OO account (or no answer)
 * leaves it unassigned.
 */
export default function ImplementationManagerLine({ manager }: { manager: StaffRef | null }) {
  return (
    <p className="-mt-3 text-sm text-slate-300">
      <span className="text-slate-500">Implementation manager:</span>{" "}
      {manager ? manager.name : <span className="text-slate-500">Not assigned</span>}
    </p>
  );
}
