import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAuditLogEventTypes, listUsers } = vi.hoisted(() => ({
  listAuditLogEventTypes: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("@/lib/auth-audit", () => ({ listAuditLogEventTypes }));
vi.mock("@/lib/auth-users", () => ({ listUsers }));

import { useAuditLogFilterData } from "./useAuditLogFilterData";

const user = {
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
  last_seen_at: null,
};

describe("useAuditLogFilterData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults selectedEventTypes to every event type once the catalog loads", async () => {
    listAuditLogEventTypes.mockResolvedValue({
      kind: "ok",
      data: { event_types: ["login_succeeded", "role_changed"] },
    });
    listUsers.mockResolvedValue({ kind: "ok", data: { users: [] } });

    const { result } = renderHook(() => useAuditLogFilterData());

    await waitFor(() =>
      expect(result.current.allEventTypes).toEqual([
        "login_succeeded",
        "role_changed",
      ])
    );
    expect(result.current.selectedEventTypes).toEqual([
      "login_succeeded",
      "role_changed",
    ]);
  });

  it("noEventsSelected is true only once the catalog has loaded and every selection was cleared", async () => {
    listAuditLogEventTypes.mockResolvedValue({
      kind: "ok",
      data: { event_types: ["login_succeeded"] },
    });
    listUsers.mockResolvedValue({ kind: "ok", data: { users: [] } });

    const { result } = renderHook(() => useAuditLogFilterData());

    // Nothing loaded yet -- zero/zero must not read as "all cleared".
    expect(result.current.noEventsSelected).toBe(false);

    await waitFor(() => expect(result.current.allEventTypes).toHaveLength(1));
    expect(result.current.noEventsSelected).toBe(false);

    act(() => {
      result.current.setSelectedEventTypes([]);
    });
    await waitFor(() => expect(result.current.selectedEventTypes).toEqual([]));
    expect(result.current.noEventsSelected).toBe(true);
  });

  it("indexes users by id and exposes them as a list", async () => {
    listAuditLogEventTypes.mockResolvedValue({ kind: "ok", data: { event_types: [] } });
    listUsers.mockResolvedValue({ kind: "ok", data: { users: [user] } });

    const { result } = renderHook(() => useAuditLogFilterData());

    await waitFor(() => expect(result.current.allUsers).toHaveLength(1));
    expect(result.current.usersById.get("user-1")).toEqual(user);
  });

  it("reports a filterDataError naming which fetch failed, for event types", async () => {
    listAuditLogEventTypes.mockResolvedValue({ kind: "error", message: "boom" });
    listUsers.mockResolvedValue({ kind: "ok", data: { users: [] } });

    const { result } = renderHook(() => useAuditLogFilterData());

    await waitFor(() =>
      expect(result.current.filterDataError).toBe("Could not load event types: boom")
    );
  });

  it("reports a filterDataError naming which fetch failed, for users", async () => {
    listAuditLogEventTypes.mockResolvedValue({ kind: "ok", data: { event_types: [] } });
    listUsers.mockResolvedValue({ kind: "error", message: "boom" });

    const { result } = renderHook(() => useAuditLogFilterData());

    await waitFor(() =>
      expect(result.current.filterDataError).toBe("Could not load users: boom")
    );
  });
});
