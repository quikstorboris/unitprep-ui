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
});
