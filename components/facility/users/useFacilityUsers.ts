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
import {
  candidateKey,
  emptyPersonForm,
  formatRosterForClipboard,
  personFormToAssignment,
  type PersonFormState,
} from "./personRoster";

/**
 * All of UsersTab's own data + actions -- load/reload the roster and
 * candidate pool, and the four things that can change them: a
 * candidate chip click (link/unlink), the roster's own direct Remove,
 * an inline Edit save, and a manual Add. Every one of those ends the
 * same way (reload from the server), which is why they all live
 * together here rather than split further -- see UsersTab's own doc
 * comment for the behavior history behind each.
 */
export function useFacilityUsers(companyId: string, facilityId: string) {
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

  return {
    people,
    loadError,
    pendingKey,
    actionError,
    copied,
    handleCopyAll,
    handleChipClick,
    handleRemoveFromRoster,

    editingKey,
    editForm,
    setEditForm,
    editProtect,
    setEditProtect,
    editSaving,
    editError,
    startEdit,
    cancelEdit: () => setEditingKey(null),
    saveEdit,

    addingManually,
    setAddingManually,
    manualForm,
    setManualForm,
    manualSaving,
    manualError,
    setManualError,
    submitManualAdd,
  };
}
