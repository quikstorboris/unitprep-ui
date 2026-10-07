import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CompanyTabs from "./CompanyTabs";

const { usePathname, useClickUpAccess } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useClickUpAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

vi.mock("@/components/clickup/useClickUpAccess", () => ({ useClickUpAccess }));

beforeEach(() => {
  useClickUpAccess.mockReturnValue({ allowed: false });
});

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

  it("shows ClickUp Copy between General and Onboarding Summary for a user with ClickUp access", () => {
    usePathname.mockReturnValue("/clients/c1/info");
    useClickUpAccess.mockReturnValue({ allowed: true });

    render(<CompanyTabs clientId="c1" />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "General",
      "ClickUp Copy",
      "Onboarding Summary",
    ]);
    expect(screen.getByRole("link", { name: "ClickUp Copy" })).toHaveAttribute(
      "href",
      "/clients/c1/clickup-copy"
    );
  });

  it("hides ClickUp Copy from a user without ClickUp access", () => {
    usePathname.mockReturnValue("/clients/c1/info");

    render(<CompanyTabs clientId="c1" />);

    expect(screen.queryByRole("link", { name: "ClickUp Copy" })).not.toBeInTheDocument();
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
