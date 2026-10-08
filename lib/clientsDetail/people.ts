// A facility people (the Users tab).
import { clientsDelete, clientsGet, clientsPost, clientsPut, type ClientsResult } from "@/lib/clientsApi";

/** Mirrors `FacilityPerson` -- one already-saved row on the Users tab. */
export interface FacilityPerson {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  /** Access level (`owner` | `district_manager` | `manager`) -- what
   * this person can do inside QMS, from the Intake form's user-level
   * fields. NOT legal ownership; see `legal_owner`. */
  role: string;
  /** "process_street" (an "Add User" chip, or every already-ingested
   * row) or "manual" -- permanently exempt from the Users tab's own
   * self-heal pass. Never shown on "Copy All". */
  source: string;
  /** True when this person is also an owner on the Merchant Account
   * Pre-App (derived on read by the API; a viewer without access to
   * that data sees false for everyone). */
  legal_owner: boolean;
}

/**
 * Mirrors `PersonAssignment` -- both an "Add User" candidate straight off
 * `clients.ps_person_index` (no `person_id`, since it isn't necessarily
 * linked yet) and the exact shape `addFacilityPerson` below sends back
 * verbatim on a chip click.
 */
export interface PersonAssignment {
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

/**
 * Mirrors `MissingLegalOwner` -- a Merchant Account Pre-App owner with
 * no roster row and no Intake candidate chip either, so they'd
 * otherwise be invisible on the Users tab (Freeland's Serene Armstrong,
 * 2026-09-30). No `role`: a Merchant Account owner has no QMS access
 * level of their own, so adding one defaults to `"owner"` only at add
 * time, same as any other roster entry.
 */
export interface MissingLegalOwner {
  full_name: string;
  email: string | null;
  phone: string | null;
}

/** The sister facility whose Merchant Account form supplied the legal
 * owners when this facility has none of its own. */
export interface LegalOwnerSource {
  facility_id: string;
  facility_name: string;
}

/** Mirrors `FacilityPeopleResponse`. */
export interface FacilityPeople {
  roster: FacilityPerson[];
  candidates: PersonAssignment[];
  missing_legal_owners: MissingLegalOwner[];
  /** Set when the Legal Owner checkmarks were worked out from a sister
   * facility's Merchant Account form; null when they came from this
   * facility's own form (or there are none). */
  legal_owner_source: LegalOwnerSource | null;
}

export async function getFacilityPeople(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityPeople>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/people`);
}

/**
 * Adds (or re-adds) a person to this facility's roster. For a
 * `source: "process_street"` add (an "Add User" chip), always an
 * upsert: a person already linked from an old ingest gets their stored
 * name/phone overwritten with `assignment`'s values rather than left
 * alone, the same self-heal `upsert_person_and_link_to_facility`'s own
 * doc comment explains (Sand-Sto's own "Irene Chen - (301) 787-9221").
 * `source: "manual"` is a brand-new person typed in by hand -- never
 * touched by the Users tab's own self-heal pass afterward.
 */
export async function addFacilityPerson(
  companyId: string,
  facilityId: string,
  assignment: PersonAssignment,
  source: "process_street" | "manual"
): Promise<ClientsResult<void>> {
  return clientsPost(`/clients/${companyId}/facilities/${facilityId}/people`, { ...assignment, source });
}

/**
 * The Users tab's "Edit" action -- retypes a roster person's own
 * name/email/phone/role directly. `oldRole` identifies which existing
 * (facility, person, role) link is being edited, since `role` itself
 * may be changing. `protectFromResync` only matters when this person's
 * current `source` is "process_street": true flips their link to
 * "manual" (so this edit survives the Users tab's own self-heal pass
 * going forward); false leaves it "process_street", meaning a future
 * load could still silently revert this edit back to whatever
 * `clients.ps_person_index` says. Ignored (already permanently
 * protected) for an already-"manual" person.
 */
export async function editFacilityPerson(
  companyId: string,
  facilityId: string,
  personId: string,
  oldRole: string,
  assignment: PersonAssignment,
  protectFromResync: boolean
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/people/${personId}`, {
    old_role: oldRole,
    full_name: assignment.full_name,
    email: assignment.email,
    phone: assignment.phone,
    role: assignment.role,
    protect_from_resync: protectFromResync,
  });
}

/**
 * Removes one roster entry -- the same "Add User" chip, shown red once a
 * candidate is already linked, calls this instead of `addFacilityPerson`.
 * Only removes this one (person, role) link; the person's own identity
 * row (and any other facility they're linked to) is untouched.
 */
export async function unlinkFacilityPerson(
  companyId: string,
  facilityId: string,
  personId: string,
  role: string
): Promise<ClientsResult<void>> {
  return clientsDelete(
    `/clients/${companyId}/facilities/${facilityId}/people/${personId}?role=${encodeURIComponent(role)}`
  );
}
