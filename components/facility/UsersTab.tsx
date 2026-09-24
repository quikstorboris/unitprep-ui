"use client";

import { AddPersonManuallyForm } from "@/components/facility/users/AddPersonManuallyForm";
import { CandidateChipsSection } from "@/components/facility/users/CandidateChipsSection";
import { RosterTable } from "@/components/facility/users/RosterTable";
import { candidateKey } from "@/components/facility/users/personRoster";
import { useFacilityUsers } from "@/components/facility/users/useFacilityUsers";

/**
 * Users tab -- Phase 4 item 4. `candidates` are already-indexed rows off
 * this facility's own Process Street Intake run
 * (`clients.ps_person_index`, refreshed nightly, independent of when the
 * facility was created) -- no search box, no live PS call, just chips.
 * A not-yet-linked candidate's chip adds them; an already-linked one's
 * chip renders red and unlinks them instead (2026-09-04, Boris's own
 * call) -- the self-heal `addFacilityPerson` used to do on that same
 * click now happens automatically every time the tab loads instead (see
 * `getFacilityPeople`'s own backend doc comment), precisely so this
 * click was free to mean something else.
 *
 * 2026-09-08: every roster row now has a Source (Process Street or
 * Manual) and an Edit action. A manually-added person (its own "+ Add
 * Person Manually" form below) is permanently exempt from the self-heal
 * pass. Editing a Process Street person offers a choice, right at edit
 * time, to protect that edit the same way -- otherwise the next self-heal
 * pass can silently revert it back to whatever the index says.
 *
 * 2026-09-08: "already linked" is matched by (email, role, full_name),
 * not just (email, role) -- real Dubuqueland data has several distinct
 * people (Barb Soppe, Carrie Krueger, Chad Soppe) sharing one family
 * inbox with the same role. Matching without name collapsed them: once
 * one was linked, the others' chips showed red too even though they
 * weren't on the roster, and clicking one would have unlinked the wrong
 * person (whoever the email+role match actually resolved to).
 *
 * All state and actions (load, edit, remove, manual add, chip
 * link/unlink) live in `useFacilityUsers`; the roster table, the manual
 * add form, and the candidate-chip section are each their own component
 * under `components/facility/users/` -- this file is just the
 * composition shell wiring them together.
 */
export function UsersTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const users = useFacilityUsers(companyId, facilityId);

  if (users.loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {users.loadError}
      </p>
    );
  }

  if (!users.people) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  // Keyed by (email, role, full_name) -- how a candidate chip finds the
  // roster row it corresponds to, since a candidate off ps_person_index
  // carries no person_id of its own. Full name has to be part of the key,
  // not just email+role: real Dubuqueland data has several distinct
  // people (Barb Soppe, Carrie Krueger, Chad Soppe) sharing one family
  // inbox with the same role. Matching on email+role alone would make
  // all of them resolve to whichever one is actually on the roster.
  const rosterByEmailAndRole = new Map(
    users.people.roster.filter((person) => !!person.email).map((person) => [candidateKey(person), person])
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-slate-800 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Users</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                users.setAddingManually((prev) => !prev);
                users.setManualError(null);
              }}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              + Add Person Manually
            </button>
            {users.people.roster.length > 0 && (
              <button
                type="button"
                onClick={users.handleCopyAll}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                {users.copied ? "Copied!" : "Copy All"}
              </button>
            )}
          </div>
        </div>

        {users.addingManually && (
          <AddPersonManuallyForm
            form={users.manualForm}
            saving={users.manualSaving}
            error={users.manualError}
            onFormChange={users.setManualForm}
            onSubmit={users.submitManualAdd}
            onCancel={() => users.setAddingManually(false)}
          />
        )}

        {users.people.roster.length === 0 ? (
          <p className="text-sm text-slate-500">No users linked to this facility yet.</p>
        ) : (
          <RosterTable
            roster={users.people.roster}
            pendingKey={users.pendingKey}
            editingKey={users.editingKey}
            editForm={users.editForm}
            editProtect={users.editProtect}
            editSaving={users.editSaving}
            editError={users.editError}
            onStartEdit={users.startEdit}
            onCancelEdit={users.cancelEdit}
            onEditFormChange={users.setEditForm}
            onEditProtectChange={users.setEditProtect}
            onSaveEdit={users.saveEdit}
            onRemove={users.handleRemoveFromRoster}
          />
        )}
      </section>

      <CandidateChipsSection
        candidates={users.people.candidates}
        rosterByEmailAndRole={rosterByEmailAndRole}
        pendingKey={users.pendingKey}
        actionError={users.actionError}
        onChipClick={users.handleChipClick}
      />
    </div>
  );
}
