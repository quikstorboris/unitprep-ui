import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LeftNav from "./LeftNav";

const { usePathname, useRouter, useCurrentUser } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
  useRouter,
}));

vi.mock("@/lib/currentUser", () => ({
  useCurrentUser,
}));

describe("LeftNav", () => {
  beforeEach(() => {
    useRouter.mockReturnValue({ replace: vi.fn() });
    // Signed out by default -- most existing tests only care about the
    // routed nav items, not the sign-out control, which only renders for
    // a signed-in user (see the dedicated describe block below).
    useCurrentUser.mockReturnValue({
      user: null,
      signOut: vi.fn(),
    });
  });

  it("renders the UnitPrep heading and a link per nav item for an admin", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: { user_id: "u1", role: "admin", totp_enrolled: true },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    expect(screen.getByText("UnitPrep")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toHaveAttribute("href", "/clients");
    expect(
      screen.getByRole("link", { name: "Users" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      screen.getByRole("link", { name: "Audit Logs" })
    ).toHaveAttribute("href", "/admin/audit-logs");
    expect(
      screen.getByRole("link", { name: "Account" })
    ).toHaveAttribute("href", "/account");
  });

  it("hides Users and Audit Logs for a signed-in non-admin role", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: { user_id: "u2", role: "onboarding_manager", totp_enrolled: true },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    expect(
      screen.queryByRole("link", { name: "Users" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Audit Logs" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toBeInTheDocument();
  });

  it("hides Users and Audit Logs when signed out", () => {
    usePathname.mockReturnValue("/clients");
    // Default beforeEach state: user: null.

    render(<LeftNav />);

    expect(
      screen.queryByRole("link", { name: "Users" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Audit Logs" })
    ).not.toBeInTheDocument();
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

  it("does not render a sign-out control when signed out", () => {
    usePathname.mockReturnValue("/clients");

    render(<LeftNav />);

    expect(
      screen.queryByRole("button", { name: /sign out/i })
    ).not.toBeInTheDocument();
  });

  it("signs out and redirects to /login when signed in", async () => {
    usePathname.mockReturnValue("/clients");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const replace = vi.fn();
    useCurrentUser.mockReturnValue({
      user: { user_id: "u1", role: "admin", totp_enrolled: false },
      signOut,
    });
    useRouter.mockReturnValue({ replace });

    render(<LeftNav />);

    await userEvent.click(
      screen.getByRole("button", { name: "Sign out" })
    );

    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
