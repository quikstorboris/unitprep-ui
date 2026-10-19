import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddFacilityDialog from "./AddFacilityDialog";

const searchPsRuns = vi.fn();
const addFacility = vi.fn();

vi.mock("@/lib/clientsCompanies", () => ({
  searchPsRuns: (...args: unknown[]) => searchPsRuns(...args),
  addFacility: (...args: unknown[]) => addFacility(...args),
}));

const matches = [
  { run_id: "run-free", run_name: "Woodland - QMS Onboarding", matched_person: "Pat Moss", already_in: null },
  {
    run_id: "run-taken",
    run_name: "Longview - QMS Onboarding",
    matched_person: null,
    already_in: { company_id: "c9", company_name: "Other Co" },
  },
];

describe("AddFacilityDialog", () => {
  beforeEach(() => {
    searchPsRuns.mockReset();
    addFacility.mockReset();
    searchPsRuns.mockResolvedValue({ kind: "ok", data: { matches } });
  });

  async function openAndSearch(text: string) {
    await userEvent.click(screen.getByRole("button", { name: "Add facility" }));
    await userEvent.type(screen.getByLabelText("Search Process Street runs"), text);
  }

  it("lists matches, flags runs already in OO and disables adding them", async () => {
    render(<AddFacilityDialog companyId="c1" onAdded={() => {}} />);
    await openAndSearch("moss");

    expect(await screen.findByText("Woodland - QMS Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Matched person: Pat Moss")).toBeInTheDocument();
    expect(screen.getByText("Already in OO under Other Co")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: "Add" });
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeDisabled();
  });

  it("adds the chosen run and tells the page", async () => {
    addFacility.mockResolvedValue({ kind: "ok", data: { facility_id: "f1" } });
    const onAdded = vi.fn();
    render(<AddFacilityDialog companyId="c1" onAdded={onAdded} />);
    await openAndSearch("moss");

    await userEvent.click((await screen.findAllByRole("button", { name: "Add" }))[0]);

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(addFacility).toHaveBeenCalledWith("c1", { run_id: "run-free", merchant_account_run_id: null });
  });

  it("adds straight from a pasted run link without searching", async () => {
    addFacility.mockResolvedValue({ kind: "ok", data: { facility_id: "f1" } });
    render(<AddFacilityDialog companyId="c1" onAdded={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add facility" }));
    const input = screen.getByLabelText("Search Process Street runs");
    await userEvent.click(input);
    await userEvent.paste(
      "https://app.process.st/runs/Longview-Self-Storage-QMS-Onboarding-misXFuUwTRgBoTtGVj18wA/tasks/kz5OAp8nG3G2hlrz5FZM1A",
    );

    await userEvent.click(await screen.findByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addFacility).toHaveBeenCalledWith("c1", {
        run_id: "misXFuUwTRgBoTtGVj18wA",
        merchant_account_run_id: null,
      }),
    );
    expect(searchPsRuns).not.toHaveBeenCalled();
  });

  it("shows the error and stays open when adding fails", async () => {
    addFacility.mockResolvedValue({ kind: "error", message: "Already in OO, not imported again: run-free" });
    const onAdded = vi.fn();
    render(<AddFacilityDialog companyId="c1" onAdded={onAdded} />);
    await openAndSearch("moss");

    await userEvent.click((await screen.findAllByRole("button", { name: "Add" }))[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Already in OO");
    expect(onAdded).not.toHaveBeenCalled();
  });
});
