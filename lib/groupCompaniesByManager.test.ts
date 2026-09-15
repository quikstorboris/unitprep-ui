import { describe, expect, it } from "vitest";

import { groupByImplementationManager } from "./groupCompaniesByManager";
import type { CompanyDirectoryEntry } from "./clientsDirectory";

function company(overrides: Partial<CompanyDirectoryEntry> = {}): CompanyDirectoryEntry {
  return {
    id: "company-1",
    legal_name: "Prairie Enterprises LLC",
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    facility_names: [],
    implementation_manager: null,
    sales_rep: null,
    ...overrides,
  };
}

describe("groupByImplementationManager", () => {
  it("returns no groups for an empty list", () => {
    expect(groupByImplementationManager([])).toEqual([]);
  });

  it("groups companies with no Implementation Manager under Unassigned", () => {
    const groups = groupByImplementationManager([company()]);

    expect(groups).toEqual([
      { key: "unassigned", label: "Unassigned", companies: [company()] },
    ]);
  });

  it("groups companies by their Implementation Manager's id, not just name", () => {
    const a = company({ id: "a", implementation_manager: { id: "im-1", name: "Sarah McDougal" } });
    const b = company({ id: "b", implementation_manager: { id: "im-1", name: "Sarah McDougal" } });

    const groups = groupByImplementationManager([a, b]);

    expect(groups).toHaveLength(1);
    expect(groups[0].companies).toEqual([a, b]);
  });

  it("sorts named groups alphabetically, with Unassigned always last", () => {
    const unassigned = company({ id: "u", implementation_manager: null });
    const zed = company({ id: "z", implementation_manager: { id: "im-z", name: "Zed Zephyr" } });
    const alice = company({ id: "a", implementation_manager: { id: "im-a", name: "Alice Ng" } });

    const groups = groupByImplementationManager([unassigned, zed, alice]);

    expect(groups.map((group) => group.label)).toEqual(["Alice Ng", "Zed Zephyr", "Unassigned"]);
  });
});
