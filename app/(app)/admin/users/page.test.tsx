import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSummary } from "@/lib/auth-users";

const { useCurrentUser, useUsersAdmin } = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  useUsersAdmin: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));
vi.mock("./useUsersAdmin", () => ({ useUsersAdmin }));

import AdminUsersPage from "./page";

function summary(overrides: Partial<UserSummary>): UserSummary {
  return {
    id: "user-1",
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    company: "quikstor",
    job_title: null,
    roles: [],
    status: "active",
    created_at: "2026-08-01T00:00:00Z",
    credential_count: 1,
    totp_enrolled: false,
    last_seen_at: null,
    ...overrides,
  };
}

function hookState(users: UserSummary[] | null) {
  const noop = vi.fn().mockResolvedValue(undefined);
  return {
    users,
    loadError: null,
    availableRoles: [],
    pendingUserId: null,
    rowError: null,
    issued: null,
    setIssued: vi.fn(),
    exportingUsers: false,
    exportError: null,
    handleExportUsers: noop,
    handleCreateUser: noop,
    handleReissue: noop,
    handleRecover: noop,
    handleDisable: noop,
    handleReactivate: noop,
    handleGrantRole: noop,
    handleRevokeRole: noop,
  };
}

describe("Users page > disabled users", () => {
  beforeEach(() => {
    useCurrentUser.mockReturnValue({
      user: { user_id: "me", permissions: ["users.view", "users.manage"], roles: ["admin"] },
    });
  });

  it("keeps deactivated users out of the main list and collapsed by default", () => {
    useUsersAdmin.mockReturnValue(
      hookState([
        summary({ id: "a", first_name: "Alice", last_name: "Active" }),
        summary({ id: "d", first_name: "Dan", last_name: "Disabled", status: "deactivated" }),
      ])
    );

    render(<AdminUsersPage />);

    expect(screen.getByText("Alice Active")).toBeInTheDocument();
    expect(screen.queryByText("Dan Disabled")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Disabled users \(1\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("expands to show the disabled users, with Reactivate available, and collapses again", async () => {
    const user = userEvent.setup();
    useUsersAdmin.mockReturnValue(
      hookState([
        summary({ id: "a", first_name: "Alice", last_name: "Active" }),
        summary({ id: "d", first_name: "Dan", last_name: "Disabled", status: "deactivated" }),
      ])
    );

    render(<AdminUsersPage />);
    await user.click(screen.getByRole("button", { name: /Disabled users/ }));

    const section = screen.getByRole("region", { name: "Disabled users" });
    expect(within(section).getByText("Dan Disabled")).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Reactivate" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Disabled users/ }));
    expect(screen.queryByText("Dan Disabled")).not.toBeInTheDocument();
  });

  it("shows a department manager the list but no invite, export, or admin actions", () => {
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "dm",
        permissions: ["users.view", "user_permissions.manage"],
        roles: ["department_manager"],
      },
    });
    useUsersAdmin.mockReturnValue(hookState([summary({ id: "a", first_name: "Alice", last_name: "Active" })]));

    render(<AdminUsersPage />);

    expect(screen.getByText("Alice Active")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite a user" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recover account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permissions" })).toBeInTheDocument();
  });

  it("says so when there are no disabled users", async () => {
    const user = userEvent.setup();
    useUsersAdmin.mockReturnValue(hookState([summary({ id: "a" })]));

    render(<AdminUsersPage />);
    await user.click(screen.getByRole("button", { name: /Disabled users \(0\)/ }));

    expect(screen.getByText("No disabled users.")).toBeInTheDocument();
  });
});
