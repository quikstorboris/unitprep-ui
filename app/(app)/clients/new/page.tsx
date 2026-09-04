"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Spinner } from "@/components/Spinner";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import { ProcessStreetLogo } from "@/components/icons/ProcessStreetLogo";
import { useClients } from "@/lib/clients";
import {
  createClient,
  previewClients,
  type EditableFacilityFields,
  type MappedCompany,
  type MappedFacility,
  type PersonAssignment,
  type PreviewedRun,
  type PreviewRunSelection,
} from "@/lib/clientsImport";
import { formatPhone } from "@/lib/format";

const COMPANY_FIELDS: Array<{ key: keyof MappedCompany; label: string }> = [
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

// "people" is deliberately excluded from this key type -- it isn't one
// of the generic pencil-edit text/number fields below, it gets its own
// chip-based People section render (see `PEOPLE_ROLE_GROUPS`).
const FACILITY_FIELDS: Array<{
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

function stripGoLiveDate(facility: MappedFacility, people: PersonAssignment[]): EditableFacilityFields {
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
function personKey(person: PersonAssignment): string {
  return `${person.full_name}|${person.email ?? ""}|${person.role}`;
}

const PEOPLE_ROLE_GROUPS: Array<{ key: string; label: string }> = [
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
function buildPeoplePool(runs: PreviewedRun[]): PersonAssignment[] {
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
function pickCompanySourceRun(runs: PreviewedRun[]): PreviewedRun {
  const withData = runs.filter((run) => companyCompleteness(run.company) > 0);
  if (withData.length === 0) return runs[0];

  const firstTimeRuns = withData.filter((run) => run.is_first_time === true);
  const candidates = firstTimeRuns.length > 0 ? firstTimeRuns : withData;

  return candidates.reduce((best, run) =>
    companyCompleteness(run.company) > companyCompleteness(best.company) ? run : best
  );
}

export default function ClientsNewPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          <p className="text-sm text-slate-400">Loading…</p>
        </main>
      }
    >
      <ClientsNewPageInner />
    </Suspense>
  );
}

function ClientsNewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useClients();

  const selection: PreviewRunSelection[] = (() => {
    const raw = searchParams.get("selection");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry): entry is PreviewRunSelection =>
          typeof entry?.run_id === "string" && typeof entry?.run_name === "string"
      );
    } catch {
      return [];
    }
  })();

  // `runs === null` doubles as "still loading" -- same idiom as
  // `AdminQmsTagsPage`'s `tags === null`, rather than a separate
  // loading boolean.
  const [runs, setRuns] = useState<PreviewedRun[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Every selected run becomes its own Facility record on Create (see
  // `create.rs`'s own doc comment -- nothing at the schema or handler
  // level requires a company's source run to be excluded from also
  // being a facility; that was a frontend-only rule, and Boris's own
  // real Prairie Enterprises case needs it gone: Highway 20 carries the
  // company's own corporate data *and* is itself a real, separate
  // facility). Company is one section, not a role a facility switches
  // into -- `companySourceRunId` only tracks which run's data seeded it
  // and gets sent as `company_intake_run_id` on Create.
  const [companySourceRunId, setCompanySourceRunId] = useState<string | null>(null);
  const [editedCompany, setEditedCompany] = useState<MappedCompany | null>(null);
  const [editedFacilities, setEditedFacilities] = useState<Record<string, EditableFacilityFields>>({});
  const [editing, setEditing] = useState(false);
  // Real single-facility businesses often answer "Yes" to "Is your
  // Corporate Name, Address, Phone Number & Email the same as this
  // Facility?" -- PS then skips the dedicated Corporate questions
  // entirely, leaving the Company section with nothing to show at all
  // (confirmed: run rZFNRpmLIxuOrb_8K9hICw). `true` once the manager has
  // either accepted or dismissed the resulting fallback prompt, so it
  // shows at most once per preview load.
  const [companyFallbackHandled, setCompanyFallbackHandled] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function loadPreview() {
    if (selection.length === 0) return;

    const result = await previewClients(selection);

    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }

    setLoadError(null);
    setRuns(result.data.runs);

    const facilities: Record<string, EditableFacilityFields> = {};
    for (const run of result.data.runs) {
      facilities[run.run_id] = stripGoLiveDate(run.facility, run.people ?? []);
    }
    setEditedFacilities(facilities);

    const companySource = pickCompanySourceRun(result.data.runs);
    setCompanySourceRunId(companySource.run_id);
    setEditedCompany(companySource.company);
    setCompanyFallbackHandled(false);
  }

  useEffect(() => {
    queueMicrotask(loadPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the actual selection changes
  }, [selection.map((s) => s.run_id).join(",")]);

  function updateCompanyField(key: keyof MappedCompany, value: string) {
    setEditedCompany((prev) => (prev ? { ...prev, [key]: value === "" ? null : value } : prev));
  }

  function updateFacilityField(
    runId: string,
    key: keyof EditableFacilityFields,
    value: string,
    isNumber: boolean
  ) {
    setEditedFacilities((prev) => ({
      ...prev,
      [runId]: {
        ...prev[runId],
        [key]: value === "" ? null : isNumber ? Number(value) : value,
      },
    }));
  }

  /** Toggles one pool chip on/off this facility's own reviewed People
   * list -- the entire interaction (Boris, 2026-09-04: no separate "add"
   * step, no modal, clicking a chip *is* the assign/unassign action). */
  function togglePersonForFacility(runId: string, person: PersonAssignment) {
    setEditedFacilities((prev) => {
      const current = prev[runId];
      if (!current) return prev;
      const key = personKey(person);
      const isSelected = current.people.some((p) => personKey(p) === key);
      const people = isSelected
        ? current.people.filter((p) => personKey(p) !== key)
        : [...current.people, person];
      return { ...prev, [runId]: { ...current, people } };
    });
  }

  /** Assigns every pool chip of one role group to this facility in one
   * click -- never removes anyone already assigned under a different
   * role. */
  function addAllForRole(runId: string, role: string, pool: PersonAssignment[]) {
    setEditedFacilities((prev) => {
      const current = prev[runId];
      if (!current) return prev;
      const existingKeys = new Set(current.people.map(personKey));
      const toAdd = pool.filter((p) => p.role === role && !existingKeys.has(personKey(p)));
      if (toAdd.length === 0) return prev;
      return { ...prev, [runId]: { ...current, people: [...current.people, ...toAdd] } };
    });
  }

  /** The run whose facility data the fallback banner would offer to
   * copy from -- always the same run that seeded the Company section,
   * since that's the run whose blank Corporate Info section triggered
   * the prompt in the first place. */
  const companySourceRun = runs?.find((run) => run.run_id === companySourceRunId) ?? null;

  // Every facility's People section picks from this same pool -- see
  // `buildPeoplePool`'s own comment.
  const peoplePool = runs ? buildPeoplePool(runs) : [];

  function handleAcceptCompanyFallback() {
    if (!companySourceRun) return;
    const { facility } = companySourceRun;
    setEditedCompany((prev) =>
      prev
        ? {
            ...prev,
            legal_name: facility.name,
            corporate_address_street: facility.street_address,
            corporate_address_city: facility.city,
            corporate_address_state: facility.state,
            corporate_address_zip: facility.zip,
            corporate_phone: facility.phone,
            website_url: facility.website_url,
          }
        : prev
    );
    setCompanyFallbackHandled(true);
  }

  function handleDismissCompanyFallback() {
    setCompanyFallbackHandled(true);
  }

  async function handleCreate() {
    if (!runs || !companySourceRunId || !editedCompany) return;

    setSubmitting(true);
    setSubmitError(null);

    const facilities = runs.map((run) => ({
      run_id: run.run_id,
      fields: editedFacilities[run.run_id],
      merchant_account_run_id: run.merchant_account_run_id,
    }));

    const result = await createClient({
      company_intake_run_id: companySourceRunId,
      company: editedCompany,
      facilities,
    });

    setSubmitting(false);

    if (result.kind !== "ok") {
      setSubmitError(result.message);
      return;
    }

    await refresh();
    router.push(`/clients/${result.data.company_id}`);
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-center gap-3">
          <Link href="/clients/search" className="text-sm text-slate-400 hover:text-slate-200">
            ← Search
          </Link>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Review &amp; Create</h1>
            <p className="mt-2 text-sm text-slate-400">
              Every selected facility is imported as its own record under one Company below.
            </p>
          </div>

          {runs && runs.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
            >
              {editing ? "Done editing" : "Edit"}
            </button>
          )}
        </div>

        {selection.length === 0 && (
          <p className="text-sm text-slate-400">
            No facilities selected — go back to{" "}
            <Link href="/clients/search" className="text-blue-400 hover:underline">
              search
            </Link>{" "}
            and check at least one.
          </p>
        )}

        {selection.length > 0 && runs === null && !loadError && (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <ProcessStreetLogo className="h-10 w-10" />
            <Spinner className="h-8 w-8 text-blue-400" />
            <p className="text-sm text-slate-400">Fetching data from Process Street…</p>
          </div>
        )}

        {loadError && (
          <p role="alert" className="text-sm text-red-400">
            {loadError}
          </p>
        )}

        {runs && editedCompany && (
          <div className="flex flex-col gap-6">
            {!companyFallbackHandled && companyCompleteness(editedCompany) === 0 && companySourceRun && (
              <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
                <h2 className="mb-2 text-lg font-semibold">No Company Information Captured</h2>
                <p className="mb-4 text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{companySourceRun.facility.name}</span>&apos;s own
                  Corporate Info section came back blank -- this usually means the client answered
                  &quot;Yes&quot; to &quot;Is your Corporate Name, Address, Phone Number &amp; Email the same as
                  this Facility?&quot;, so Process Street never asked those questions separately. Use this
                  facility&apos;s own name, address, phone, and website for the Company section instead?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAcceptCompanyFallback}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                  >
                    Use Facility Info
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissCompanyFallback}
                    className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            <section className="rounded border border-blue-800 bg-blue-950/10 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{editedCompany.legal_name || "Company"}</h2>
                <span className="rounded bg-blue-900/60 px-2 py-1 text-xs uppercase tracking-wide text-blue-300">
                  Company
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COMPANY_FIELDS.map((field) => {
                  const value = editedCompany[field.key];
                  const displayValue =
                    field.key === "corporate_phone" && typeof value === "string" ? formatPhone(value) : value;
                  return (
                    <div key={field.key} className="flex flex-col gap-1 text-sm">
                      <dt className="text-slate-400">{field.label}</dt>
                      {editing ? (
                        <input
                          type="text"
                          value={value ?? ""}
                          onChange={(e) => updateCompanyField(field.key, e.target.value)}
                          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                        />
                      ) : (
                        <dd className="break-words">{displayValue || "—"}</dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </section>

            {runs.map((run) => (
              <section key={run.run_id} className="rounded border border-slate-800 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{run.facility.name || run.run_id}</h2>
                  <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
                    Facility
                  </span>
                </div>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 text-sm">
                    <dt className="text-slate-400">Original Go Live Date</dt>
                    <dd>{run.facility.go_live_date || "—"}</dd>
                  </div>

                  {FACILITY_FIELDS.map((field) => {
                    const value = editedFacilities[run.run_id]?.[field.key];
                    // Real Dropbox URLs are long enough (100+ characters,
                    // no spaces) to overflow their grid cell and overlap
                    // neighboring text when shown as plain text -- render
                    // the same compact "Go to DropBox" link the real
                    // Facility page uses instead, matching that page's
                    // own treatment (see `facilities/[facilityId]/page.tsx`'s
                    // `GeneralTab`).
                    if (field.key === "dropbox_folder_url" && !editing) {
                      return (
                        <div key={field.key} className="flex flex-col gap-1 text-sm">
                          <dt className="text-slate-400">{field.label}</dt>
                          <dd>
                            {typeof value === "string" && value ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
                              >
                                <DropboxLogo className="h-4 w-4" />
                                Go to DropBox
                              </a>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                      );
                    }

                    // `??` (not `||`) preserves a real 0 for units_count --
                    // only the phone field gets a special, already-"—"-safe
                    // display value (formatPhone never returns a falsy
                    // non-empty string).
                    const displayValue =
                      field.key === "phone" && typeof value === "string" ? formatPhone(value) || "—" : value ?? "—";

                    return (
                      <div key={field.key} className="flex flex-col gap-1 text-sm">
                        <dt className="text-slate-400">{field.label}</dt>
                        {editing ? (
                          <input
                            type={field.type ?? "text"}
                            value={value ?? ""}
                            onChange={(e) =>
                              updateFacilityField(run.run_id, field.key, e.target.value, field.type === "number")
                            }
                            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                          />
                        ) : (
                          <dd className="break-words">{displayValue}</dd>
                        )}
                      </div>
                    );
                  })}
                </dl>

                {peoplePool.length > 0 && (
                  <div className="mt-5 border-t border-slate-800 pt-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-300">People</h3>
                    <div className="flex flex-col gap-3">
                      {PEOPLE_ROLE_GROUPS.map((group) => {
                        const peopleInGroup = peoplePool.filter((p) => p.role === group.key);
                        if (peopleInGroup.length === 0) return null;
                        const selectedKeys = new Set(
                          (editedFacilities[run.run_id]?.people ?? []).map(personKey)
                        );

                        return (
                          <div key={group.key} className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addAllForRole(run.run_id, group.key, peoplePool)}
                              className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                            >
                              Add All
                            </button>
                            <span className="text-xs text-slate-500">{group.label}:</span>
                            {peopleInGroup.map((person) => {
                              const selected = selectedKeys.has(personKey(person));
                              return (
                                <button
                                  key={personKey(person)}
                                  type="button"
                                  onClick={() => togglePersonForFacility(run.run_id, person)}
                                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    selected
                                      ? "bg-blue-600 text-white hover:bg-blue-500"
                                      : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                                  }`}
                                >
                                  {person.full_name}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            ))}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {submitting && <Spinner className="h-4 w-4" />}
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-400">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
