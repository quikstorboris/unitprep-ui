import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CompanyTabs from "./CompanyTabs";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("CompanyTabs", () => {
  it("renders General and Onboarding Summary tabs, pointed at the given client", () => {
    usePathname.mockReturnValue("/clients/c1/info");

    render(<CompanyTabs clientId="c1" />);

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute("href", "/clients/c1/info");
    expect(screen.getByRole("link", { name: "Onboarding Summary" })).toHaveAttribute(
      "href",
      "/clients/c1/onboarding-summary"
    );
  });

  it("renders no tab bar at all once a facility is selected", () => {
    usePathname.mockReturnValue("/clients/c1/facilities/f1/dedup");

    const { container } = render(<CompanyTabs clientId="c1" facilityId="f1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks only the active tab with aria-current", () => {
    usePathname.mockReturnValue("/clients/c1/onboarding-summary");

    render(<CompanyTabs clientId="c1" />);

    expect(screen.getByRole("link", { name: "Onboarding Summary" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "General" })).not.toHaveAttribute("aria-current");
  });
});
