import type {
  EditableFacilityFields,
  MappedCompany,
  MappedFacility,
  PersonAssignment,
  PreviewedRun,
} from "@/lib/clientsImport";

export const COMPANY_FIELDS: Array<{ key: keyof MappedCompany; label: string }> = [
  { key: "legal_name", label: "Legal Name" },
  { key: "corporate_email", label: "Corporate Email" },
  { key: "corporate_phone", label: "Corporate Phone" },
  { key: "corporate_address_street", label: "Street Address" },
  { key: "corporate_address_city", label: "City" },
  { key: "corporate_address_state", label: "State" },
  { key: "corporate_address_zip", label: "ZIP" },
  { key: "subdomain", label: "Subdomain" },
  { key: "website_url", label: "Website" },
];

/** Just the actual contact fields -- deliberately excludes `legal_name`
 * (often resolved via Merchant Account correlation even when contact
 * info is blank) and `subdomain` (confirmed 2026-09-08, Dubuqueland:
 * PS answers `Company_Subdomain:` independently of the gated Corporate
 * Info block, so it can be populated even on a run whose contact info
 * genuinely is not). Used to decide whether the "use this facility's
 * info" fallback banner below is worth offering -- `companyCompleteness`
 * above still drives `pickCompanySourceRun`'s own run-selection logic
 * and stays as-is. */
const CONTACT_FIELD_KEYS: Array<keyof MappedCompany> = [
  "corporate_email",
  "corporate_phone",
  "corporate_address_street",
  "corporate_address_city",
  "corporate_address_state",
  "corporate_address_zip",
];

export function hasAnyContactInfo(company: MappedCompany): boolean {
  return CONTACT_FIELD_KEYS.some((key) => {
    const value = company[key];
    return value !== null && value !== undefined && value !== "";
  });
}

// "people" is deliberately excluded from this key type -- it isn't one
// of the generic pencil-edit text/number fields below, it gets its own
// chip-based People section render (see `PEOPLE_ROLE_GROUPS`).
export const FACILITY_FIELDS: Array<{
  key: Exclude<keyof EditableFacilityFields, "people">;
  label: string;
  type?: "number";
}> = [
  { key: "name", label: "Facility Name" },
  { key: "street_address", label: "Street Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "units_count", label: "Units Count", type: "number" },
  { key: "primary_storage_offering", label: "Primary Storage Offering" },
  { key: "previous_pms", label: "Previous PMS" },
  { key: "access_control_system", label: "Access Control System" },
  { key: "dropbox_folder_url", label: "Dropbox Folder URL" },
  { key: "subdomain", label: "Subdomain" },
  { key: "subdomain_exists_in_qms_raw", label: "Subdomain Exists in QMS" },
  { key: "system_email", label: "System Email" },
  { key: "website_url", label: "Website" },
];

export function stripGoLiveDate(facility: MappedFacility, people: PersonAssignment[]): EditableFacilityFields {
  return {
    name: facility.name,
    street_address: facility.street_address,
    city: facility.city,
    state: facility.state,
    zip: facility.zip,
    phone: facility.phone,
    email: facility.email,
    units_count: facility.units_count,
    primary_storage_offering: facility.primary_storage_offering,
    previous_pms: facility.previous_pms,
    access_control_system: facility.access_control_system,
    dropbox_folder_url: facility.dropbox_folder_url,
    subdomain: facility.subdomain,
    subdomain_exists_in_qms_raw: facility.subdomain_exists_in_qms_raw,
    system_email: facility.system_email,
    website_url: facility.website_url,
    // This run's own naive parse -- the starting chip selection, before
    // the manager decides which of every selected run's people actually
    // belong to THIS facility. See `PEOPLE_ROLE_GROUPS`'s own comment.
    people,
  };
}

/** Identifies one real person + role for chip-selection purposes -- two
 * `PersonAssignment`s with the same name/email/role are the same chip,
 * even when they came from different runs (the whole point of a shared
 * pool: Sand-Sto's Irene Chen, parsed off her own facility's run, is the
 * same chip a sister facility picks her from too). */
export function personKey(person: PersonAssignment): string {
  return `${person.full_name}|${person.email ?? ""}|${person.role}`;
}

export const PEOPLE_ROLE_GROUPS: Array<{ key: string; label: string }> = [
  { key: "owner", label: "Owners" },
  { key: "district_manager", label: "District Managers" },
  { key: "manager", label: "Managers" },
];

/** Every person parsed off ANY selected run, deduped by `personKey` and
 * sorted by name -- the shared pool every facility's People section
 * picks its chips from (Boris, 2026-09-04: a person can legitimately be
 * assigned to more than one facility, e.g. a District Manager who
 * covers several, so every facility must see the same candidates, not
 * just its own run's own naive parse). */
export function buildPeoplePool(runs: PreviewedRun[]): PersonAssignment[] {
  const byKey = new Map<string, PersonAssignment>();
  for (const run of runs) {
    for (const person of run.people ?? []) {
      const key = personKey(person);
      if (!byKey.has(key)) byKey.set(key, person);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** How many of the confirmation screen's own Company fields this run's
 * `company` actually answered -- the real completeness signal
 * `pickCompanySourceRun` uses, not just "does `legal_name` exist" (that
 * check alone is satisfied by a stray `Company_Name:` answer or a
 * Merchant Account correlation on a run whose real Corporate Info
 * section is otherwise blank -- confirmed against Affordable Storage's
 * real data, 2026-09-03: Tanner resolved a legal name this way while
 * every other Company field on it was genuinely empty in PS). */
function companyCompleteness(company: MappedCompany): number {
  return COMPANY_FIELDS.filter((f) => {
    const value = company[f.key];
    return value !== null && value !== undefined && value !== "";
  }).length;
}

/**
 * Whichever selected run PS itself marks authoritative for company data
 * -- i.e. answered "Yes" to "Is this their first time filling out this
 * form?" -- since that's the one real source of truth for Corporate
 * Info in PS's own model (see the vault's sister-site writeup). Among
 * runs tied on that (more than one, or none at all -- e.g. every
 * selected run answered "No", or the field itself went unanswered),
 * falls back to whichever has the most complete company data, so a
 * run that only resolved a legal name (and nothing else) never wins
 * over one with real corporate contact info just because it happened
 * to come first. Falls back to the first selected run when nothing
 * resolved anything at all, so the Company section always has *a*
 * source run to record on `clients.companies.ps_intake_run_id` -- the
 * manager can still fill the section in by hand.
 */
export function pickCompanySourceRun(runs: PreviewedRun[]): PreviewedRun {
  const withData = runs.filter((run) => companyCompleteness(run.company) > 0);
  if (withData.length === 0) return runs[0];

  const firstTimeRuns = withData.filter((run) => run.is_first_time === true);
  const candidates = firstTimeRuns.length > 0 ? firstTimeRuns : withData;

  return candidates.reduce((best, run) =>
    companyCompleteness(run.company) > companyCompleteness(best.company) ? run : best
  );
}
