import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RoleInfo, UserSummary } from "@/lib/auth-users";
import UserRow from "./UserRow";

function summary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: "user-1",
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    company: "quikstor",
    job_title: null,
    roles: ["onboarding_manager"],
    status: "active",
    created_at: "2026-08-01T00:00:00Z",
    credential_count: 1,
    totp_enrolled: false,
    last_seen_at: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

const roles: RoleInfo[] = [
  { key: "onboarding_manager", label: "Onboarding Manager", description: null, is_system: true, permissions: [] },
  { key: "admin", label: "Admin", description: null, is_system: true, permissions: [] },
];

function renderRow(overrides: Partial<React.ComponentProps<typeof UserRow>> = {}) {
  const handlers = {
    onReissue: vi.fn(),
    onRecover: vi.fn().mockResolvedValue(undefined),
    onDisable: vi.fn().mockResolvedValue(undefined),
    onReactivate: vi.fn().mockResolvedValue(undefined),
    onGrantRole: vi.fn().mockResolvedValue(undefined),
    onRevokeRole: vi.fn(),
  };

  render(
    <table>
      <tbody>
        <UserRow
          user={summary()}
          isSelf={false}
          isPending={false}
          availableRoles={roles}
          canManageUsers
          canManageRoles
          canManagePermissions={false}
          {...handlers}
          {...overrides}
        />
      </tbody>
    </table>
  );

  return handlers;
}

describe("UserRow", () => {
  it("shows a Disable button for an active, non-self user and requires a second click to confirm", async () => {
    const user = userEvent.setup();
    const handlers = renderRow();

    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(handlers.onDisable).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, disable" }));
    expect(handlers.onDisable).toHaveBeenCalledWith(summary());
  });

  it("cancelling the disable confirmation calls nothing and restores the original button", async () => {
    const user = userEvent.setup();
    const handlers = renderRow();

    await user.click(screen.getByRole("button", { name: "Disable" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(handlers.onDisable).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
  });

  it("never shows Disable, Recover, or Reactivate on the caller's own row", () => {
    renderRow({ isSelf: true });

    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recover account" })).not.toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("shows Recover account (not Disable) for an active user, with its own confirm step", async () => {
    const user = userEvent.setup();
    const handlers = renderRow();

    await user.click(screen.getByRole("button", { name: "Recover account" }));
    await user.click(screen.getByRole("button", { name: "Yes, recover" }));

    expect(handlers.onRecover).toHaveBeenCalledWith(summary());
  });

  it("shows Reactivate (not Disable/Recover) for a deactivated user", async () => {
    const user = userEvent.setup();
    const handlers = renderRow({ user: summary({ status: "deactivated" }) });

    expect(screen.queryByRole("button", { name: "Disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recover account" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reactivate" }));
    await user.click(screen.getByRole("button", { name: "Yes, reactivate" }));

    expect(handlers.onReactivate).toHaveBeenCalledWith(
      summary({ status: "deactivated" })
    );
  });

  it("shows Reissue invite only for an invited user with zero credentials", () => {
    renderRow({
      user: summary({ status: "invited", credential_count: 0 }),
    });

    expect(screen.getByRole("button", { name: "Reissue invite" })).toBeInTheDocument();
  });

  it("does not show Reissue invite once a credential has been registered", () => {
    renderRow({
      user: summary({ status: "invited", credential_count: 1 }),
    });

    expect(
      screen.queryByRole("button", { name: "Reissue invite" })
    ).not.toBeInTheDocument();
  });

  it("shows roles read-only in the row -- editing lives in the permissions dialog", () => {
    renderRow({ user: summary({ roles: ["onboarding_manager", "admin"] }) });

    expect(screen.getByText("Onboarding Manager")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove .* role/ })).not.toBeInTheDocument();
  });

  it("opens the permissions dialog from the Permissions button", async () => {
    const user = userEvent.setup();
    renderRow();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Permissions" }));

    expect(screen.getByRole("dialog", { name: "Permissions" })).toBeInTheDocument();
  });

  it("closes the permissions dialog again", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Permissions" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not offer Permissions on the caller's own row", () => {
    renderRow({ isSelf: true });

    expect(screen.queryByRole("button", { name: "Permissions" })).not.toBeInTheDocument();
  });

  it("does not offer Permissions to a viewer who can edit neither roles nor permissions", () => {
    renderRow({ canManageRoles: false, canManagePermissions: false });

    expect(screen.queryByRole("button", { name: "Permissions" })).not.toBeInTheDocument();
  });

  it("labels statuses by what they mean rather than the internal value", () => {
    const { unmount } = render(
      <table>
        <tbody>
          <UserRow
            user={summary({ status: "active" })}
            isSelf={false}
            isPending={false}
            availableRoles={roles}
            canManageUsers
            canManageRoles
            canManagePermissions={false}
            onReissue={vi.fn()}
            onRecover={vi.fn()}
            onDisable={vi.fn()}
            onReactivate={vi.fn()}
            onGrantRole={vi.fn()}
            onRevokeRole={vi.fn()}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText("Enrolled")).toBeInTheDocument();
    unmount();

    renderRow({ user: summary({ status: "invited", credential_count: 0 }) });
    expect(screen.getByText("Invite sent")).toBeInTheDocument();
  });

  it("labels a deactivated account Disabled", () => {
    renderRow({ user: summary({ status: "deactivated" }) });

    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("gives a viewer without users.manage the permissions button but none of the admin actions", () => {
    renderRow({ canManageUsers: false, canManageRoles: false, canManagePermissions: true });

    expect(screen.getByRole("button", { name: "Permissions" })).toBeInTheDocument();
    for (const name of ["Disable", "Recover account", "Reissue invite", "Reactivate"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("disables every action button while a request for this row is pending", () => {
    renderRow({ isPending: true });

    expect(screen.getByRole("button", { name: "Disable" })).toBeDisabled();
  });

  it("flags a long-dormant active account", () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    renderRow({ user: summary({ last_seen_at: longAgo }) });

    expect(screen.getByTitle(/No activity for 90\+ days/)).toBeInTheDocument();
  });

  it("does not flag a deactivated account as dormant even if long-idle", () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    renderRow({
      user: summary({ status: "deactivated", last_seen_at: longAgo }),
    });

    expect(screen.queryByTitle(/No activity for 90\+ days/)).not.toBeInTheDocument();
  });

  it('shows "Never" for a user with no last_seen_at', () => {
    renderRow({ user: summary({ last_seen_at: null }) });

    expect(screen.getByText("Never")).toBeInTheDocument();
  });
});
