import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DuplicateCustomerRecordsSection from "./DuplicateCustomerRecordsSection";
import type { DuplicateCustomerRecordView } from "@/types/api";

function makeRecord(
  overrides: Partial<DuplicateCustomerRecordView> = {}
): DuplicateCustomerRecordView {
  return {
    display_name: "Frank Flores",
    tenants: [
      { tenant_id: "186417", units: ["B18"] },
      { tenant_id: "182866", units: ["B26"] },
    ],
    differing_categories: [],
    note: "Frank Flores has 2 separate customer records.",
    ...overrides,
  };
}

describe("DuplicateCustomerRecordsSection", () => {
  it("renders heading, explanation, IDs with units, match badge and note", () => {
    render(<DuplicateCustomerRecordsSection records={[makeRecord()]} />);

    expect(
      screen.getByText("Possible duplicate customer records (1)")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/One person recorded under more than one customer ID/)
    ).toBeInTheDocument();
    expect(screen.getByText("Frank Flores")).toBeInTheDocument();
    expect(screen.getByText("ID 186417 — unit B18")).toBeInTheDocument();
    expect(screen.getByText("ID 182866 — unit B26")).toBeInTheDocument();
    expect(screen.getByText("Contact details match")).toBeInTheDocument();
    expect(
      screen.getByText("Frank Flores has 2 separate customer records.")
    ).toBeInTheDocument();
  });

  it("lists differing categories with readable labels", () => {
    render(
      <DuplicateCustomerRecordsSection
        records={[makeRecord({ differing_categories: ["Phone", "Address"] })]}
      />
    );

    expect(
      screen.getByText("Also differs: phone number, address")
    ).toBeInTheDocument();
    expect(screen.queryByText("Contact details match")).not.toBeInTheDocument();
  });

  it("shows only the ID when units are empty", () => {
    render(
      <DuplicateCustomerRecordsSection
        records={[
          makeRecord({
            tenants: [
              { tenant_id: "111", units: [] },
              { tenant_id: "222", units: [] },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("ID 111")).toBeInTheDocument();
    expect(screen.getByText("ID 222")).toBeInTheDocument();
    expect(screen.queryByText(/no units/)).not.toBeInTheDocument();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(
      <DuplicateCustomerRecordsSection records={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the list is undefined (older cached report)", () => {
    const { container } = render(<DuplicateCustomerRecordsSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
