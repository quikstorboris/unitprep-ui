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

const ADMIN_PERMISSIONS = [
  "users.manage",
  "users.manage_roles",
  "audit_logs.read",
  "activity_logs.read",
  "security_policies.manage",
  "client_ops.manage_tags",
];

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

  it("renders the logo and a link per nav item for an admin", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u1",
        first_name: "Ada",
        last_name: "Lovelace",
        roles: ["admin"],
        permissions: ADMIN_PERMISSIONS,
        totp_enrolled: true,
      },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    expect(screen.getByAltText("Orchestrator")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clients" })
    ).toHaveAttribute("href", "/clients");
    expect(
      screen.getByRole("link", { name: "Users" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      screen.getByRole("link", { name: "Roles" })
    ).toHaveAttribute("href", "/admin/roles");
    expect(
      screen.getByRole("link", { name: "Security Logs" })
    ).toHaveAttribute("href", "/admin/security-logs");
    expect(
      screen.getByRole("link", { name: "Activity Logs" })
    ).toHaveAttribute("href", "/admin/activity-logs");
    expect(
      screen.getByRole("link", { name: "Security Policies" })
    ).toHaveAttribute("href", "/admin/security-policies");
    expect(
      screen.getByRole("link", { name: "QMS Tags" })
    ).toHaveAttribute("href", "/admin/client-ops/qms-tags");
    expect(
      screen.getByRole("link", { name: "Account" })
    ).toHaveAttribute("href", "/account");
  });

  it("hides every Administration link for a signed-in caller with no admin-shaped permissions", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u2",
        first_name: "Grace",
        last_name: "Hopper",
        roles: ["onboarding_manager"],
        permissions: ["client_ops.perform"],
        totp_enrolled: true,
      },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    for (const label of [
      "Users",
      "Roles",
      "Security Logs",
      "Activity Logs",
      "Security Policies",
      "QMS Tags",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Clients" })).toBeInTheDocument();
  });

  it("shows only the Administration links a partial permission set covers", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u3",
        first_name: "Katherine",
        last_name: "Johnson",
        roles: ["district_manager_stand_in"],
        permissions: ["audit_logs.read"],
        totp_enrolled: true,
      },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    expect(
      screen.getByRole("link", { name: "Security Logs" })
    ).toBeInTheDocument();
    for (const label of ["Users", "Roles", "Activity Logs", "Security Policies"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("hides every Administration link when signed out", () => {
    usePathname.mockReturnValue("/clients");
    // Default beforeEach state: user: null.

    render(<LeftNav />);

    for (const label of [
      "Users",
      "Roles",
      "Security Logs",
      "Activity Logs",
      "Security Policies",
      "QMS Tags",
    ]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
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

  it("shows the signed-in user's name in the footer", () => {
    usePathname.mockReturnValue("/clients");
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u1",
        first_name: "Ada",
        last_name: "Lovelace",
        roles: ["admin", "onboarding_manager"],
        permissions: ADMIN_PERMISSIONS,
        totp_enrolled: true,
      },
      signOut: vi.fn(),
    });

    render(<LeftNav />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("signs out and redirects to /login when signed in", async () => {
    usePathname.mockReturnValue("/clients");
    const signOut = vi.fn().mockResolvedValue(undefined);
    const replace = vi.fn();
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u1",
        first_name: "Ada",
        last_name: "Lovelace",
        roles: ["admin"],
        permissions: ADMIN_PERMISSIONS,
        totp_enrolled: false,
      },
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
