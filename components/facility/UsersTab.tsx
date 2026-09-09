"use client";

import { useEffect, useState } from "react";

import {
  addFacilityPerson,
  editFacilityPerson,
  getFacilityPeople,
  unlinkFacilityPerson,
  type FacilityPeople,
  type FacilityPerson,
  type PersonAssignment,
} from "@/lib/clientsDetail";
import { formatPhone } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  district_manager: "District Manager",
  manager: "Manager",
};

/** Section heading per role, in the fixed order Boris asked for --
 * Owner(s), District Manager(s), Manager(s) -- not alphabetical or
 * table order, and skipped entirely when this facility has none of
 * that role. */
const ROLE_CLIPBOARD_HEADINGS: { role: string; heading: string }[] = [
  { role: "owner", heading: "Owner(s):" },
  { role: "district_manager", heading: "District Manager(s):" },
  { role: "manager", heading: "Manager(s):" },
];

/**
 * Formats the roster for "Copy All" -- one person per paragraph, name
 * then phone then email (each only if present), blank line between
 * people. Plain text, not CSV/markdown -- meant to be pasted straight
 * into an email or a PS field, not parsed back.
 */
function formatRosterForClipboard(roster: FacilityPerson[]): string {
  return ROLE_CLIPBOARD_HEADINGS.filter(({ role }) => roster.some((person) => person.role === role))
    .map(({ role, heading }) => {
      const people = roster
        .filter((person) => person.role === role)
        .map((person) =>
          [person.full_name, person.phone ? formatPhone(person.phone) : null, person.email]
            .filter((line): line is string => !!line)
            .join("\n")
        )
        .join("\n\n");
      return `${heading}\n\n${people}`;
    })
    .join("\n\n\n");
}

const SOURCE_LABELS: Record<string, string> = {
  process_street: "Process Street",
  manual: "Manual",
};

interface PersonFormState {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

function emptyPersonForm(): PersonFormState {
  return { full_name: "", email: "", phone: "", role: "manager" };
}

function personFormToAssignment(form: PersonFormState): PersonAssignment {
  return {
    full_name: form.full_name,
    email: form.email.trim() === "" ? null : form.email,
    phone: form.phone.trim() === "" ? null : form.phone,
    role: form.role,
  };
}

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
 */
function candidateKey(person: { full_name: string; email: string | null; role: string }): string {
  return `${(person.email ?? "").toLowerCase()}:${person.role}:${person.full_name.trim().toLowerCase()}`;
}

export function UsersTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  const [people, setPeople] = useState<FacilityPeople | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PersonFormState>(emptyPersonForm());
  const [editProtect, setEditProtect] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [addingManually, setAddingManually] = useState(false);
  const [manualForm, setManualForm] = useState<PersonFormState>(emptyPersonForm());
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function load() {
    const result = await getFacilityPeople(companyId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setPeople(result.data);
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setPeople(null);
      setLoadError(null);
      setActionError(null);
      setCopied(false);
      setEditingKey(null);
      setAddingManually(false);
      await load();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is stable in shape; only re-run on facility change
  }, [companyId, facilityId]);

  async function handleChipClick(candidate: PersonAssignment, linkedPersonId: string | null) {
    const key = candidateKey(candidate);
    setPendingKey(key);
    setActionError(null);

    const result = linkedPersonId
      ? await unlinkFacilityPerson(companyId, facilityId, linkedPersonId, candidate.role)
      : await addFacilityPerson(companyId, facilityId, candidate, "process_street");

    setPendingKey(null);

    if (result.kind !== "ok") {
      setActionError(result.message);
      return;
    }

    await load();
  }

  /** The roster's own direct "Remove" action -- unlike a candidate
   * chip's unlink (which needs a matching name to find the right
   * roster row in the first place), this always targets the exact
   * `person_id`/`role` already in hand, so it works even for a row a
   * candidate chip can no longer match (e.g. a stale identity left over
   * from before 2026-09-08's person-identity fix, real Dubuqueland
   * data). */
  async function handleRemoveFromRoster(person: FacilityPerson) {
    const key = `${person.person_id}:${person.role}`;
    setPendingKey(key);
    setActionError(null);

    const result = await unlinkFacilityPerson(companyId, facilityId, person.person_id, person.role);

    setPendingKey(null);

    if (result.kind !== "ok") {
      setActionError(result.message);
      return;
    }

    await load();
  }

  async function handleCopyAll() {
    if (!people || people.roster.length === 0) return;

    try {
      await navigator.clipboard.writeText(formatRosterForClipboard(people.roster));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Could not copy to the clipboard -- your browser may be blocking clipboard access.");
    }
  }

  function startEdit(person: FacilityPerson) {
    setEditingKey(`${person.person_id}-${person.role}`);
    setEditForm({
      full_name: person.full_name,
      email: person.email ?? "",
      phone: person.phone ?? "",
      role: person.role,
    });
    setEditProtect(false);
    setEditError(null);
  }

