import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CopyPairRow, CopyPairs, CopyRowComments, CopyTaskInfo } from "@/lib/clickupCopy";

const { getCopyPairs, getCopyComments, copyComments } = vi.hoisted(() => ({
  getCopyPairs: vi.fn(),
  getCopyComments: vi.fn(),
  copyComments: vi.fn(),
}));

vi.mock("@/lib/clickupCopy", () => ({ getCopyPairs, getCopyComments, copyComments }));

import CopyCommentsDialog from "./CopyCommentsDialog";

function task(id: string, name: string, parentId: string | null = null): CopyTaskInfo {
  return {
    task_id: id,
    name,
    parent_id: parentId,
    parent_name: null,
    status: "to do",
    is_finished: false,
    url: `https://app.clickup.com/t/${id}`,
    scope: null,
  };
}

function pair(
  phase: string,
  source: CopyTaskInfo,
  target: CopyTaskInfo | null
): CopyPairRow {
  return { phase, source, target: target && { ...target, score: 1 }, alternatives: [] };
}

const ROWS: CopyPairRow[] = [
  pair("Set Up", task("S1", "CONFIGURE Fees"), task("T1", "CONFIGURE Fees")),
  pair("Set Up", task("S2", "CONFIGURE Delinquency"), task("T2", "CONFIGURE Delinquency")),
  pair("Set Up", task("S2a", "Add late fee", "S2"), task("T2a", "Add late fee", "T2")),
  pair("Migration", task("S3", "IMPORT Tenants"), null),
];

function pairs(rows: CopyPairRow[] = ROWS, parent = true): CopyPairs {
  return {
    source: { facility_id: "src", facility_name: "Main St", list_name: "Main list", list_url: "u" },
    target: { facility_id: "tgt", facility_name: "Second St", list_name: "Second list", list_url: "u" },
    parent: parent
      ? { facility_id: "src", facility_name: "Main St", list_name: "Main list", list_url: "u" }
      : null,
    rows,
    target_tasks: [task("T1", "CONFIGURE Fees"), task("T2", "CONFIGURE Delinquency"), task("T9", "IMPORT Tenants")],
  };
}

function comments(text: string | null, already = false): CopyRowComments {
  return {
    source_comment: text === null ? null : { text, author: "Ann", date_ms: 1 },
    already_copied: already,
    pointer_present: false,
  };
}

function renderDialog() {
  const onClose = vi.fn();
  render(
    <CopyCommentsDialog
      companyId="c1"
      facilityId="tgt"
      facilityName="Second St"
      sources={[
        { id: "src", name: "Main St" },
        { id: "alt", name: "Third St" },
      ]}
      defaultSourceId="src"
      onClose={onClose}
    />
  );
  return { onClose };
}

/** A source task's link. (The name alone is ambiguous: the same text is in
 * the target dropdown's options.) */
function findSource(name: string) {
  return screen.findByRole("link", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCopyPairs.mockResolvedValue({ kind: "ok", data: pairs() });
  getCopyComments.mockImplementation(async (_c: string, _f: string, sourceTaskId: string) => ({
    kind: "ok",
    data: comments(`Note on ${sourceTaskId}`),
  }));
});

