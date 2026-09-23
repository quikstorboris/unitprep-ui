import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhoAmI } from "@/lib/auth-session";

const { useRouter, useCurrentUser } = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));

import RequirePermission from "./RequirePermission";

function user(permissions: string[]): WhoAmI {
  return {
    user_id: "u1",
    first_name: "Ada",
    last_name: "Lovelace",
    roles: ["admin"],
    permissions,
    totp_enrolled: true,
  };
}

describe("RequirePermission", () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ replace });
  });

  it("renders its children when the current user holds the required permission", () => {
    useCurrentUser.mockReturnValue({ user: user(["users.manage"]) });

    render(
      <RequirePermission permission="users.manage">
        <p>Admin content</p>
      </RequirePermission>
    );

    expect(screen.getByText("Admin content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /clients and shows a redirecting message when the permission is missing", () => {
    useCurrentUser.mockReturnValue({ user: user(["client_ops.perform"]) });

    render(
      <RequirePermission permission="users.manage">
        <p>Admin content</p>
      </RequirePermission>
    );

    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(screen.getByText("Redirecting…")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/clients");
  });

  it("redirects when there is no signed-in user at all", () => {
    useCurrentUser.mockReturnValue({ user: null });

    render(
      <RequirePermission permission="users.manage">
        <p>Admin content</p>
      </RequirePermission>
    );

    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/clients");
  });

  it("checks the exact permission key requested, not just any permission", () => {
    useCurrentUser.mockReturnValue({
      user: user(["audit_logs.read", "activity_logs.read"]),
    });

    render(
      <RequirePermission permission="users.manage">
        <p>Admin content</p>
      </RequirePermission>
    );

    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/clients");
  });
});
