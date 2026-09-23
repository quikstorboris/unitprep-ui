import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSummary } from "@/lib/auth-users";

const {
  listUsers,
  listRoles,
  exportUsersCsv,
  createInvite,
  recoverAccount,
  disableUser,
  reactivateUser,
  grantRole,
  revokeRole,
  downloadBlob,
} = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listRoles: vi.fn(),
  exportUsersCsv: vi.fn(),
  createInvite: vi.fn(),
  recoverAccount: vi.fn(),
  disableUser: vi.fn(),
  reactivateUser: vi.fn(),
  grantRole: vi.fn(),
  revokeRole: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock("@/lib/auth-users", () => ({
  listUsers,
  listRoles,
  exportUsersCsv,
  createInvite,
  recoverAccount,
  disableUser,
  reactivateUser,
  grantRole,
  revokeRole,
}));

vi.mock("@/lib/useSessionAction", () => ({ downloadBlob }));

import { useUsersAdmin } from "./useUsersAdmin";

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
    last_seen_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const issued = {
  user_id: "user-1",
  invite_token: "tok-1",
  expires_at: "2026-10-01T00:00:00Z",
  reissued: false,
};

async function loaded() {
  listUsers.mockResolvedValue({ kind: "ok", data: { users: [summary()] } });
  listRoles.mockResolvedValue({ kind: "ok", data: { roles: [] } });
  const rendered = renderHook(() => useUsersAdmin());
  await waitFor(() => expect(rendered.result.current.users).not.toBeNull());
  return rendered;
}

describe("useUsersAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads users and roles on mount", async () => {
    listUsers.mockResolvedValue({ kind: "ok", data: { users: [summary()] } });
    listRoles.mockResolvedValue({
      kind: "ok",
      data: { roles: [{ key: "admin", label: "Admin", description: null, is_system: true, permissions: [] }] },
    });

    const { result } = renderHook(() => useUsersAdmin());

    await waitFor(() => expect(result.current.users).toEqual([summary()]));
    expect(result.current.availableRoles).toHaveLength(1);
    expect(result.current.loadError).toBeNull();
  });

  it("surfaces a load error instead of leaving users stuck as null", async () => {
    listUsers.mockResolvedValue({ kind: "error", message: "boom" });
    listRoles.mockResolvedValue({ kind: "ok", data: { roles: [] } });

    const { result } = renderHook(() => useUsersAdmin());

    await waitFor(() => expect(result.current.loadError).toBe("boom"));
    expect(result.current.users).toBeNull();
  });

  it("handleDisable calls disableUser, then reloads the user list", async () => {
    const { result } = await loaded();
    disableUser.mockResolvedValue({ kind: "ok", data: { user_id: "user-1", status: "deactivated" } });
    listUsers.mockResolvedValue({
      kind: "ok",
      data: { users: [summary({ status: "deactivated" })] },
    });

    await act(async () => {
      await result.current.handleDisable(summary());
    });

    expect(disableUser).toHaveBeenCalledWith("user-1");
    expect(result.current.users?.[0].status).toBe("deactivated");
    expect(result.current.pendingUserId).toBeNull();
    expect(result.current.rowError).toBeNull();
  });

  it("handleDisable surfaces a row error and does not reload on failure", async () => {
    const { result } = await loaded();
    disableUser.mockResolvedValue({ kind: "error", message: "cannot disable yourself" });

    await act(async () => {
      await result.current.handleDisable(summary());
    });

    expect(result.current.rowError).toBe("cannot disable yourself");
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("handleReactivate calls reactivateUser and records the fresh invite", async () => {
    const { result } = await loaded();
    reactivateUser.mockResolvedValue({ kind: "ok", data: issued });

    await act(async () => {
      await result.current.handleReactivate(summary({ status: "deactivated" }));
    });

    expect(reactivateUser).toHaveBeenCalledWith("user-1");
    expect(result.current.issued).toEqual(issued);
  });

  it("handleRecover calls recoverAccount by email and records the fresh invite", async () => {
    const { result } = await loaded();
    recoverAccount.mockResolvedValue({ kind: "ok", data: issued });

    await act(async () => {
      await result.current.handleRecover(summary());
    });

    expect(recoverAccount).toHaveBeenCalledWith("ada@example.com");
    expect(result.current.issued).toEqual(issued);
  });

  it("handleGrantRole is a no-op when the target role is empty or already held", async () => {
    const { result } = await loaded();

    await act(async () => {
      await result.current.handleGrantRole(summary(), "");
    });
    await act(async () => {
      await result.current.handleGrantRole(summary(), "onboarding_manager");
    });

    expect(grantRole).not.toHaveBeenCalled();
  });

  it("handleGrantRole calls grantRole and reloads on success", async () => {
    const { result } = await loaded();
    grantRole.mockResolvedValue({ kind: "ok", data: { user_id: "user-1", roles: ["onboarding_manager", "admin"] } });

    await act(async () => {
      await result.current.handleGrantRole(summary(), "admin");
    });

    expect(grantRole).toHaveBeenCalledWith("user-1", "admin");
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("handleRevokeRole calls revokeRole and reloads on success", async () => {
    const { result } = await loaded();
    revokeRole.mockResolvedValue({ kind: "ok", data: { user_id: "user-1", roles: [] } });

    await act(async () => {
      await result.current.handleRevokeRole(summary(), "onboarding_manager");
    });

    expect(revokeRole).toHaveBeenCalledWith("user-1", "onboarding_manager");
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("handleExportUsers downloads the CSV blob on success", async () => {
    const { result } = await loaded();
    const response = new Response("id,email", {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="users.csv"' },
    });
    exportUsersCsv.mockResolvedValue({ kind: "ok", response });

    await act(async () => {
      await result.current.handleExportUsers();
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(result.current.exportError).toBeNull();
    expect(result.current.exportingUsers).toBe(false);
  });

  it("handleExportUsers surfaces an error without downloading anything", async () => {
    const { result } = await loaded();
    exportUsersCsv.mockResolvedValue({ kind: "error", message: "export failed" });

    await act(async () => {
      await result.current.handleExportUsers();
    });

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(result.current.exportError).toBe("export failed");
  });

  it("handleReissue resubmits only the user's first role", async () => {
    const { result } = await loaded();
    createInvite.mockResolvedValue({ kind: "ok", data: issued });

    await act(async () => {
      await result.current.handleReissue(
        summary({ roles: ["onboarding_manager", "admin"] })
      );
    });

    expect(createInvite).toHaveBeenCalledWith(
      expect.objectContaining({ role: "onboarding_manager" })
    );
  });

  it("handleCreateUser records the issued invite and reloads on success", async () => {
    const { result } = await loaded();
    createInvite.mockResolvedValue({ kind: "ok", data: issued });

    let outcome;
    await act(async () => {
      outcome = await result.current.handleCreateUser({
        email: "new@example.com",
        first_name: "New",
        last_name: "User",
        company: "quikstor",
        role: "onboarding_manager",
      });
    });

    expect(outcome).toEqual({ kind: "ok", data: issued });
    expect(result.current.issued).toEqual(issued);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });
});