describe("CopyCommentsDialog", () => {
  it("asks for the pairs from the default source (the parent)", async () => {
    renderDialog();

    await findSource("CONFIGURE Fees");

    expect(getCopyPairs).toHaveBeenCalledWith("c1", "tgt", { sourceFacilityId: "src", scope: "all" });
  });

  it("groups the rows by phase, Set Up before Migration", async () => {
    renderDialog();
    await findSource("CONFIGURE Fees");

    const headings = screen.getAllByRole("button", { expanded: true }).map((button) => button.textContent);
    expect(headings[0]).toContain("Set Up");
    expect(headings[1]).toContain("Migration");
  });

  it("shows only the mid-level tasks, with their subtasks collapsed", async () => {
    renderDialog();
    await findSource("CONFIGURE Delinquency");

    expect(screen.queryByRole("link", { name: "Add late fee" })).not.toBeInTheDocument();
    expect(screen.getByText("1 subtask")).toBeInTheDocument();
  });

  it("reveals the subtasks, and reads their comments, when a task is expanded", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findSource("CONFIGURE Delinquency");
    expect(getCopyComments).not.toHaveBeenCalledWith("c1", "tgt", "S2a", expect.anything(), "src");

    await user.click(screen.getByRole("button", { name: "Expand CONFIGURE Delinquency" }));

    expect(await findSource("Add late fee")).toBeInTheDocument();
    await waitFor(() =>
      expect(getCopyComments).toHaveBeenCalledWith("c1", "tgt", "S2a", "T2a", "src")
    );
  });

  it("prefills each comment with the source's latest and puts the cursor in the first box", async () => {
    renderDialog();

    const first = await screen.findByLabelText("Comment for CONFIGURE Fees");

    await waitFor(() => expect(first).toHaveValue("Note on S1"));
    expect(first).toHaveFocus();
    expect(await screen.findByLabelText("Comment for CONFIGURE Delinquency")).toHaveValue("Note on S2");
  });

  it("posts the edited comment, not the prefill, and marks the row copied", async () => {
    copyComments.mockResolvedValue({
      kind: "ok",
      data: {
        copied: 1,
        failed: 0,
        results: [
          {
            target_task_id: "T1",
            comment: { ok: true, message: null },
            pointer: { state: "posted", message: null },
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderDialog();
    const box = await screen.findByLabelText("Comment for CONFIGURE Fees");
    await waitFor(() => expect(box).toHaveValue("Note on S1"));

    await user.clear(box);
    await user.type(box, "Fees done, see list.");
    await user.click(screen.getByRole("button", { name: "Confirm CONFIGURE Fees" }));

    await waitFor(() =>
      expect(copyComments).toHaveBeenCalledWith(
        "c1",
        "tgt",
        [{ target_task_id: "T1", comment: "Fees done, see list.", source_task_id: "S1" }],
        "src"
      )
    );
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
    expect(screen.getByText("Main-list note added.")).toBeInTheDocument();
  });

  it("flags a task that looks as if the comment was already copied, but still allows it", async () => {
    getCopyComments.mockResolvedValue({ kind: "ok", data: comments("Same text", true) });
    renderDialog();

    await screen.findByLabelText("Comment for CONFIGURE Fees");

    expect((await screen.findAllByText("Looks already copied to this task.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirm CONFIGURE Fees" })).toBeEnabled();
  });

  it("shows a refusal on the row and leaves it ready to retry", async () => {
    copyComments.mockResolvedValue({
      kind: "ok",
      data: {
        copied: 0,
        failed: 1,
        results: [
          {
            target_task_id: "T1",
            comment: { ok: false, message: "Access denied: your ClickUp account cannot comment on this task." },
            pointer: { state: "not_applicable", message: null },
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderDialog();
    const box = await screen.findByLabelText("Comment for CONFIGURE Fees");
    await waitFor(() => expect(box).toHaveValue("Note on S1"));

    await user.click(screen.getByRole("button", { name: "Confirm CONFIGURE Fees" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.getByRole("button", { name: "Confirm CONFIGURE Fees" })).toBeEnabled();
  });

  it("leaves a row with no counterpart unusable until a target is chosen", async () => {
    const user = userEvent.setup();
    renderDialog();
    const box = await screen.findByLabelText("Comment for IMPORT Tenants");

    expect(box).toBeDisabled();
    expect(screen.getByText("No counterpart found.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Target task for IMPORT Tenants"), "T9");

    await waitFor(() => expect(box).toBeEnabled());
    await waitFor(() => expect(getCopyComments).toHaveBeenCalledWith("c1", "tgt", "S3", "T9", "src"));
    await waitFor(() => expect(box).toHaveValue("Note on S3"));
  });

  it("reloads the pairs when the source facility or the scope filter changes", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findSource("CONFIGURE Fees");

    await user.selectOptions(screen.getByLabelText("Tasks"), "corporate");
    await waitFor(() =>
      expect(getCopyPairs).toHaveBeenLastCalledWith("c1", "tgt", { sourceFacilityId: "src", scope: "corporate" })
    );

    await user.selectOptions(screen.getByLabelText("Copy from"), "alt");
    await waitFor(() =>
      expect(getCopyPairs).toHaveBeenLastCalledWith("c1", "tgt", { sourceFacilityId: "alt", scope: "corporate" })
    );
  });

  it("collapses and re-opens a phase", async () => {
    const user = userEvent.setup();
    renderDialog();
    await findSource("CONFIGURE Fees");

    await user.click(screen.getByRole("button", { name: /Set Up/ }));
    expect(screen.queryByRole("link", { name: "CONFIGURE Fees" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Set Up/ }));
    expect(screen.getByRole("link", { name: "CONFIGURE Fees" })).toBeInTheDocument();
  });

  it("explains when no parent is designated, so no main-list note will be added", async () => {
    getCopyPairs.mockResolvedValue({ kind: "ok", data: pairs(ROWS, false) });
    renderDialog();

    expect(await screen.findByText(/No parent facility is designated/)).toBeInTheDocument();
  });

  it("shows the server's message when the pairs cannot be loaded", async () => {
    getCopyPairs.mockResolvedValue({ kind: "error", message: "Choose which facility to copy from." });
    renderDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose which facility to copy from.");
  });
});
