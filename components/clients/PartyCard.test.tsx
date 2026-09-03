import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PartyCard, { type PartyCardData } from "./PartyCard";

function party(overrides: Partial<PartyCardData> = {}): PartyCardData {
  return {
    display_name: "Kyle Lindley",
    title: "Owner",
    ownership_percent: 30,
    email: "kyle.lindley@outlook.com",
    phone: "6306500137",
    ssn: "394547868",
    dob: "1966-12-09T13:00:00.000Z",
    home_address_line1: "2932 Black Walnut Ln",
    home_city: "St. Charles",
    home_state_or_province: "IL",
    home_postal_code: "60174-7972",
    ...overrides,
  };
}

describe("PartyCard", () => {
  it("formats phone as xxx-xxx-xxxx", () => {
    render(<PartyCard party={party()} badge="owner" />);
    expect(screen.getByText("630-650-0137")).toBeInTheDocument();
  });

  it("formats date of birth as mm-dd-yyyy with no time", () => {
    render(<PartyCard party={party()} badge="owner" />);
    expect(screen.getByText("12-09-1966")).toBeInTheDocument();
    expect(screen.queryByText(/13:00/)).not.toBeInTheDocument();
  });

  it("masks the SSN entirely by default and reveals the real value behind a Show/Hide toggle", () => {
    render(<PartyCard party={party()} badge="owner" />);

    // Fully masked -- no digits, not even the last 4 (corrected 2026-09-03).
    expect(screen.queryByText("394547868")).not.toBeInTheDocument();
    expect(screen.queryByText(/7868/)).not.toBeInTheDocument();
    expect(screen.getByText("•••-••-••••")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("394547868")).toBeInTheDocument();
    expect(screen.queryByText("•••-••-••••")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByText("•••-••-••••")).toBeInTheDocument();
  });

  it("shows an em dash for missing phone/ssn/dob rather than blank cells", () => {
    render(
      <PartyCard party={party({ phone: null, ssn: null, dob: null })} badge="owner" />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the badge and display name", () => {
    render(<PartyCard party={party()} badge="owner — Highway 20" />);
    expect(screen.getByText("Kyle Lindley")).toBeInTheDocument();
    expect(screen.getByText("owner — Highway 20")).toBeInTheDocument();
  });
});
