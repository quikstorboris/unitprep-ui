import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useRouter, useSearchParams, previewClients, createClient, useClients } = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  previewClients: vi.fn(),
  createClient: vi.fn(),
  useClients: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter,
  useSearchParams,
}));

vi.mock("@/lib/clientsImport", () => ({
  previewClients,
  createClient,
}));

vi.mock("@/lib/clients", () => ({
  useClients,
}));

import ClientsNewPage from "./page";

function mappedCompany(overrides: Record<string, unknown> = {}) {
  return {
    legal_name: null,
    corporate_email: null,
    corporate_phone: null,
    corporate_address_street: null,
    corporate_address_city: null,
    corporate_address_state: null,
    corporate_address_zip: null,
    subdomain: null,
    ...overrides,
  };
}

function selectionParams(
  runs: Array<{ run_id: string; run_name: string; merchant_account_run_id?: string }>
) {
  return new URLSearchParams({ selection: JSON.stringify(runs) });
}

function mappedFacility(overrides: Record<string, unknown> = {}) {
  return {
    name: "Highway 20 Self Storage",
    street_address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    email: null,
    units_count: null,
    primary_storage_offering: null,
    previous_pms: null,
    access_control_system: null,
    go_live_date: "2026-01-15",
    dropbox_folder_url: null,
    subdomain: null,
    subdomain_exists_in_qms_raw: null,
    system_email: null,
    ...overrides,
  };
}

