import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { useRouter, useCurrentUser } = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter,
}));

vi.mock("@/lib/currentUser", () => ({
  useCurrentUser,
}));

vi.mock("@/lib/clients", () => ({
  ClientsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/nav/LeftNav", () => ({
  default: () => <nav data-testid="left-nav" />,
}));

import AppLayout from "./layout";

describe("AppLayout", () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ replace });
  });

  /// Regression test for the auth-check race this session's audit found:
  /// `checked` starts `false` on every fresh mount (before `whoAmI()`
  /// resolves), and both `isSignedOut`/`needsTotpOnboarding` are gated on
  /// `checked` being `true` -- so without an explicit `!checked` branch,
  /// the guard fell through and rendered the real shell (and everything
  /// mounted under it, including `RequirePermission`) with `user` still
  /// `null`. That let a legitimate admin loading an admin route directly
  /// get silently bounced to `/clients` by `RequirePermission`, which
  /// assumes `user` is already resolved by the time it mounts.
  it("shows the loading state, not the real shell, while checked is still false", () => {
    useCurrentUser.mockReturnValue({
      user: null,
      checked: false,
      signOut: vi.fn(),
    });

    render(
      <AppLayout>
        <div data-testid="page-content">admin page</div>
      </AppLayout>,
    );

    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("left-nav")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the real shell once checked is true and a user is present", () => {
    useCurrentUser.mockReturnValue({
      user: { user_id: "u1", roles: ["admin"], permissions: [], totp_enrolled: true },
      checked: true,
      signOut: vi.fn(),
    });

    render(
      <AppLayout>
        <div data-testid="page-content">admin page</div>
      </AppLayout>,
    );

    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByTestId("left-nav")).toBeInTheDocument();
  });

  it("redirects to /login once checked is true and there is no user", () => {
    useCurrentUser.mockReturnValue({
      user: null,
      checked: true,
      signOut: vi.fn(),
    });

    render(
      <AppLayout>
        <div data-testid="page-content">admin page</div>
      </AppLayout>,
    );

    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
