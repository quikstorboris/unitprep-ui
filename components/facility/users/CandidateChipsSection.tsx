"use client";

import type { FacilityPerson, PersonAssignment } from "@/lib/clientsDetail";
import { ROLE_LABELS, candidateKey } from "./personRoster";

interface CandidateChipsSectionProps {
  candidates: PersonAssignment[];
  rosterByEmailAndRole: Map<string, FacilityPerson>;
  pendingKey: string | null;
  actionError: string | null;
  onChipClick: (candidate: PersonAssignment, linkedPersonId: string | null) => void;
}

/**
 * UsersTab's own "Add User" section -- chips pulled from this
 * facility's Process Street Intake run (`clients.ps_person_index`). A
 * not-yet-linked candidate's chip adds them; an already-linked one's
 * chip renders red and unlinks them instead (see UsersTab's own doc
 * comment for the full history behind that click behavior).
 */
export function CandidateChipsSection({
  candidates,
  rosterByEmailAndRole,
  pendingKey,
  actionError,
  onChipClick,
}: CandidateChipsSectionProps) {
  return (
    <section className="rounded border border-slate-800 p-5">
      <h2 className="mb-2 text-lg font-semibold">Add User</h2>
      <p className="mb-1 text-sm text-slate-400">
        Pulled from this facility&apos;s own Process Street Intake run, kept up to date automatically. A red chip
        is already linked -- click it to unlink.
      </p>
      <p className="mb-4 text-sm text-slate-500">
        To correct a name, email, phone, or role, edit it in Process Street -- it&apos;ll show up here
        automatically next time this tab loads. (Or use the roster&apos;s own Edit button above, with the
        protection option, for a quicker one-off fix.)
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-slate-500">No Process Street contacts found for this facility.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => {
            const key = candidateKey(candidate);
            const linkedPerson = candidate.email ? rosterByEmailAndRole.get(key) : undefined;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onChipClick(candidate, linkedPerson?.person_id ?? null)}
                disabled={pendingKey === key}
                title={linkedPerson ? `Unlink ${candidate.full_name}` : (candidate.email ?? undefined)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  linkedPerson
                    ? "border-red-900 bg-red-950/20 text-red-300 hover:bg-red-950/40"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {linkedPerson ? "✕ " : "+ "}
                {candidate.full_name}
                <span className="ml-1.5 text-xs text-slate-400">
                  ({ROLE_LABELS[candidate.role] ?? candidate.role})
                </span>
              </button>
            );
          })}
        </div>
      )}
      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {actionError}
        </p>
      )}
    </section>
  );
}