  async function saveEdit(person: FacilityPerson) {
    setEditSaving(true);
    setEditError(null);

    const result = await editFacilityPerson(
      companyId,
      facilityId,
      person.person_id,
      person.role,
      personFormToAssignment(editForm),
      editProtect
    );

    setEditSaving(false);

    if (result.kind !== "ok") {
      setEditError(result.message);
      return;
    }

    setEditingKey(null);
    await load();
  }

  async function submitManualAdd() {
    setManualSaving(true);
    setManualError(null);

    if (manualForm.full_name.trim() === "") {
      setManualSaving(false);
      setManualError("Name is required.");
      return;
    }

    const result = await addFacilityPerson(companyId, facilityId, personFormToAssignment(manualForm), "manual");

    setManualSaving(false);

    if (result.kind !== "ok") {
      setManualError(result.message);
      return;
    }

    setAddingManually(false);
    setManualForm(emptyPersonForm());
    await load();
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {loadError}
      </p>
    );
  }

  if (!people) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  // Keyed by (email, role, full_name) -- how a candidate chip finds the
  // roster row it corresponds to, since a candidate off ps_person_index
  // carries no person_id of its own. Full name has to be part of the key,
  // not just email+role: real Dubuqueland data has several distinct
  // people (Barb Soppe, Carrie Krueger, Chad Soppe) sharing one family
  // inbox with the same role -- matching on email+role alone would make
  // all of them resolve to whichever one is actually on the roster.
  const rosterByEmailAndRole = new Map(
    people.roster.filter((person) => !!person.email).map((person) => [candidateKey(person), person])
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
                setAddingManually((prev) => !prev);
                setManualError(null);
              }}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              + Add Person Manually
            </button>
            {people.roster.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                {copied ? "Copied!" : "Copy All"}
              </button>
            )}
          </div>
        </div>

        {addingManually && (
          <div className="mb-4 flex flex-col gap-2 rounded border border-slate-800 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={manualForm.full_name}
                onChange={(e) => setManualForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Name"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={manualForm.email}
                onChange={(e) => setManualForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <input
                type="text"
                value={manualForm.phone}
                onChange={(e) => setManualForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
              <select
                value={manualForm.role}
                onChange={(e) => setManualForm((prev) => ({ ...prev, role: e.target.value }))}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submitManualAdd}
                disabled={manualSaving}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {manualSaving ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setAddingManually(false)}
                disabled={manualSaving}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <span className="text-xs text-slate-500">Never overwritten by a Process Street sync.</span>
            </div>
            {manualError && (
              <p role="alert" className="text-sm text-red-400">
                {manualError}
              </p>
            )}
          </div>
        )}

        {people.roster.length === 0 ? (
          <p className="text-sm text-slate-500">No users linked to this facility yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="w-56 pr-4 pb-2 font-medium">Email</th>
                  <th className="w-40 pr-4 pb-2 font-medium">Phone</th>
                  <th className="pr-4 pb-2 font-medium">Role</th>
                  <th className="pr-4 pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {people.roster.map((person) => {
                  const key = `${person.person_id}-${person.role}`;
                  const isEditing = editingKey === key;

                  if (isEditing) {
                    return (
                      <tr key={key} className="border-t border-slate-800">
                        <td colSpan={6} className="py-3">
                          <div className="flex flex-col gap-2 rounded border border-slate-800 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={editForm.full_name}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                                placeholder="Name"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <input
                                type="text"
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <input
                                type="text"
                                value={editForm.phone}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="Phone"
                                className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              />
                              <select
                                value={editForm.role}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                              >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {person.source === "process_street" && (
                              <label className="flex items-center gap-2 text-xs text-amber-300">
                                <input
                                  type="checkbox"
                                  checked={editProtect}
                                  onChange={(e) => setEditProtect(e.target.checked)}
                                />
                                This person came from Process Street -- without protecting, a future sync could
                                silently revert this edit. Protect it from that.
                              </label>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(person)}
                                disabled={editSaving}
                                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingKey(null)}
                                disabled={editSaving}
                                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                            {editError && (
                              <p role="alert" className="text-sm text-red-400">
                                {editError}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={key} className="border-t border-slate-800">
                      <td className="py-2 pr-4">{person.full_name}</td>
                      <td className="py-2 pr-4 text-slate-400">{person.email ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-400">{person.phone ? formatPhone(person.phone) : "—"}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
                          {ROLE_LABELS[person.role] ?? person.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{SOURCE_LABELS[person.source] ?? person.source}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(person)}
                            className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromRoster(person)}
                            disabled={pendingKey === `${person.person_id}:${person.role}`}
                            className="rounded border border-red-900 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
        {people.candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No Process Street contacts found for this facility.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {people.candidates.map((candidate) => {
              const key = candidateKey(candidate);
              const linkedPerson = candidate.email ? rosterByEmailAndRole.get(key) : undefined;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleChipClick(candidate, linkedPerson?.person_id ?? null)}
                  disabled={pendingKey === key}
                  title={
                    linkedPerson
                      ? `Unlink ${candidate.full_name}`
                      : (candidate.email ?? undefined)
                  }
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
    </div>
  );
}