describe("ClientsNewPage", () => {
  const push = vi.fn();
  const refresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ push });
    useClients.mockReturnValue({ refresh });
    refresh.mockResolvedValue(undefined);
  });

  it("prompts to go back to search when no runs were selected", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""));

    render(<ClientsNewPage />);

    expect(await screen.findByText(/No facilities selected/)).toBeInTheDocument();
    expect(previewClients).not.toHaveBeenCalled();
  });

  it("loads a preview for the selected runs and shows Original Go Live Date read-only", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([{ run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" }])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany(),
            facility: mappedFacility(),
          },
        ],
      },
    });

    render(<ClientsNewPage />);

    expect(await screen.findByRole("heading", { name: "Highway 20 Self Storage" })).toBeInTheDocument();
    expect(screen.getByText("Original Go Live Date")).toBeInTheDocument();
    expect(screen.getByText("2026-01-15")).toBeInTheDocument();
  });

  // Regression test for Boris's real Prairie Enterprises case: the
  // confirmation screen used to require sacrificing one selected run to
  // "be" the Company, which meant that run's own Facility record never
  // got created (Highway 20 is a real, separate 788-unit facility, not
  // just a company shell). Company is now its own section, and every
  // selected run -- including whichever one seeded the Company data --
  // still gets its own Facility section.
  it("shows Company as its own section, separate from every selected run's own Facility section", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        { run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" },
        { run_id: "run-carpentersville", run_name: "Carpentersville Self Storage - QMS Onboarding" },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Highway 20 Self Storage" }),
          },
          {
            run_id: "run-carpentersville",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Carpentersville Self Storage" }),
          },
        ],
      },
    });

    render(<ClientsNewPage />);

    // One Company section...
    expect(await screen.findByRole("heading", { name: "Prairie Enterprises LLC" })).toBeInTheDocument();
    // ...and both selected runs still show up as their own Facility
    // section, including Highway 20, whose data seeded the Company.
    expect(screen.getByRole("heading", { name: "Highway 20 Self Storage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carpentersville Self Storage" })).toBeInTheDocument();
    expect(screen.getAllByText("Facility")).toHaveLength(2);
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("submits the company plus every selected run as its own facility, including the run that seeded the company, then navigates to the new client", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        { run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" },
        { run_id: "run-carpentersville", run_name: "Carpentersville Self Storage - QMS Onboarding" },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Highway 20 Self Storage" }),
          },
          {
            run_id: "run-carpentersville",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Carpentersville Self Storage", go_live_date: null }),
          },
        ],
      },
    });
    createClient.mockResolvedValue({
      kind: "ok",
      data: { company_id: "company-1", facility_ids: ["facility-1", "facility-2"] },
    });

    const user = userEvent.setup();
    render(<ClientsNewPage />);
    await screen.findByRole("heading", { name: "Prairie Enterprises LLC" });

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createClient).toHaveBeenCalled());
    const request = createClient.mock.calls[0][0];
    // Highway 20 is the first run with a resolved Legal Name, so its own
    // run id is the company's source.
    expect(request.company_intake_run_id).toBe("run-highway-20");
    expect(request.company.legal_name).toBe("Prairie Enterprises LLC");
    // Both selected runs are submitted as facilities -- Highway 20 is
    // never excluded just because it also seeded the Company.
    expect(request.facilities).toHaveLength(2);
    expect(request.facilities.map((f: { run_id: string }) => f.run_id).sort()).toEqual([
      "run-carpentersville",
      "run-highway-20",
    ]);
    const carpentersville = request.facilities.find((f: { run_id: string }) => f.run_id === "run-carpentersville");
    expect(carpentersville.fields.name).toBe("Carpentersville Self Storage");
    // go_live_date must never be part of the submitted facility fields.
    expect(carpentersville.fields).not.toHaveProperty("go_live_date");

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/clients/company-1");
  });

  // Regression test for the real gap found 2026-09-03: previewClients
  // resolves each run's own Merchant Account correlation (auto or the
  // user's explicit "Potential Duplicates" pick), but that resolution
  // was silently dropped between preview and create -- nothing ever
  // reached createClient, so Elavon data was never actually ingested
  // for a real facility despite the confirmation screen visibly
  // resolving it. Each facility's own merchant_account_run_id must now
  // travel through unchanged.
  it("forwards each run's resolved Merchant Account run id to createClient", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        { run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" },
        {
          run_id: "run-carpentersville",
          run_name: "Carpentersville Self Storage - QMS Onboarding",
          merchant_account_run_id: "ma-carpentersville-1",
        },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Highway 20 Self Storage" }),
            merchant_account_run_id: "ma-highway-20",
          },
          {
            run_id: "run-carpentersville",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Carpentersville Self Storage" }),
            merchant_account_run_id: "ma-carpentersville-1",
          },
        ],
      },
    });
    createClient.mockResolvedValue({
      kind: "ok",
      data: { company_id: "company-1", facility_ids: ["facility-1", "facility-2"] },
    });

    const user = userEvent.setup();
    render(<ClientsNewPage />);
    await screen.findByRole("heading", { name: "Prairie Enterprises LLC" });

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createClient).toHaveBeenCalled());
    const request = createClient.mock.calls[0][0];
    const highway20 = request.facilities.find((f: { run_id: string }) => f.run_id === "run-highway-20");
    const carpentersville = request.facilities.find((f: { run_id: string }) => f.run_id === "run-carpentersville");
    expect(highway20.merchant_account_run_id).toBe("ma-highway-20");
    expect(carpentersville.merchant_account_run_id).toBe("ma-carpentersville-1");
  });

  // Regression test for the real Affordable Storage case, 2026-09-03:
  // Tanner (one of 9 facilities) resolved a legal name from a stray
  // `Company_Name:` answer while its own Corporate Info section stayed
  // blank in PS; Westpark was the actual "first time" facility with a
  // fully-answered section. `pickCompanySourceRun` used to grab
  // whichever run had *any* legal name first -- Tanner, since it's
  // earlier in this list -- leaving the Company section almost entirely
  // blank even though Westpark's real data was right there in the same
  // batch.
  it("prefers the run PS marks as the real first-time facility over one that merely resolved a legal name", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        { run_id: "run-tanner", run_name: "Affordable Storage Tanner - BEAU RYAN" },
        { run_id: "run-westpark", run_name: "Affordable Storage Westpark - BEAU RYAN" },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-tanner",
            is_first_time: false,
            company: mappedCompany({ legal_name: "Affordable Storage" }),
            facility: mappedFacility({ name: "Affordable Storage Tanner" }),
          },
          {
            run_id: "run-westpark",
            is_first_time: true,
            company: mappedCompany({
              legal_name: "Affordable Storage",
              corporate_email: "beau@rockspring.com",
              corporate_phone: "8329783228",
              corporate_address_street: "13627 Comely Lane",
              corporate_address_city: "Houston",
              corporate_address_state: "Texas",
              corporate_address_zip: "77079",
              subdomain: "affstor.qms-email.com",
            }),
            facility: mappedFacility({ name: "Affordable Storage Westpark" }),
          },
        ],
      },
    });

    render(<ClientsNewPage />);

    await screen.findByRole("heading", { name: "Affordable Storage" });
    expect(screen.getByText("beau@rockspring.com")).toBeInTheDocument();
    expect(screen.getByText("13627 Comely Lane")).toBeInTheDocument();
    expect(screen.getByText("affstor.qms-email.com")).toBeInTheDocument();
  });

  // No selected run answered "Yes" -- falls back to whichever has the
  // most complete company data, not just whichever comes first.
  it("prefers the most complete company data when no selected run answered yes to first-time", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        { run_id: "run-sparse", run_name: "Sparse Run" },
        { run_id: "run-full", run_name: "Full Run" },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-sparse",
            is_first_time: false,
            company: mappedCompany({ legal_name: "Some Company" }),
            facility: mappedFacility({ name: "Sparse Facility" }),
          },
          {
            run_id: "run-full",
            is_first_time: null,
            company: mappedCompany({
              legal_name: "Some Company",
              corporate_email: "office@somecompany.com",
              corporate_phone: "5551234567",
            }),
            facility: mappedFacility({ name: "Full Facility" }),
          },
        ],
      },
    });

    render(<ClientsNewPage />);

    await screen.findByRole("heading", { name: "Some Company" });
    expect(screen.getByText("office@somecompany.com")).toBeInTheDocument();
    expect(screen.getByText("5551234567")).toBeInTheDocument();
  });

  it("lets edited values override the previewed ones before submitting", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([{ run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" }])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility(),
          },
        ],
      },
    });
    createClient.mockResolvedValue({ kind: "ok", data: { company_id: "company-1", facility_ids: [] } });

    const user = userEvent.setup();
    render(<ClientsNewPage />);
    await screen.findByRole("heading", { name: "Prairie Enterprises LLC" });

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const legalNameInput = screen.getByDisplayValue("Prairie Enterprises LLC");
    await user.clear(legalNameInput);
    await user.type(legalNameInput, "Corrected Legal Name LLC");

    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createClient).toHaveBeenCalled());
    expect(createClient.mock.calls[0][0].company.legal_name).toBe("Corrected Legal Name LLC");
  });

  it("shows an error and does not navigate when create fails", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([{ run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" }])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility(),
          },
        ],
      },
    });
    createClient.mockResolvedValue({ kind: "error", message: "Already in OO, not imported again: run-highway-20" });

    const user = userEvent.setup();
    render(<ClientsNewPage />);
    await screen.findByRole("heading", { name: "Prairie Enterprises LLC" });

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Already in OO");
    expect(push).not.toHaveBeenCalled();
  });

  // Regression test for the confirmation screen's own slow-load
  // complaint: while the preview call is in flight, show the same
  // Process Street fetching interstitial the search page uses, not a
  // bare "Loading…" string.
  it("shows the Process Street fetching interstitial while the preview loads", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([{ run_id: "run-highway-20", run_name: "Highway 20 Self Storage - QMS Onboarding" }])
    );
    let resolvePreview!: (value: unknown) => void;
    previewClients.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      })
    );

    render(<ClientsNewPage />);

    expect(await screen.findByText("Fetching data from Process Street…")).toBeInTheDocument();

    resolvePreview({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-highway-20",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility(),
          },
        ],
      },
    });

    expect(await screen.findByRole("heading", { name: "Highway 20 Self Storage" })).toBeInTheDocument();
    expect(screen.queryByText("Fetching data from Process Street…")).not.toBeInTheDocument();
  });

  // Regression test for the real gap Boris flagged: once the user has
  // already picked the correct "Potential Duplicates" candidate on the
  // search page, that choice must reach the preview call verbatim, not
  // get silently dropped -- the confirmation screen has no business
  // re-resolving an ambiguity the user already resolved.
  it("forwards the user's already-chosen Merchant Account run id to previewClients", async () => {
    useSearchParams.mockReturnValue(
      selectionParams([
        {
          run_id: "run-carpentersville",
          run_name: "Carpentersville Self Storage - QMS Onboarding",
          merchant_account_run_id: "ma-carpentersville-1",
        },
      ])
    );
    previewClients.mockResolvedValue({
      kind: "ok",
      data: {
        runs: [
          {
            run_id: "run-carpentersville",
            company: mappedCompany({ legal_name: "Prairie Enterprises LLC" }),
            facility: mappedFacility({ name: "Carpentersville Self Storage" }),
          },
        ],
      },
    });

    render(<ClientsNewPage />);

    await screen.findByRole("heading", { name: "Carpentersville Self Storage" });

    expect(previewClients).toHaveBeenCalledWith([
      {
        run_id: "run-carpentersville",
        run_name: "Carpentersville Self Storage - QMS Onboarding",
        merchant_account_run_id: "ma-carpentersville-1",
      },
    ]);
  });
});
