import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhoAmI } from "./auth-session";
import type {
  CurrentUserProvider as CurrentUserProviderType,
  refreshCurrentUser as refreshCurrentUserType,
  useCurrentUser as useCurrentUserType,
} from "./currentUser";
import type { notifyUnauthorized as notifyUnauthorizedType } from "./sessionExpiry";

const { whoAmI, logout, logoutEverywhere } = vi.hoisted(() => ({
  whoAmI: vi.fn(),
  logout: vi.fn(),
  logoutEverywhere: vi.fn(),
}));

vi.mock("@/lib/auth-session", () => ({ whoAmI, logout, logoutEverywhere }));

function user(overrides: Partial<WhoAmI> = {}): WhoAmI {
  return {
    user_id: "u1",
    first_name: "Ada",
    last_name: "Lovelace",
    roles: ["onboarding_manager"],
    permissions: ["client_ops.perform"],
    totp_enrolled: true,
    ...overrides,
  };
}

// Both the module under test and sessionExpiry (which it registers an
// onUnauthorized listener with at import time) must come from the same
// fresh module registry -- a static top-level import of sessionExpiry
// here would resolve against a *different* instance than the one
// currentUser.tsx's own internal import sees after vi.resetModules(),
// silently breaking the "notifyUnauthorized signs the user out" wiring
// this file exists partly to prove. Same reasoning as
// lib/clients.test.tsx's freshClientsModule, extended to cover the
// second module this one also needs reset in lockstep.
async function freshCurrentUserModule() {
  vi.resetModules();
  const currentUserMod = await import("./currentUser");
  const sessionExpiryMod = await import("./sessionExpiry");
  return {
    CurrentUserProvider:
      currentUserMod.CurrentUserProvider as typeof CurrentUserProviderType,
    useCurrentUser: currentUserMod.useCurrentUser as typeof useCurrentUserType,
    refreshCurrentUser:
      currentUserMod.refreshCurrentUser as typeof refreshCurrentUserType,
    notifyUnauthorized:
      sessionExpiryMod.notifyUnauthorized as typeof notifyUnauthorizedType,
  };
}

describe("useCurrentUser / CurrentUserProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts unchecked, then commits the signed-in user once whoAmI resolves", async () => {
    whoAmI.mockResolvedValue({ kind: "ok", data: user() });
    const { useCurrentUser, CurrentUserProvider } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    expect(result.current.checked).toBe(false);
    expect(result.current.user).toBeNull();

    await waitFor(() => expect(result.current.checked).toBe(true));
    expect(result.current.user).toEqual(user());
  });

  it("commits a null user (but checked: true) when whoAmI reports unauthorized", async () => {
    whoAmI.mockResolvedValue({ kind: "unauthorized", message: "nope" });
    const { useCurrentUser, CurrentUserProvider } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.checked).toBe(true));
    expect(result.current.user).toBeNull();
  });

  it("signs the user out immediately when notifyUnauthorized fires elsewhere in the app", async () => {
    whoAmI.mockResolvedValue({ kind: "ok", data: user() });
    const { useCurrentUser, CurrentUserProvider, notifyUnauthorized } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => {
      notifyUnauthorized();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.checked).toBe(true);
  });

  it("signOut clears the local user regardless of what the network call returns", async () => {
    whoAmI.mockResolvedValue({ kind: "ok", data: user() });
    logout.mockResolvedValue({ kind: "error", message: "boom" });
    const { useCurrentUser, CurrentUserProvider } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.signOut();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
  });

  it("signOutEverywhere calls logoutEverywhere and clears the local user", async () => {
    whoAmI.mockResolvedValue({ kind: "ok", data: user() });
    logoutEverywhere.mockResolvedValue({ kind: "ok", data: { success: true, revoked_count: 3 } });
    const { useCurrentUser, CurrentUserProvider } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.signOutEverywhere();
    });

    expect(logoutEverywhere).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
  });

  it("refresh() re-fetches from the backend", async () => {
    whoAmI.mockResolvedValueOnce({ kind: "ok", data: user() });
    const { useCurrentUser, CurrentUserProvider } =
      await freshCurrentUserModule();

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });
    await waitFor(() => expect(result.current.checked).toBe(true));

    whoAmI.mockResolvedValueOnce({
      kind: "ok",
      data: user({ first_name: "Grace" }),
    });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.user?.first_name).toBe("Grace");
    expect(whoAmI).toHaveBeenCalledTimes(2);
  });

  it("throws when useCurrentUser is used outside a CurrentUserProvider", async () => {
    const { useCurrentUser } = await freshCurrentUserModule();

    const { result } = renderHook(() => {
      try {
        return useCurrentUser();
      } catch (error) {
        return error;
      }
    });

    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toContain(
      "useCurrentUser must be used within a CurrentUserProvider"
    );
  });
});
