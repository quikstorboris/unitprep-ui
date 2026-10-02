import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClickUpConnectionForTests } from "@/lib/clickupConnection";

const {
  useCurrentUser,
  replace,
  getClickUpConnection,
  saveClickUpToken,
  testClickUpConnection,
  removeClickUpToken,
} = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  replace: vi.fn(),
  getClickUpConnection: vi.fn(),
  saveClickUpToken: vi.fn(),
  testClickUpConnection: vi.fn(),
  removeClickUpToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));
vi.mock("@/lib/clickup", () => ({
  getClickUpConnection,
  saveClickUpToken,
  testClickUpConnection,
  removeClickUpToken,
}));

import ClickUpPage from "./page";

function conn(
  status: "not_connected" | "connected" | "invalid",
  extra: Record<string, unknown> = {}
) {
  return {
    status,
    clickup_user_id: status === "not_connected" ? null : "42",
    clickup_username: status === "not_connected" ? null : "Ada Lovelace",
    last_validated_at: status === "not_connected" ? null : "2026-10-02T12:00:00Z",
    workspace_names: [],
    ...extra,
  };
}

describe("ClickUp page", () => {
  beforeEach(() => {
    resetClickUpConnectionForTests();
    for (const fn of [
      replace,
      getClickUpConnection,
      saveClickUpToken,
      testClickUpConnection,
      removeClickUpToken,
    ]) {
      fn.mockReset();
    }
    useCurrentUser.mockReturnValue({
      user: { user_id: "u1", permissions: ["integrations.clickup"], roles: [] },
    });
  });

  afterEach(() => resetClickUpConnectionForTests());

  it("redirects a user who has not been granted ClickUp", () => {
    useCurrentUser.mockReturnValue({ user: { user_id: "u1", permissions: [], roles: [] } });

    render(<ClickUpPage />);

    expect(replace).toHaveBeenCalledWith("/clients");
    expect(screen.queryByText("Add your token")).not.toBeInTheDocument();
  });

  it("offers to add a token when none is saved, and disables Connect until one is typed", async () => {
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("not_connected") });

    render(<ClickUpPage />);

    expect(await screen.findByText(/Not connected/)).toBeInTheDocument();
    expect(screen.getByText("Add your token")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Test connection" })).not.toBeInTheDocument();
  });

  it("connects: sends the trimmed token, clears the field, and shows who it connected as", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("not_connected") });
    saveClickUpToken.mockResolvedValue({
      kind: "ok",
      data: conn("connected", { workspace_names: ["QuikStor"] }),
    });

    render(<ClickUpPage />);
    await screen.findByText(/Not connected/);

    await user.type(screen.getByLabelText("ClickUp personal API token"), "  pk_secret  ");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(saveClickUpToken).toHaveBeenCalledWith("pk_secret");
    expect(await screen.findByText(/Connected as Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/Workspaces: QuikStor/)).toBeInTheDocument();
    // Once connected the input goes away entirely -- the token is never
    // shown again, and nothing is left to type into.
    expect(screen.queryByLabelText("ClickUp personal API token")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/will not be shown again/);
  });

  it("shows ClickUp's rejection and keeps the typed token so it can be corrected", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("not_connected") });
    saveClickUpToken.mockResolvedValue({
      kind: "error",
      message: "ClickUp rejected this token.",
    });

    render(<ClickUpPage />);
    await screen.findByText(/Not connected/);

    await user.type(screen.getByLabelText("ClickUp personal API token"), "pk_typo");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ClickUp rejected this token.");
    expect(screen.getByLabelText("ClickUp personal API token")).toHaveValue("pk_typo");
  });

  it("shows no token input for a healthy connection, only a Replace token button", async () => {
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });

    render(<ClickUpPage />);

    expect(await screen.findByText(/Connected as Ada Lovelace/)).toBeInTheDocument();
    expect(screen.queryByLabelText("ClickUp personal API token")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace token" })).toBeInTheDocument();
  });

  it("does not flash the input before the first status read finishes", () => {
    getClickUpConnection.mockReturnValue(new Promise(() => {}));

    render(<ClickUpPage />);

    expect(screen.queryByLabelText("ClickUp personal API token")).not.toBeInTheDocument();
  });

  it("Replace token reveals the input, Cancel hides it again and drops what was typed", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Replace token" }));

    const input = screen.getByLabelText("ClickUp personal API token");
    await user.type(input, "pk_half_typed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("ClickUp personal API token")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace token" }));
    expect(screen.getByLabelText("ClickUp personal API token")).toHaveValue("");
  });

  it("replaces a working token: saves the new one and hides the input again", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });
    saveClickUpToken.mockResolvedValue({ kind: "ok", data: conn("connected") });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Replace token" }));
    await user.type(screen.getByLabelText("ClickUp personal API token"), "pk_new");
    // The form's submit button (the card's own Replace button is hidden
    // while replacing, so there is exactly one).
    await user.click(screen.getByRole("button", { name: "Replace token" }));

    expect(saveClickUpToken).toHaveBeenCalledWith("pk_new");
    await waitFor(() =>
      expect(screen.queryByLabelText("ClickUp personal API token")).not.toBeInTheDocument()
    );
    expect(screen.getByRole("status")).toHaveTextContent(/will not be shown again/);
  });

  it("keeps the input open after a failed replacement so it can be corrected", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });
    saveClickUpToken.mockResolvedValue({ kind: "error", message: "ClickUp rejected this token." });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Replace token" }));
    await user.type(screen.getByLabelText("ClickUp personal API token"), "pk_typo");
    await user.click(screen.getByRole("button", { name: "Replace token" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ClickUp rejected this token.");
    expect(screen.getByLabelText("ClickUp personal API token")).toHaveValue("pk_typo");
  });

  it("flags a saved token ClickUp no longer accepts and offers to replace it", async () => {
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("invalid") });

    render(<ClickUpPage />);

    expect(await screen.findByText(/rejected your saved token/)).toBeInTheDocument();
    expect(screen.getByText("Replace your token")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
  });

  it("tests the connection and reports a fresh rejection", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });
    testClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("invalid") });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Test connection" }));

    expect(await screen.findByRole("status")).toHaveTextContent("ClickUp rejected your saved token.");
    expect(screen.getByText(/It was probably revoked or regenerated/)).toBeInTheDocument();
  });

  it("removes the token and goes back to the not-connected state", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });
    removeClickUpToken.mockResolvedValue({ kind: "ok", data: conn("not_connected") });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Remove token" }));

    await waitFor(() => expect(screen.getByText(/Not connected/)).toBeInTheDocument());
    expect(removeClickUpToken).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Remove token" })).not.toBeInTheDocument();
  });

  it("shows an error when ClickUp cannot be reached during a test", async () => {
    const user = userEvent.setup();
    getClickUpConnection.mockResolvedValue({ kind: "ok", data: conn("connected") });
    testClickUpConnection.mockResolvedValue({
      kind: "error",
      message: "Could not complete the request to ClickUp.",
    });

    render(<ClickUpPage />);
    await user.click(await screen.findByRole("button", { name: "Test connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not complete/);
    // Status is untouched by an unreachable ClickUp.
    expect(screen.getByText(/Connected as Ada Lovelace/)).toBeInTheDocument();
  });
});
