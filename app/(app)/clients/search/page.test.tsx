import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchClients, useRouter } = vi.hoisted(() => ({
  searchClients: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("@/lib/clientsSearch", () => ({
  searchClients,
}));

vi.mock("next/navigation", () => ({
  useRouter,
}));

vi.mock("./SyncButton", () => ({
  default: () => <div data-testid="sync-button" />,
}));

import ClientsSearchPage from "./page";

describe("ClientsSearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ push: vi.fn() });
  });

  // Regression test for the "prairie" search: a company name doesn't
  // literally appear in any facility's own Intake title, so most real
  // hits arrive tagged matched_via: person rather than matched_via:
  // name -- the UI must say why a result showed up, not just list it.
  it("labels a person-derived facility match with who it was found via", async () => {
    searchClients.mockResolvedValue({
      kind: "ok",
      data: {
        facility_matches: [
          {
            run_id: "run-carpentersville",
            run_name: "Carpentersville Self Storage - QMS Onboarding",
            status: null,
            already_imported: false,
            matched_via: { kind: "person", full_name: "Judy Armstrong", role: "owner" },
            company_name: "Prairie Enterprises LLC",
            last_activity_at: "2026-08-25T12:00:00Z",
            duplicate: null,
          },
        ],
        person_matches: [],
      },
    });

    const user = userEvent.setup();
    render(<ClientsSearchPage />);

    await user.type(screen.getByPlaceholderText("Facility, company, or person name"), "prairie");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Carpentersville Self Storage")).toBeInTheDocument();
    expect(screen.getByText("Person: Judy Armstrong (Owner)")).toBeInTheDocument();
    expect(screen.getByText("Prairie Enterprises LLC")).toBeInTheDocument();
  });

  // Regression test for the dead-end search results: a facility already
  // imported into OO must be visible (so a manager can see it's already
  // there) but not selectable, and must not count toward "select all" /
  // the selected-count display used by the future "Add to OO" action.
  it("shows an already-imported facility but does not let it be selected", async () => {
    searchClients.mockResolvedValue({
      kind: "ok",
      data: {
        facility_matches: [
          {
            run_id: "run-highway-20",
            run_name: "Highway 20 Self Storage - QMS Onboarding",
            status: "Active",
            already_imported: true,
            matched_via: { kind: "name" },
            company_name: "Prairie Enterprises LLC",
            last_activity_at: null,
            duplicate: null,
          },
          {
            run_id: "run-pyott-road",
            run_name: "Pyott Road Self Storage - QMS Onboarding",
            status: "Active",
            already_imported: false,
            matched_via: { kind: "name" },
            company_name: null,
            last_activity_at: null,
            duplicate: null,
          },
        ],
        person_matches: [],
      },
    });

    const user = userEvent.setup();
    render(<ClientsSearchPage />);

    await user.type(screen.getByPlaceholderText("Facility, company, or person name"), "highway");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const importedCheckbox = await screen.findByRole("checkbox", {
      name: "Select Highway 20 Self Storage",
    });
    expect(importedCheckbox).toBeDisabled();

    const selectableCheckbox = screen.getByRole("checkbox", {
      name: "Select Pyott Road Self Storage",
    });
    expect(selectableCheckbox).not.toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Select all facility matches" }));

    expect(importedCheckbox).not.toBeChecked();
    expect(selectableCheckbox).toBeChecked();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  // Regression test for the "- QMS Onboarding" clutter: the Workflow
  // column already says what workflow a row is from, so the facility
  // name itself must not repeat it, in either table.
  it("strips the QMS Onboarding suffix from facility names in both tables", async () => {
    searchClients.mockResolvedValue({
      kind: "ok",
      data: {
        facility_matches: [
          {
            run_id: "run-highway-20",
            run_name: "Highway 20 Self Storage - QMS Onboarding",
            status: "Active",
            already_imported: false,
            matched_via: { kind: "name" },
            company_name: null,
            last_activity_at: null,
            duplicate: null,
          },
        ],
        person_matches: [
          {
            workflow: "intake",
            ps_run_id: "run-highway-20",
            run_name: "Highway 20 Self Storage - QMS Onboarding",
            full_name: "Kyle Lindley",
            email: "k.lindley@prairie-enterprises.com",
            phone: null,
            role: "owner",
          },
        ],
      },
    });

    const user = userEvent.setup();
    render(<ClientsSearchPage />);

    await user.type(screen.getByPlaceholderText("Facility, company, or person name"), "highway");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const matches = await screen.findAllByText("Highway 20 Self Storage");
    expect(matches).toHaveLength(2);
    expect(screen.queryByText(/QMS Onboarding/)).not.toBeInTheDocument();
  });

  // Regression test for the real Carpentersville case: two distinct
  // Merchant Account runs correlate to the same facility. Both must
  // show up as their own selectable rows (not silently collapsed to
  // one blank-Company row), bracketed with a warning, and checking
  // either -- or both -- must only send the facility once to "Next".
  it("shows ambiguous Merchant Account candidates as bracketed Potential Duplicates rows", async () => {
    const push = vi.fn();
    useRouter.mockReturnValue({ push });
    searchClients.mockResolvedValue({
      kind: "ok",
      data: {
        facility_matches: [
          {
            run_id: "run-carpentersville",
            run_name: "Carpentersville Self Storage - QMS Onboarding",
            status: "Active",
            already_imported: false,
            matched_via: { kind: "name" },
            company_name: "Prairie Enterprises LLC",
            last_activity_at: "2026-08-25T12:00:00Z",
            duplicate: {
              merchant_account_run_id: "ma-carpentersville-1",
              merchant_account_updated_at: "2026-08-30T12:00:00Z",
            },
          },
          {
            run_id: "run-carpentersville",
            run_name: "Carpentersville Self Storage - QMS Onboarding",
            status: "Active",
            already_imported: false,
            matched_via: { kind: "name" },
            company_name: "Carpentersville Storage LLC",
            last_activity_at: "2026-08-25T12:00:00Z",
            duplicate: {
              merchant_account_run_id: "ma-carpentersville-2",
              merchant_account_updated_at: "2026-08-01T12:00:00Z",
            },
          },
        ],
        person_matches: [],
      },
    });

    const user = userEvent.setup();
    render(<ClientsSearchPage />);

    await user.type(screen.getByPlaceholderText("Facility, company, or person name"), "carpentersville");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/Potential Duplicates/)).toBeInTheDocument();

    const rows = screen.getAllByText("Carpentersville Self Storage", { selector: "td" });
    expect(rows).toHaveLength(2);

    expect(screen.getByText("Prairie Enterprises LLC")).toBeInTheDocument();
    expect(screen.getByText("Carpentersville Storage LLC")).toBeInTheDocument();

    // Both candidates' own Merchant-Account-specific activity dates
    // show up in their own dedicated column.
    expect(screen.getByText("Aug 30, 2026")).toBeInTheDocument();
    expect(screen.getByText("Aug 1, 2026")).toBeInTheDocument();

    // Checking both duplicate rows must still only select the facility once.
    const checkboxes = screen.getAllByRole("checkbox", { name: /Select Carpentersville/ });
    expect(checkboxes).toHaveLength(2);
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    const selection = JSON.parse(decodeURIComponent(url.split("selection=")[1]));
    // The specific candidate the user checked -- not the other
    // duplicate -- must travel with the selection, so the confirmation
    // screen never has to re-guess an ambiguity that's already resolved.
    expect(selection).toEqual([
      {
        run_id: "run-carpentersville",
        run_name: "Carpentersville Self Storage - QMS Onboarding",
        merchant_account_run_id: "ma-carpentersville-1",
      },
    ]);
  });

  // Regression test for the loading interstitial: while a search is in
  // flight, show the Process Street branding + spinner in place of (not
  // alongside) any previous results, then swap back to real results
  // once the call resolves.
  it("shows the Process Street fetching interstitial while a search is in flight, then swaps to results", async () => {
    let resolveSearch!: (value: unknown) => void;
    searchClients.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      })
    );

    const user = userEvent.setup();
    render(<ClientsSearchPage />);

    await user.type(screen.getByPlaceholderText("Facility, company, or person name"), "prairie");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Fetching data from Process Street…")).toBeInTheDocument();
    expect(screen.queryByText(/Facilities/)).not.toBeInTheDocument();

    resolveSearch({
      kind: "ok",
      data: { facility_matches: [], person_matches: [] },
    });

    expect(await screen.findByText(/No facility\/company name matches/)).toBeInTheDocument();
    expect(screen.queryByText("Fetching data from Process Street…")).not.toBeInTheDocument();
  });
});
