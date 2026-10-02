import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClickUpConnectionForTests } from "@/lib/clickupConnection";
import LeftNav from "./LeftNav";

const { usePathname, useRouter, useCurrentUser, getClickUpConnection } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
  useCurrentUser: vi.fn(),
  getClickUpConnection: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname, useRouter }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));
vi.mock("@/lib/clickup", () => ({ getClickUpConnection }));

function signedInWith(permissions: string[], userId = "u1") {
  useCurrentUser.mockReturnValue({
    user: {
      user_id: userId,
      first_name: "Ada",
      last_name: "Lovelace",
      roles: [],
      permissions,
      totp_enrolled: true,
    },
    signOut: vi.fn(),
  });
}

function connection(status: "not_connected" | "connected" | "invalid") {
  return {
    kind: "ok",
    data: {
      status,
      clickup_user_id: status === "not_connected" ? null : "42",
      clickup_username: status === "not_connected" ? null : "Ada",
      last_validated_at: null,
      workspace_names: [],
    },
  };
}

describe("LeftNav > My Integrations", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/clients");
    useRouter.mockReturnValue({ replace: vi.fn() });
    resetClickUpConnectionForTests();
    getClickUpConnection.mockReset();
  });

  afterEach(() => {
    resetClickUpConnectionForTests();
  });

  it("hides the whole group, and never asks ClickUp for status, when the user holds no integration permission", () => {
    signedInWith(["client_ops.perform"]);

    render(<LeftNav />);

    expect(screen.queryByText("My Integrations")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ClickUp/ })).not.toBeInTheDocument();
    expect(getClickUpConnection).not.toHaveBeenCalled();
  });

  it("shows the group with a ClickUp link once the user is granted integrations.clickup", async () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockResolvedValue(connection("connected"));

    render(<LeftNav />);

    expect(screen.getByText("My Integrations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ClickUp/ })).toHaveAttribute(
      "href",
      "/my-integrations/clickup"
    );
    await waitFor(() => expect(getClickUpConnection).toHaveBeenCalledTimes(1));
  });

  it("shows a green dot when connected", async () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockResolvedValue(connection("connected"));

    render(<LeftNav />);

    const dot = await screen.findByRole("img", { name: "ClickUp connected" });
    expect(dot.className).toContain("bg-green-500");
  });

  it("shows a red dot when no token is saved", async () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockResolvedValue(connection("not_connected"));

    render(<LeftNav />);

    const dot = await screen.findByRole("img", { name: "ClickUp not connected" });
    expect(dot.className).toContain("bg-red-500");
  });

  it("shows a red dot when ClickUp rejected the saved token", async () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockResolvedValue(connection("invalid"));

    render(<LeftNav />);

    const dot = await screen.findByRole("img", { name: "ClickUp token rejected" });
    expect(dot.className).toContain("bg-red-500");
  });

  it("shows a neutral dot, not a confident colour, while the status is unknown", () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockReturnValue(new Promise(() => {}));

    render(<LeftNav />);

    const dot = screen.getByRole("img", { name: "ClickUp status unknown" });
    expect(dot.className).toContain("bg-slate-600");
  });

  it("stays neutral when the status request fails rather than claiming a state", async () => {
    signedInWith(["integrations.clickup"]);
    getClickUpConnection.mockResolvedValue({ kind: "error", message: "boom" });

    render(<LeftNav />);

    await waitFor(() => expect(getClickUpConnection).toHaveBeenCalled());
    expect(screen.getByRole("img", { name: "ClickUp status unknown" })).toBeInTheDocument();
  });

  it("never shows one user's cached status to a different user on the same tab", async () => {
    signedInWith(["integrations.clickup"], "user-a");
    getClickUpConnection.mockResolvedValue(connection("connected"));
    const first = render(<LeftNav />);
    await screen.findByRole("img", { name: "ClickUp connected" });
    first.unmount();

    signedInWith(["integrations.clickup"], "user-b");
    getClickUpConnection.mockResolvedValue(connection("not_connected"));
    render(<LeftNav />);

    // Immediately after the user switch there is no cached state to show...
    expect(screen.queryByRole("img", { name: "ClickUp connected" })).not.toBeInTheDocument();
    // ...and it resolves to user B's own status.
    expect(await screen.findByRole("img", { name: "ClickUp not connected" })).toBeInTheDocument();
  });
});
