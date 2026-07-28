import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LeftNav from "./LeftNav";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("LeftNav", () => {
  it("renders the UnitPrep heading and a link per nav item", () => {
    usePathname.mockReturnValue("/clients");

    render(<LeftNav />);

    expect(screen.getByText("UnitPrep")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toHaveAttribute("href", "/clients");
  });

  it("renders its nav items regardless of which path is current", () => {
    usePathname.mockReturnValue("/clients/c1/info");

    render(<LeftNav />);

    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toHaveAttribute("href", "/clients");
  });

  it("marks the Clients link with aria-current when its path is active", () => {
    usePathname.mockReturnValue("/clients/c1/info");

    render(<LeftNav />);

    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("does not mark the Clients link as current when its path isn't active", () => {
    usePathname.mockReturnValue("/somewhere-else");

    render(<LeftNav />);

    expect(
      screen.getByRole("link", { name: "Clients" })
    ).not.toHaveAttribute("aria-current");
  });
});
