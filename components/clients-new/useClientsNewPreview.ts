"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useClients } from "@/lib/clients";
import {
  createClient,
  previewClients,
  type EditableFacilityFields,
  type MappedCompany,
  type PersonAssignment,
  type PreviewedRun,
  type PreviewRunSelection,
} from "@/lib/clientsImport";
import { buildPeoplePool, personKey, pickCompanySourceRun, stripGoLiveDate } from "./clientsNewHelpers";

/**
 * All of the Review & Create page's own data and mutations -- loading
 * the preview for the selected runs, every field/people edit made to
 * the Company and per-facility sections, the "use this facility's info"
 * fallback, and the final Create submit. Extracted out of the page
 * itself so that file is just the JSX composition over what this hook
 * returns; see each function's own comment for the behavior history
 * behind it.
 */
export function useClientsNewPreview(selection: PreviewRunSelection[]) {
  const router = useRouter();
  const { refresh } = useClients();

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

  /** Only fills fields still blank -- e.g. `legal_name` may already be
   * correctly resolved via Merchant Account correlation even though
   * contact info is blank (confirmed 2026-09-08, Dubuqueland), and this
   * must not stomp that with the facility's own raw name. */
  function handleAcceptCompanyFallback() {
    if (!companySourceRun) return;
    const { facility } = companySourceRun;
    setEditedCompany((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        legal_name: prev.legal_name ?? facility.name,
        corporate_address_street: prev.corporate_address_street ?? facility.street_address,
        corporate_address_city: prev.corporate_address_city ?? facility.city,
        corporate_address_state: prev.corporate_address_state ?? facility.state,
        corporate_address_zip: prev.corporate_address_zip ?? facility.zip,
        corporate_phone: prev.corporate_phone ?? facility.phone,
        website_url: prev.website_url ?? facility.website_url,
      };
    });
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

  return {
    runs,
    loadError,
    editedCompany,
    editedFacilities,
    editing,
    setEditing,
    companyFallbackHandled,
    submitting,
    submitError,
    companySourceRun,
    peoplePool,
    updateCompanyField,
    updateFacilityField,
    togglePersonForFacility,
    addAllForRole,
    handleAcceptCompanyFallback,
    handleDismissCompanyFallback,
    handleCreate,
  };
}
