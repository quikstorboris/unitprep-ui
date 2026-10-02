import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GrantablePermission, RoleInfo, UserSummary } from "@/lib/auth-users";

const { listUserPermissions, grantUserPermission, revokeUserPermission } = vi.hoisted(() => ({
  listUserPermissions: vi.fn(),
  grantUserPermission: vi.fn(),
  revokeUserPermission: vi.fn(),
}));

vi.mock("@/lib/auth-users", () => ({
  listUserPermissions,
  grantUserPermission,
  revokeUserPermission,
}));

import PermissionsDialog from "./PermissionsDialog";

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

function clickUp(granted: boolean): GrantablePermission {
  return {
    key: "integrations.clickup",
    label: "ClickUp",
    description: "Connect a personal ClickUp API token.",
    category: "Integrations",
    granted,
  };
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof PermissionsDialog>> = {}) {
  const handlers = {
    onGrantRole: vi.fn().mockResolvedValue(undefined),
    onRevokeRole: vi.fn(),
    onClose: vi.fn(),
  };

  render(
    <PermissionsDialog
      user={summary()}
      availableRoles={roles}
      isPending={false}
      canManageRoles
      canManagePermissions
      {...handlers}
      {...overrides}
    />
  );

  return handlers;
}

describe("PermissionsDialog", () => {
  beforeEach(() => {
    listUserPermissions.mockReset();
    grantUserPermission.mockReset();
    revokeUserPermission.mockReset();
    listUserPermissions.mockResolvedValue({
      kind: "ok",
      data: { user_id: "user-1", permissions: [clickUp(false)] },
    });
  });

  describe("roles", () => {
    it("removing a role calls onRevokeRole with that exact role key", async () => {
      const user = userEvent.setup();
      const handlers = renderDialog({
        user: summary({ roles: ["onboarding_manager", "admin"] }),
        canManagePermissions: false,
      });

      await user.click(screen.getByRole("button", { name: "Remove admin role" }));

      expect(handlers.onRevokeRole).toHaveBeenCalledWith(
        summary({ roles: ["onboarding_manager", "admin"] }),
        "admin"
      );
    });

    it("adding a role offers only roles not already held, then calls onGrantRole", async () => {
      const user = userEvent.setup();
      const handlers = renderDialog({ canManagePermissions: false });

      const select = screen.getByRole("combobox", { name: "Role to add" });
      expect(select).toHaveValue("admin");
      expect(screen.queryByRole("option", { name: "Onboarding Manager" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add role" }));

      expect(handlers.onGrantRole).toHaveBeenCalledWith(summary(), "admin");
    });

    it("hides the roles section from a viewer who cannot manage roles", () => {
      renderDialog({ canManageRoles: false, canManagePermissions: false });

      expect(screen.queryByText("Roles")).not.toBeInTheDocument();
    });
  });

  describe("direct permissions", () => {
    it("lists grantable permissions under their API-supplied category", async () => {
      renderDialog({ canManageRoles: false });

      expect(await screen.findByRole("checkbox", { name: /ClickUp/ })).not.toBeChecked();
      expect(screen.getByText("Integrations")).toBeInTheDocument();
      expect(listUserPermissions).toHaveBeenCalledWith("user-1");
    });

    it("granting a permission checks the box from the server's resulting state", async () => {
      const user = userEvent.setup();
      grantUserPermission.mockResolvedValue({
        kind: "ok",
        data: { user_id: "user-1", permissions: [clickUp(true)] },
      });
      renderDialog({ canManageRoles: false });

      await user.click(await screen.findByRole("checkbox", { name: /ClickUp/ }));

      expect(grantUserPermission).toHaveBeenCalledWith("user-1", "integrations.clickup");
      await waitFor(() => expect(screen.getByRole("checkbox", { name: /ClickUp/ })).toBeChecked());
    });

    it("revoking a held permission calls revoke and unchecks the box", async () => {
      const user = userEvent.setup();
      listUserPermissions.mockResolvedValue({
        kind: "ok",
        data: { user_id: "user-1", permissions: [clickUp(true)] },
      });
      revokeUserPermission.mockResolvedValue({
        kind: "ok",
        data: { user_id: "user-1", permissions: [clickUp(false)] },
      });
      renderDialog({ canManageRoles: false });

      await user.click(await screen.findByRole("checkbox", { name: /ClickUp/ }));

      expect(revokeUserPermission).toHaveBeenCalledWith("user-1", "integrations.clickup");
      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: /ClickUp/ })).not.toBeChecked()
      );
    });

    it("shows the server's error and leaves the box as it was when a toggle fails", async () => {
      const user = userEvent.setup();
      grantUserPermission.mockResolvedValue({ kind: "error", message: "You cannot change your own permissions." });
      renderDialog({ canManageRoles: false });

      await user.click(await screen.findByRole("checkbox", { name: /ClickUp/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("You cannot change your own permissions.");
      expect(screen.getByRole("checkbox", { name: /ClickUp/ })).not.toBeChecked();
    });

    it("never requests permissions for a viewer who cannot manage them", () => {
      renderDialog({ canManagePermissions: false });

      expect(listUserPermissions).not.toHaveBeenCalled();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("surfaces a load failure", async () => {
      listUserPermissions.mockResolvedValue({ kind: "error", message: "Could not load" });
      renderDialog({ canManageRoles: false });

      expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
    });
  });

  describe("closing", () => {
    it("Escape closes the dialog", async () => {
      const user = userEvent.setup();
      const handlers = renderDialog({ canManagePermissions: false });

      await user.keyboard("{Escape}");

      expect(handlers.onClose).toHaveBeenCalled();
    });

    it("the Done button closes the dialog", async () => {
      const user = userEvent.setup();
      const handlers = renderDialog({ canManagePermissions: false });

      await user.click(screen.getByRole("button", { name: "Done" }));

      expect(handlers.onClose).toHaveBeenCalled();
    });
  });
});
