import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FacilityOnboardingSummary } from "@/lib/clientsDetail";
import { ElavonStatusCell } from "./ElavonStatusCell";

function facility(overrides: Partial<FacilityOnboardingSummary>): FacilityOnboardingSummary {
  return {
    facility_id: "f1",
    facility_name: "Facility",
    elavon_linked: true,
    elavon_next_step: null,
    elavon_awaiting_credentials: false,
    elavon_complete: false,
    duplicate_checks_completed: 0,
    ...overrides,
  };
}

describe("ElavonStatusCell", () => {
  it("says Not Started when no Merchant Account run is linked", () => {
    render(<ElavonStatusCell facility={facility({ elavon_linked: false })} />);
    expect(screen.getByText("Not Started")).toBeInTheDocument();
  });

  it("shows the earliest incomplete step while the credentials step is open", () => {
    render(
      <ElavonStatusCell
        facility={facility({ elavon_next_step: "Application Signed & Submitted to Elavon" })}
      />
    );
    expect(screen.getByText("Application Signed & Submitted to Elavon")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("nudges about QMS credentials when the pending step is the credentials step", () => {
    render(
      <ElavonStatusCell
        facility={facility({
          elavon_next_step: "Document Credentials",
          elavon_awaiting_credentials: true,
        })}
      />
    );
    expect(screen.getByText("Be sure to add credentials to QMS.")).toBeInTheDocument();
  });

  it("reads Complete once the credentials step is done, even with an earlier step still open", () => {
    render(
      <ElavonStatusCell
        facility={facility({
          elavon_complete: true,
          elavon_next_step: "Application Signed & Submitted to Elavon",
        })}
      />
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(
      screen.queryByText("Application Signed & Submitted to Elavon")
    ).not.toBeInTheDocument();
  });

  it("does not claim Complete when no credentials step exists and nothing is outstanding", () => {
    render(<ElavonStatusCell facility={facility({})} />);
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });
});
