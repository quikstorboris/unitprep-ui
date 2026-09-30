import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PersonAssignment } from "@/lib/clientsDetail";
import { CandidateChipsSection } from "./CandidateChipsSection";

function candidate(full_name: string, role: string): PersonAssignment {
  return { full_name, email: `${full_name.split(" ")[0].toLowerCase()}@example.com`, phone: null, role };
}

function renderChips(candidates: PersonAssignment[]) {
  return render(
    <CandidateChipsSection
      candidates={candidates}
      rosterByEmailAndRole={new Map()}
      pendingKey={null}
      actionError={null}
      onChipClick={vi.fn()}
    />
  );
}

describe("CandidateChipsSection", () => {
  it("leaves the ambiguous '(Owner)' tag off chips -- it only means owner-level QMS access", () => {
    renderChips([candidate("Pat Sample", "owner")]);

    const chip = screen.getByRole("button", { name: /Pat Sample/ });
    expect(chip).toHaveTextContent("+ Pat Sample");
    expect(chip).not.toHaveTextContent("Owner");
  });

  it("keeps the unambiguous district manager and manager tags", () => {
    renderChips([candidate("Sam Example", "district_manager"), candidate("Alex Placeholder", "manager")]);

    expect(screen.getByRole("button", { name: /Sam Example/ })).toHaveTextContent("(District Manager)");
    expect(screen.getByRole("button", { name: /Alex Placeholder/ })).toHaveTextContent("(Manager)");
  });
});
