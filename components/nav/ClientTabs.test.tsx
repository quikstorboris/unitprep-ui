import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ClientTabs from "./ClientTabs";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("ClientTabs", () => {
  it("renders a tab link per tool, pointed at this client", () => {
    usePathname.mockReturnValue("/clients/c1/info");

    render(<ClientTabs clientId="c1" />);

    expect(
      screen.getByRole("link", { name: "Client Info" })
    ).toHaveAttribute("href", "/clients/c1/info");
    expect(
      screen.getByRole("link", { name: "Dedup" })
    ).toHaveAttribute("href", "/clients/c1/dedup");
    expect(
      screen.getByRole("link", { name: "Unit Groups" })
    ).toHaveAttribute("href", "/clients/c1/unit-groups");
    expect(
      screen.getByRole("link", { name: "Template Tagger" })
    ).toHaveAttribute("href", "/clients/c1/template-tagger");
  });

  it("points every tab at the given client id", () => {
    usePathname.mockReturnValue("/clients/c2/info");

    render(<ClientTabs clientId="c2" />);

    expect(
      screen.getByRole("link", { name: "Client Info" })
    ).toHaveAttribute("href", "/clients/c2/info");
    expect(
      screen.getByRole("link", { name: "Dedup" })
    ).toHaveAttribute("href", "/clients/c2/dedup");
    expect(
      screen.getByRole("link", { name: "Unit Groups" })
    ).toHaveAttribute("href", "/clients/c2/unit-groups");
    expect(
      screen.getByRole("link", { name: "Template Tagger" })
    ).toHaveAttribute("href", "/clients/c2/template-tagger");
  });

  it("renders all four tabs regardless of which path is current", () => {
    usePathname.mockReturnValue("/clients/c1");

    render(<ClientTabs clientId="c1" />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("marks only the active tab with aria-current", () => {
    usePathname.mockReturnValue("/clients/c1/dedup");

    render(<ClientTabs clientId="c1" />);

    expect(
      screen.getByRole("link", { name: "Dedup" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Client Info" })
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Unit Groups" })
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Template Tagger" })
    ).not.toHaveAttribute("aria-current");
  });
});
