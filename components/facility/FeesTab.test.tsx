import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FacilityPolicies, FeeRow } from "@/lib/clientsDetail";

const { updateFacilityFees } = vi.hoisted(() => ({
  updateFacilityFees: vi.fn(),
}));

vi.mock("@/lib/clientsDetail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clientsDetail")>(
    "@/lib/clientsDetail"
  );
  return { ...actual, updateFacilityFees };
});

import { FeesTab } from "./FeesTab";

function policies(overrides: Partial<FacilityPolicies> = {}): FacilityPolicies {
  return {
    fees: [],
    taxes: null,
    tax_entries: [],
    delinquency_steps: [],
    delinquency_entries: [],
    coverage_tiers: [],
    commission: null,
    specials_raw_text: null,
    is_qsx_legacy: false,
    fees_manually_exempt: false,
    taxes_manually_exempt: false,
    delinquency_manually_exempt: false,
    coverage_manually_exempt: false,
    specials_manually_exempt: false,
    ...overrides,
  };
}

const existingFee: FeeRow = {
  fee_type: "security_deposit",
  label: null,
  raw_value: "$150",
};

function renderTab(overrides: Partial<FacilityPolicies> = {}) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <FeesTab
      companyId="c1"
      facilityId="f1"
      policies={policies(overrides)}
      onSaved={onSaved}
    />
  );
  return { onSaved };
}

describe("FeesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a placeholder message with no fees yet, in read mode", () => {
    renderTab();
    expect(
      screen.getByText("No fee data captured for this facility yet.")
    ).toBeInTheDocument();
  });

  it("lists existing fees with a label falling back to the fee type", () => {
    renderTab({ fees: [existingFee] });
    expect(screen.getByText("Security Deposit")).toBeInTheDocument();
    expect(screen.getByText("$150")).toBeInTheDocument();
  });

  it("shows the QSX empty banner only when empty, legacy, and not editing", () => {
    renderTab({ is_qsx_legacy: true });
    expect(screen.getByText(/no fee data for it/i)).toBeInTheDocument();
  });

  it("shows the manually-maintained note when this category is exempt", () => {
    renderTab({ fees_manually_exempt: true, fees: [existingFee] });
    expect(screen.getByText(/manually maintained/i)).toBeInTheDocument();
  });

  it("entering edit mode with no existing fees seeds a single blank row", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getAllByPlaceholderText("Value")).toHaveLength(1);
  });

  it("entering edit mode with existing fees seeds one row per fee", async () => {
    const user = userEvent.setup();
    renderTab({ fees: [existingFee, { fee_type: "cleaning", label: null, raw_value: "$75" }] });

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getAllByPlaceholderText("Value")).toHaveLength(2);
  });

  it("Add Fee appends a row and Remove deletes it", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "+ Add Fee" }));
    expect(screen.getAllByPlaceholderText("Value")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getAllByPlaceholderText("Value")).toHaveLength(1);
  });

  it("cancel discards edits and returns to read mode without saving", async () => {
    const user = userEvent.setup();
    renderTab({ fees: [existingFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getAllByPlaceholderText("Value")[0], "999");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateFacilityFees).not.toHaveBeenCalled();
    expect(screen.getByText("$150")).toBeInTheDocument();
  });

  it("save filters out rows left blank and calls onSaved on success", async () => {
    const user = userEvent.setup();
    updateFacilityFees.mockResolvedValue({ kind: "ok", data: undefined });
    const { onSaved } = renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "+ Add Fee" }));
    await user.type(screen.getAllByPlaceholderText("Value")[0], "$25");
    // second row left blank

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateFacilityFees).toHaveBeenCalledWith(
      "c1",
      "f1",
      expect.arrayContaining([expect.objectContaining({ raw_value: "$25" })])
    );
    expect(updateFacilityFees.mock.calls[0][2]).toHaveLength(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("shows the backend error and stays in edit mode on save failure", async () => {
    const user = userEvent.setup();
    updateFacilityFees.mockResolvedValue({ kind: "error", message: "could not save" });
    const { onSaved } = renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getAllByPlaceholderText("Value")[0], "$25");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not save");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
