import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FacilityPerson } from "@/lib/clientsDetail";
import { RosterTable } from "./RosterTable";

const noop = vi.fn();

function person(overrides: Partial<FacilityPerson>): FacilityPerson {
  return {
    person_id: "p1",
    full_name: "Pat Sample",
    email: "pat.sample@example.com",
    phone: "5550100101",
    role: "owner",
    source: "process_street",
    legal_owner: false,
    ...overrides,
  };
}

function renderTable(roster: FacilityPerson[]) {
  return render(
    <RosterTable
      roster={roster}
      pendingKey={null}
      editingKey={null}
      editForm={{ full_name: "", email: "", phone: "", role: "owner" }}
      editProtect={false}
      editSaving={false}
      editError={null}
      onStartEdit={noop}
      onCancelEdit={noop}
      onEditFormChange={noop}
      onEditProtectChange={noop}
      onSaveEdit={noop}
      onRemove={noop}
    />
  );
}

describe("RosterTable", () => {
  it("labels the QMS user level 'Access Level' and adds a 'Legal Owner' column", () => {
    renderTable([person({})]);

    expect(screen.getByRole("columnheader", { name: "Access Level" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Legal Owner" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Role" })).not.toBeInTheDocument();
  });

  it("checks Legal Owner only for people flagged from the Merchant Pre-App, independent of access level", () => {
    renderTable([
      person({ person_id: "p1", full_name: "Pat Sample", role: "owner", legal_owner: true }),
      person({ person_id: "p2", full_name: "Sam Example", role: "owner", legal_owner: false }),
      person({ person_id: "p3", full_name: "Alex Placeholder", role: "manager", legal_owner: true }),
    ]);

    expect(screen.getByRole("checkbox", { name: "Pat Sample is a legal owner" })).toBeChecked();
    // Same "Owner" access level as Pat, but not a legal owner -- the whole point.
    expect(screen.getByRole("checkbox", { name: "Sam Example is not a legal owner" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Alex Placeholder is a legal owner" })).toBeChecked();
  });

  it("makes the Legal Owner checkbox read-only", () => {
    renderTable([person({ legal_owner: true })]);

    expect(screen.getByRole("checkbox", { name: "Pat Sample is a legal owner" })).toBeDisabled();
  });

  it("still shows the access level label for each person", () => {
    renderTable([person({ role: "district_manager" })]);

    const row = screen.getByRole("row", { name: /Pat Sample/ });
    expect(within(row).getByText("District Manager")).toBeInTheDocument();
  });
});
