import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CompanyDirectoryEntry } from "@/lib/clientsDirectory";

import CompanyDirectoryGrid from "./CompanyDirectoryGrid";

function company(overrides: Partial<CompanyDirectoryEntry> = {}): CompanyDirectoryEntry {
  return {
    id: "company-1",
    legal_name: "Prairie Enterprises LLC",
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    implementation_completed_at: null,
    facility_names: [],
    implementation_manager: null,
    sales_rep: null,
    ...overrides,
  } as CompanyDirectoryEntry;
}

describe("CompanyDirectoryGrid", () => {
  it("makes each company a real link to its client page", () => {
    render(
      <CompanyDirectoryGrid
        companies={[company(), company({ id: "company-2", legal_name: "Westpark Storage" })]}
        pendingId={null}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Prairie Enterprises LLC" })).toHaveAttribute(
      "href",
      "/clients/company-1/info",
    );
    expect(screen.getByRole("link", { name: "Westpark Storage" })).toHaveAttribute(
      "href",
      "/clients/company-2/info",
    );
  });
});
