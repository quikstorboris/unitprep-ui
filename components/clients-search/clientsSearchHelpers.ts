import type { FacilityMatch, MatchedVia, PsWorkflow } from "@/lib/clientsSearch";

/**
 * Every real PS run title carries this suffix (e.g. "Highway 20 Self
 * Storage - QMS Onboarding") -- the Workflow column already says which
 * PS workflow a row is from, so repeating "Onboarding" in the name
 * itself is redundant. Display-only: the raw `run_name` is still what's
 * sent back on "Add to OO", this never touches the underlying data.
 */
export function displayFacilityName(runName: string): string {
  return runName.replace(/ - QMS Onboarding$/i, "");
}

export function formatActivity(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Groups consecutive `facilityMatches` sharing a `run_id` -- the
 * backend already emits a facility's ambiguous Merchant Account
 * candidates as adjacent rows (`clients_search.rs`'s own
 * `facility_matches_for`), so grouping by run of equal `run_id` is
 * enough; no separate id needed to tie them together.
 */
export function groupFacilityMatches(matches: FacilityMatch[]): FacilityMatch[][] {
  const groups: FacilityMatch[][] = [];
  for (const match of matches) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup[0].run_id === match.run_id) {
      lastGroup.push(match);
    } else {
      groups.push([match]);
    }
  }
  return groups;
}

// A duplicate candidate shares run_id with its sibling(s) -- disambiguate
// by which Merchant Account run it came from so each still gets its own
// checkbox state.
export function matchKey(match: FacilityMatch): string {
  return match.duplicate ? `${match.run_id}:${match.duplicate.merchant_account_run_id}` : match.run_id;
}

export function matchedViaLabel(matchedVia: MatchedVia): string {
  switch (matchedVia.kind) {
    case "name":
      return "Facility name";
    case "person":
      return `Person: ${matchedVia.full_name} (${roleLabel(matchedVia.role)})`;
  }
}

export function workflowLabel(workflow: PsWorkflow): string {
  switch (workflow) {
    case "intake":
      return "Intake / Progress";
    case "merchant_account":
      return "New Merchant Account";
    case "contract_order":
      return "Contract Order";
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "district_manager":
      return "District Manager";
    case "manager":
      return "Manager";
    case "signer":
      return "Signer";
    case "onboarding_poc":
      return "Onboarding POC";
    case "website_poc":
      return "Website POC";
    case "integration_poc":
      return "Integration POC";
    default:
      return role;
  }
}
