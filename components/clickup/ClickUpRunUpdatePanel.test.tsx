import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RunUpdateTaskCandidate, RunUpdateTasks } from "@/lib/clickupRunUpdate";

const { useClickUpAccess, getRunUpdateTasks, postRunUpdate } = vi.hoisted(() => ({
  useClickUpAccess: vi.fn(),
  getRunUpdateTasks: vi.fn(),
  postRunUpdate: vi.fn(),
}));

vi.mock("./useClickUpAccess", () => ({ useClickUpAccess }));
vi.mock("@/lib/clickupRunUpdate", () => ({ getRunUpdateTasks, postRunUpdate }));

import ClickUpRunUpdatePanel from "./ClickUpRunUpdatePanel";

function candidate(overrides: Partial<RunUpdateTaskCandidate> = {}): RunUpdateTaskCandidate {
  return {
    task_id: "c1",
    name: "COMPLETE Duplicate Tenant Corrections",
    parent_name: "4. Data Cleanup",
    status: "to do",
    is_finished: false,
    assignees: [],
    url: "https://app.clickup.com/t/c1",
    score: 1,
    ...overrides,
  };
}

function tasks(
  candidates: RunUpdateTaskCandidate[],
  overrides: Partial<RunUpdateTasks> = {}
): RunUpdateTasks {
  return {
    step_label: "1st Duplicate Check",
    sequence_number: 1,
    list_name: "Synott",
    list_url: "https://app.clickup.com/8413555/v/li/1",
    file_link_available: true,
    comment_only: false,
    candidates,
    ...overrides,
  };
}

const ok = { ok: true, message: null };

function renderPanel(fileSavedToDropbox = true) {
  return render(
    <ClickUpRunUpdatePanel
      companyId="co"
      facilityId="fa"
      sessionId="se"
      fileSavedToDropbox={fileSavedToDropbox}
    />
  );
}

describe("ClickUpRunUpdatePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useClickUpAccess.mockReturnValue({ allowed: true });
  });

  it("renders nothing and calls nothing without ClickUp access", () => {
    useClickUpAccess.mockReturnValue({ allowed: false });
    const { container } = renderPanel();

    expect(container).toBeEmptyDOMElement();
    expect(getRunUpdateTasks).not.toHaveBeenCalled();
  });

  it("asks even when only one task matches, with it already selected", async () => {
    getRunUpdateTasks.mockResolvedValue({ kind: "ok", data: tasks([candidate()]) });
    renderPanel();

    expect(await screen.findByText(/Is this the right task\?/)).toBeInTheDocument();
    expect(getRunUpdateTasks).toHaveBeenCalledWith("co", "fa", "se");
    expect(screen.getByRole("radio")).toBeChecked();
    expect(screen.getByText(/Under “4. Data Cleanup”/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update ClickUp task" })).toBeEnabled();
  });

  it("makes the person pick one when several match", async () => {
    getRunUpdateTasks.mockResolvedValue({
      kind: "ok",
      data: tasks([candidate(), candidate({ task_id: "c2", name: "Duplicate Tenant Corrections", parent_name: null })]),
    });
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText(/Choose the right one/)).toBeInTheDocument();
    const update = screen.getByRole("button", { name: "Update ClickUp task" });
    expect(update).toBeDisabled();

    await user.click(screen.getAllByRole("radio")[1]);
    expect(update).toBeEnabled();
  });

  it("posts the chosen task and shows how each step went", async () => {
    getRunUpdateTasks.mockResolvedValue({ kind: "ok", data: tasks([candidate()]) });
    postRunUpdate.mockResolvedValue({
      kind: "ok",
      data: {
        task_name: "COMPLETE Duplicate Tenant Corrections",
        task_url: "https://app.clickup.com/t/c1",
        link_kind: "shared",
        comment: ok,
        assignee: { ok: false, message: "ClickUp rejected it" },
        status: ok,
      },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Update ClickUp task" }));

    expect(postRunUpdate).toHaveBeenCalledWith("co", "fa", "se", "c1");
    expect(await screen.findByText(/partly updated/)).toBeInTheDocument();
    expect(screen.getByText(/✗ You added as assignee — ClickUp rejected it/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Task set to complete/)).toBeInTheDocument();
    // The picker is gone once posted.
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("says plainly when the update could not be made and keeps the picker", async () => {
    getRunUpdateTasks.mockResolvedValue({ kind: "ok", data: tasks([candidate()]) });
    postRunUpdate.mockResolvedValue({ kind: "error", message: "ClickUp is down" });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Update ClickUp task" }));

    expect(await screen.findByText("ClickUp is down")).toBeInTheDocument();
    expect(screen.getByRole("radio")).toBeInTheDocument();
  });

  it("explains when nothing matches, and when the facility is not linked", async () => {
    getRunUpdateTasks.mockResolvedValueOnce({ kind: "ok", data: tasks([]) });
    const { unmount } = renderPanel();
    expect(await screen.findByText(/No task that looks like the 1st Duplicate Check/)).toBeInTheDocument();
    unmount();

    getRunUpdateTasks.mockResolvedValueOnce({
      kind: "error",
      message: "Link this facility to its ClickUp list first",
    });
    renderPanel();
    expect(await screen.findByText(/Link this facility to its ClickUp list first/)).toBeInTheDocument();
  });

  it("can be dismissed with Not now", async () => {
    getRunUpdateTasks.mockResolvedValue({ kind: "ok", data: tasks([candidate()]) });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Not now" }));

    await waitFor(() => expect(screen.queryByText("Update ClickUp")).not.toBeInTheDocument());
    expect(postRunUpdate).not.toHaveBeenCalled();
  });

  it("warns that the comment will have no link when the file is not in Dropbox", async () => {
    getRunUpdateTasks.mockResolvedValue({
      kind: "ok",
      data: tasks([candidate()], { file_link_available: false }),
    });
    renderPanel(false);

    expect(await screen.findByText(/the comment will have no link/)).toBeInTheDocument();
  });

  it("looks again when the file gets saved to Dropbox", async () => {
    getRunUpdateTasks.mockResolvedValue({ kind: "ok", data: tasks([candidate()]) });
    const { rerender } = renderPanel(false);
    await screen.findByText(/Is this the right task\?/);

    rerender(
      <ClickUpRunUpdatePanel companyId="co" facilityId="fa" sessionId="se" fileSavedToDropbox />
    );

    await waitFor(() => expect(getRunUpdateTasks).toHaveBeenCalledTimes(2));
  });

  it("describes a later check as comment-only and tells the user to add the file by hand after a no-link post", async () => {
    getRunUpdateTasks.mockResolvedValue({
      kind: "ok",
      data: tasks([candidate()], { comment_only: true, file_link_available: false }),
    });
    postRunUpdate.mockResolvedValue({
      kind: "ok",
      data: {
        task_name: "PERFORM 2nd Duplicate Check",
        task_url: "https://app.clickup.com/t/c1",
        link_kind: "none",
        comment: ok,
        assignee: null,
        status: null,
      },
    });
    const user = userEvent.setup();
    renderPanel(false);

    expect(await screen.findByText(/adds another comment/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update ClickUp task" }));

    expect(await screen.findByText(/ClickUp task updated/)).toBeInTheDocument();
    expect(screen.queryByText(/assignee/)).not.toBeInTheDocument();
    expect(screen.getByText(/Add the file to the task in ClickUp yourself/)).toBeInTheDocument();
  });
});
