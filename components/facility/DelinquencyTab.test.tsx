import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DelinquencyEntry, FacilityPolicies } from "@/lib/clientsDetail";

const { updateFacilityDelinquency } = vi.hoisted(() => ({
  updateFacilityDelinquency: vi.fn(),
}));

vi.mock("@/lib/clientsDetail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clientsDetail")>(
    "@/lib/clientsDetail"
  );
  return { ...actual, updateFacilityDelinquency };
});

import { DelinquencyTab } from "./DelinquencyTab";

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

const lateFee: DelinquencyEntry = {
  id: 1,
  category: "late_fee",
  name: "1st Late Fee",
  amount: 25,
  days_after: 5,
  trigger_type: "paid_through_date",
  trigger_category: null,
  sort_order: 0,
};

function renderTab(overrides: Partial<FacilityPolicies> = {}) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <DelinquencyTab
      companyId="c1"
      facilityId="f1"
      policies={policies(overrides)}
      onSaved={onSaved}
    />
  );
  return { onSaved };
}

describe("DelinquencyTab read view", () => {
  it("shows a placeholder with no entries yet", () => {
    renderTab();
    expect(
      screen.getByText("No delinquency entries captured for this facility yet.")
    ).toBeInTheDocument();
  });

  it("describes a paid-through-date trigger with its days_after", () => {
    renderTab({ delinquency_entries: [lateFee] });
    expect(screen.getByText("5 days after Paid Through Date")).toBeInTheDocument();
  });

  it("describes a step-category trigger by the other step's label", () => {
    renderTab({
      delinquency_entries: [
        { ...lateFee, id: 2, trigger_type: "step_category", trigger_category: "pre_lien", days_after: null },
      ],
    });
    expect(screen.getByText("Pre-Lien")).toBeInTheDocument();
  });

  it("shows legacy free-text steps imported from Process Street, when present", () => {
    renderTab({
      delinquency_steps: [{ step_order: 0, step_type: "lien", raw_value: "Filed after 30 days" }],
    });
    expect(screen.getByText("From an Earlier Process Street Import")).toBeInTheDocument();
    expect(screen.getByText("Filed after 30 days")).toBeInTheDocument();
  });
});

describe("DelinquencyTab editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds a blank draft (amount defaulting to 0) when there are no entries yet", async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByPlaceholderText("Amount ($)")).toHaveValue(0);
  });

  it("seeds one draft per existing entry, converting numbers to editable strings", async () => {
    const user = userEvent.setup();
    renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByPlaceholderText("Amount ($)")).toHaveValue(25);
    expect(screen.getByPlaceholderText("Days after")).toHaveValue(5);
  });

  it("refuses to save when the same category is used twice", async () => {
    const user = userEvent.setup();
    renderTab({
      delinquency_entries: [lateFee, { ...lateFee, id: 2, name: "2nd Late Fee" }],
    });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/used more than once/i)
    ).toBeInTheDocument();
    expect(updateFacilityDelinquency).not.toHaveBeenCalled();
  });

  it("refuses to save when an amount is blank", async () => {
    const user = userEvent.setup();
    renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByPlaceholderText("Amount ($)"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/needs a dollar amount/i)).toBeInTheDocument();
    expect(updateFacilityDelinquency).not.toHaveBeenCalled();
  });

  it("allows a zero amount -- it is not treated as blank", async () => {
    const user = userEvent.setup();
    updateFacilityDelinquency.mockResolvedValue({ kind: "ok", data: undefined });
    renderTab();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateFacilityDelinquency).toHaveBeenCalledTimes(1);
  });

  it("converts a blank days_after to null and builds trigger_type/trigger_category correctly", async () => {
    const user = userEvent.setup();
    updateFacilityDelinquency.mockResolvedValue({ kind: "ok", data: undefined });
    renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByPlaceholderText("Days after"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateFacilityDelinquency).toHaveBeenCalledWith("c1", "f1", [
      expect.objectContaining({
        days_after: null,
        trigger_type: "paid_through_date",
        trigger_category: null,
      }),
    ]);
  });

  it("calls onSaved and returns to read mode on success", async () => {
    const user = userEvent.setup();
    updateFacilityDelinquency.mockResolvedValue({ kind: "ok", data: undefined });
    const { onSaved } = renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("surfaces a backend error and stays in edit mode", async () => {
    const user = userEvent.setup();
    updateFacilityDelinquency.mockResolvedValue({ kind: "error", message: "could not save" });
    renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not save");
  });

  it("Add Entry appends a draft and Remove deletes it", async () => {
    const user = userEvent.setup();
    renderTab({ delinquency_entries: [lateFee] });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "+ Add Entry" }));
    expect(screen.getAllByPlaceholderText("Amount ($)")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getAllByPlaceholderText("Amount ($)")).toHaveLength(1);
  });
});
