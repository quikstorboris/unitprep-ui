import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkPairs, BulkTasks, CopyJob, DestinationPairs } from "@/lib/clickupBulkCopy";
import type { CopyTaskInfo } from "@/lib/clickupCopy";

const { getBulkTasks, getBulkPairs, getBulkComment, bulkCopy, listCopyJobs, useCompanyDetail, ask } =
  vi.hoisted(() => ({
    getBulkTasks: vi.fn(),
    getBulkPairs: vi.fn(),
    getBulkComment: vi.fn(),
    bulkCopy: vi.fn(),
    listCopyJobs: vi.fn(),
    useCompanyDetail: vi.fn(),
    ask: vi.fn(),
  }));

vi.mock("@/lib/clickupBulkCopy", () => ({
  getBulkTasks,
  getBulkPairs,
  getBulkComment,
  bulkCopy,
  listCopyJobs,
}));
vi.mock("@/components/clients/CompanyDetailContext", () => ({ useCompanyDetail }));
vi.mock("./useCopyJobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./useCopyJobs")>()),
  askForNotifications: ask,
}));

import BulkCopyPanel from "./BulkCopyPanel";

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

const facilities = [
  { id: "main", name: "Main St", clickup_list_id: "L1" },
  { id: "second", name: "Second St", clickup_list_id: "L2" },
  { id: "third", name: "Third St", clickup_list_id: "L3" },
  { id: "fourth", name: "Fourth St", clickup_list_id: null },
];

function bulkTasks(): BulkTasks {
  const list = (id: string, name: string) => ({
    facility_id: id,
    facility_name: name,
    list_name: `${name} list`,
    list_url: "u",
  });
  return {
    source: list("main", "Main St"),
    parent: list("main", "Main St"),
    tasks: [
      { phase: "Set Up", phase_order: 0, ...task("S1", "CONFIGURE Fees") },
      { phase: "Set Up", phase_order: 0, ...task("S2", "CONFIGURE Delinquency") },
      { phase: "Set Up", phase_order: 0, ...task("S2a", "Add late fee", "S2") },
      { phase: "Migration", phase_order: 1, ...task("S3", "IMPORT Tenants") },
      // Listed out of the list's own order on purpose.
      { phase: "Show Stoppers", phase_order: 3, ...task("S5", "RESOLVE Open Blockers") },
      { phase: "Scheduling", phase_order: 2, ...task("S4", "BOOK Go-Live Call") },
    ],
    destinations: [
      { facility_id: "second", facility_name: "Second St" },
      { facility_id: "third", facility_name: "Third St" },
    ],
    unlinked: [{ facility_id: "fourth", facility_name: "Fourth St" }],
  };
}

function destination(id: string, name: string, target: string | null): DestinationPairs {
  return {
    facility_id: id,
    facility_name: name,
    list_name: `${name} list`,
    list_url: "u",
    target: target ? { ...task(target, "CONFIGURE Fees"), score: 1 } : null,
    alternatives: [],
    tasks: [task(`${id}-a`, "CONFIGURE Fees"), task(`${id}-b`, "CONFIGURE Delinquency")],
    error: null,
  };
}

function pairs(overrides: Partial<BulkPairs> = {}): BulkPairs {
  return {
    destinations: [destination("second", "Second St", "T2"), destination("third", "Third St", "T3")],
    ...overrides,
  };
}

const job = (overrides: Partial<CopyJob> = {}): CopyJob => ({
  id: "j1",
  status: "running",
  source_task_name: "CONFIGURE Fees",
  total: 40,
  copied: 0,
  failed: 0,
  results: [],
  message: null,
  created_at: "2026-10-07T12:00:00Z",
  finished_at: null,
  ...overrides,
});

const ok = (data: unknown) => ({ kind: "ok", data });

beforeEach(() => {
  vi.clearAllMocks();
  useCompanyDetail.mockReturnValue({
    company: { facilities, clickup_parent_facility_id: "main" },
  });
  getBulkTasks.mockResolvedValue(ok(bulkTasks()));
  getBulkPairs.mockResolvedValue(ok(pairs()));
  getBulkComment.mockResolvedValue(
    ok({ source_comment: { text: "Fees are configured.", author: "Ann", date_ms: 1 } })
  );
  listCopyJobs.mockResolvedValue(ok([]));
  ask.mockResolvedValue(undefined);
});

const pickerButton = () => screen.getByRole("button", { name: /Select facilities|facilit(y|ies) selected/ });

/** Chooses the Fees task and waits for the facility dropdown. */
async function chooseFees() {
  const user = userEvent.setup();
  render(<BulkCopyPanel companyId="c1" />);
  await user.click(await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" }));
  await screen.findByRole("button", { name: "Select facilities" });
  return user;
}

/** Opens the facility dropdown, ticks `names`, and closes it again. */
async function pick(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(pickerButton());
  for (const name of names) await user.click(screen.getByRole("checkbox", { name: `Copy to ${name}` }));
  await user.keyboard("{Escape}");
}

describe("BulkCopyPanel", () => {
  it("lists the parent's tasks by phase, mid-level only, and asks from the parent by default", async () => {
    render(<BulkCopyPanel companyId="c1" />);

    expect(await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Delinquency" })).toBeInTheDocument();
    expect(getBulkTasks).toHaveBeenCalledWith("c1", { sourceFacilityId: "main", scope: "all" });
    expect(screen.queryByRole("checkbox", { name: "Copy from Add late fee" })).not.toBeInTheDocument();
    expect(screen.getByText("1 subtask")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set Up\s*\(\d+\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Migration\s*\(\d+\)/ })).toBeInTheDocument();
  });

  it("offers every phase the list has -- Scheduling and Show Stoppers too -- in the list's own order", async () => {
    render(<BulkCopyPanel companyId="c1" />);
    await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" });

    const headings = screen.getAllByRole("button", { expanded: true }).map((button) => button.textContent);
    expect(headings).toEqual([
      expect.stringContaining("Set Up"),
      expect.stringContaining("Migration"),
      expect.stringContaining("Scheduling"),
      expect.stringContaining("Show Stoppers"),
    ]);
    expect(screen.getByRole("checkbox", { name: "Copy from RESOLVE Open Blockers" })).toBeInTheDocument();
  });

  it("reveals subtasks when a task is expanded", async () => {
    const user = userEvent.setup();
    render(<BulkCopyPanel companyId="c1" />);

    await user.click(await screen.findByRole("button", { name: "Expand CONFIGURE Delinquency" }));

    expect(screen.getByRole("checkbox", { name: "Copy from Add late fee" })).toBeInTheDocument();
  });

  it("finds each facility's counterpart and prefills the comment once a task is chosen", async () => {
    const user = await chooseFees();
    await pick(user, "Second St", "Third St");

    expect(getBulkPairs).toHaveBeenCalledWith("c1", "S1", { sourceFacilityId: "main", scope: "all" });
    expect(getBulkComment).toHaveBeenCalledWith("c1", "S1", "main");
    expect(screen.getByLabelText("Task in Second St for CONFIGURE Fees")).toHaveValue("T2");
    expect(screen.getByLabelText("Task in Third St for CONFIGURE Fees")).toHaveValue("T3");
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
  });

  it("starts with no facility selected, so nothing can be copied until some are picked", async () => {
    const user = await chooseFees();

    expect(screen.getByText("No facilities selected yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Task in Second St for CONFIGURE Fees")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    expect(screen.getByRole("button", { name: /copy to 0 facilities/ })).toBeDisabled();

    await pick(user, "Third St");

    expect(pickerButton()).toHaveTextContent("1 of 2 facilities selected");
    expect(screen.getByLabelText("Task in Third St for CONFIGURE Fees")).toBeInTheDocument();
    expect(screen.queryByLabelText("Task in Second St for CONFIGURE Fees")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy to 1 facility/ })).toBeEnabled();
  });

  it("offers select all and select none in the dropdown", async () => {
    const user = await chooseFees();

    await user.click(pickerButton());
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Copy to Second St" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Copy to Third St" })).toBeChecked();
    expect(pickerButton()).toHaveTextContent("2 of 2 facilities selected");

    await user.click(screen.getByRole("button", { name: "Select none" }));
    expect(screen.getByRole("checkbox", { name: "Copy to Second St" })).not.toBeChecked();
    expect(pickerButton()).toHaveTextContent("Select facilities");
  });

  it("closes the dropdown on Escape and on an outside click", async () => {
    const user = await chooseFees();

    await user.click(pickerButton());
    expect(screen.getByRole("group", { name: "Facilities to copy to" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Facilities to copy to" })).not.toBeInTheDocument();

    await user.click(pickerButton());
    await user.click(screen.getByRole("heading", { name: "Copy to" }));
    expect(screen.queryByRole("group", { name: "Facilities to copy to" })).not.toBeInTheDocument();
  });

  it("names facilities with no ClickUp list as not offered", async () => {
    const user = await chooseFees();

    expect(screen.getByText(/Fourth St/)).toBeInTheDocument();
    await user.click(pickerButton());
    expect(screen.queryByRole("checkbox", { name: "Copy to Fourth St" })).not.toBeInTheDocument();
  });

  it("skips a ticked facility with no counterpart unless the person chooses a task for it", async () => {
    getBulkPairs.mockResolvedValue(
      ok(pairs({ destinations: [destination("second", "Second St", "T2"), destination("third", "Third St", null)] }))
    );
    const user = await chooseFees();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));

    await pick(user, "Second St", "Third St");

    expect(screen.getByText(/No matching task found/)).toBeInTheDocument();
    expect(screen.getByText(/One chosen facility has no task for one of the tasks and will be skipped there/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy to 1 facility/ })).toBeEnabled();

    await user.selectOptions(screen.getByLabelText("Task in Third St for CONFIGURE Fees"), "third-a");

    expect(screen.queryByText(/will be skipped there/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy to 2 facilities/ })).toBeEnabled();
  });

  it("does not let a facility whose list could not be read be picked, and says why", async () => {
    getBulkPairs.mockResolvedValue(
      ok(
        pairs({
          destinations: [
            destination("second", "Second St", "T2"),
            { ...destination("third", "Third St", null), error: "ClickUp rejected your token." },
          ],
        })
      )
    );
    const user = await chooseFees();

    await user.click(pickerButton());
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Copy to Third St" })).toBeDisabled());
    expect(screen.getByText("Its ClickUp list could not be read")).toBeInTheDocument();

    // Select all skips it.
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Copy to Second St" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Copy to Third St" })).not.toBeChecked();
  });

  it("posts the edited comment to the picked facilities' own tasks, naming the source task, and shows each outcome", async () => {
    bulkCopy.mockResolvedValue(
      ok({
        mode: "inline",
        job_id: null,
        total: 1,
        copied: 1,
        failed: 0,
        results: [
          {
            target_task_id: "T2",
            facility_id: "second",
            facility_name: "Second St",
            comment: { ok: true, message: null },
            pointer: { state: "posted", message: null },
          },
        ],
      })
    );
    const user = await chooseFees();
    const box = screen.getByLabelText("Comment for CONFIGURE Fees");
    await waitFor(() => expect(box).toHaveValue("Fees are configured."));

    await pick(user, "Second St");
    await user.clear(box);
    await user.type(box, "Done everywhere.");
    await user.click(screen.getByRole("button", { name: /copy to 1 facility/ }));

    await waitFor(() =>
      expect(bulkCopy).toHaveBeenCalledWith("c1", {
        sourceFacilityId: "main",
        sourceTaskId: "S1",
        sourceTaskName: "CONFIGURE Fees",
        comment: "Done everywhere.",
        destinations: [{ facility_id: "second", target_task_id: "T2" }],
        completeTasks: false,
        background: false,
      })
    );
    expect(await screen.findByText("Copied to 1 facility.")).toBeInTheDocument();
    const results = screen.getByRole("status");
    expect(within(results).getByText("Second St")).toBeInTheDocument();
    expect(within(results).getByText(/Main-list note added/)).toBeInTheDocument();
  });

  it("only comments by default, and completes the tasks when the box is ticked", async () => {
    bulkCopy.mockResolvedValue(
      ok({
        mode: "inline",
        job_id: null,
        total: 1,
        copied: 1,
        failed: 0,
        results: [
          {
            target_task_id: "T2",
            facility_id: "second",
            facility_name: "Second St",
            comment: { ok: true, message: null },
            pointer: { state: "not_applicable", message: null },
            completed: { ok: false, message: "This list has no complete status." },
          },
        ],
      })
    );
    const user = await chooseFees();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    await pick(user, "Second St");

    const box = screen.getByRole("checkbox", { name: /Also mark each task complete/ });
    expect(box).not.toBeChecked();
    expect(screen.getByText(/Leave this unticked to only add the comment/)).toBeInTheDocument();

    await user.click(box);
    await user.click(screen.getByRole("button", { name: /copy to 1 facility/ }));

    await waitFor(() =>
      expect(bulkCopy).toHaveBeenCalledWith("c1", expect.objectContaining({ completeTasks: true }))
    );
    // The per-facility result says the completion failed, though the comment landed.
    expect(await screen.findByText(/Not marked complete: This list has no complete status\./)).toBeInTheDocument();
  });

  it("says that a link to the source task is added to the bottom of the comment", async () => {
    await chooseFees();

    expect(screen.getByText(/Main tracker task - CONFIGURE Fees/)).toBeInTheDocument();
  });

  it("reports a refused facility with its reason", async () => {
    bulkCopy.mockResolvedValue(
      ok({
        mode: "inline",
        job_id: null,
        total: 1,
        copied: 0,
        failed: 1,
        results: [
          {
            target_task_id: "T2",
            facility_name: "Second St",
            comment: { ok: false, message: "Access denied: your ClickUp account cannot comment on this task." },
            pointer: { state: "not_applicable", message: null },
          },
        ],
      })
    );
    const user = await chooseFees();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    await pick(user, "Second St", "Third St");

    await user.click(screen.getByRole("button", { name: /copy to 2 facilities/ }));

    expect(await screen.findByText("0 copied, 1 failed.")).toBeInTheDocument();
    expect(screen.getByText(/Access denied/)).toBeInTheDocument();
  });

  it("tells the person it is running in the background when the copy is too big for one request", async () => {
    bulkCopy.mockResolvedValue(
      ok({ mode: "job", job_id: "j1", total: 2, results: [], copied: 0, failed: 0 })
    );
    listCopyJobs.mockResolvedValueOnce(ok([])).mockResolvedValue(ok([job()]));
    const user = await chooseFees();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    await pick(user, "Second St", "Third St");

    await user.click(screen.getByRole("button", { name: /copy to 2 facilities/ }));

    expect(await screen.findByText(/We'll notify you when copying is complete/)).toBeInTheDocument();
    // The job list refreshes straight away and shows its progress.
    expect(await screen.findByText(/Copying — 0 of 40 done/)).toBeInTheDocument();
  });

  it("asks for notification permission, from the click, only for a copy big enough to run in the background", async () => {
    const many = Array.from({ length: 20 }, (_, n) => destination(`f${n}`, `Facility ${n}`, `T${n}`));
    getBulkPairs.mockResolvedValue(ok(pairs({ destinations: many })));
    getBulkTasks.mockResolvedValue(
      ok({
        ...bulkTasks(),
        destinations: many.map((d) => ({ facility_id: d.facility_id, facility_name: d.facility_name })),
      })
    );
    bulkCopy.mockResolvedValue(ok({ mode: "job", job_id: "j1", total: 20, results: [], copied: 0, failed: 0 }));
    const user = userEvent.setup();
    render(<BulkCopyPanel companyId="c1" />);
    await user.click(await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" }));
    await screen.findByRole("button", { name: "Select facilities" });
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    await user.click(pickerButton());
    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /copy to 20 facilities/ }));

    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("does not ask for notifications for a small copy", async () => {
    bulkCopy.mockResolvedValue(ok({ mode: "inline", job_id: null, total: 2, results: [], copied: 2, failed: 0 }));
    const user = await chooseFees();
    await waitFor(() => expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured."));
    await pick(user, "Second St", "Third St");

    await user.click(screen.getByRole("button", { name: /copy to 2 facilities/ }));

    await waitFor(() => expect(bulkCopy).toHaveBeenCalled());
    expect(ask).not.toHaveBeenCalled();
  });

  it("cannot be confirmed without a comment", async () => {
    getBulkComment.mockResolvedValue(ok({ source_comment: null }));
    const user = await chooseFees();
    await pick(user, "Second St", "Third St");

    expect(screen.getByRole("button", { name: /copy to 2 facilities/ })).toBeDisabled();
    expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveAttribute(
      "placeholder",
      "The source task has no comment — type one."
    );

    await user.type(screen.getByLabelText("Comment for CONFIGURE Fees"), "Hello");
    expect(screen.getByRole("button", { name: /copy to 2 facilities/ })).toBeEnabled();
  });

  it("reloads the tasks when the source facility or the filter changes", async () => {
    const user = userEvent.setup();
    render(<BulkCopyPanel companyId="c1" />);
    await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" });

    await user.selectOptions(screen.getByLabelText("Tasks"), "corporate");
    await waitFor(() =>
      expect(getBulkTasks).toHaveBeenLastCalledWith("c1", { sourceFacilityId: "main", scope: "corporate" })
    );
    await user.selectOptions(screen.getByLabelText("Copy from"), "second");
    await waitFor(() =>
      expect(getBulkTasks).toHaveBeenLastCalledWith("c1", { sourceFacilityId: "second", scope: "corporate" })
    );
  });

  it("explains when fewer than two facilities have a ClickUp list", () => {
    useCompanyDetail.mockReturnValue({
      company: { facilities: [facilities[0], facilities[3]], clickup_parent_facility_id: null },
    });

    render(<BulkCopyPanel companyId="c1" />);

    expect(screen.getByText(/needs at least two facilities with a ClickUp list/)).toBeInTheDocument();
    expect(getBulkTasks).not.toHaveBeenCalled();
  });

  it("shows the server's message when the source list cannot be read", async () => {
    getBulkTasks.mockResolvedValue({ kind: "error", message: "ClickUp rejected your token." });
    render(<BulkCopyPanel companyId="c1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("ClickUp rejected your token.");
  });

  describe("several tasks at once", () => {
    const commentFor = (taskId: string) =>
      taskId === "S1"
        ? ok({ source_comment: { text: "Fees are configured.", author: "Ann", date_ms: 1 } })
        : ok({ source_comment: { text: "Delinquency is configured.", author: "Ann", date_ms: 1 } });

    const inlineOk = (targets: string[]) =>
      ok({
        mode: "inline",
        job_id: null,
        total: targets.length,
        copied: targets.length,
        failed: 0,
        results: targets.map((target) => ({
          target_task_id: target,
          facility_name: target,
          comment: { ok: true, message: null },
          pointer: { state: "not_applicable", message: null },
        })),
      });

    async function chooseTwo() {
      getBulkComment.mockImplementation(async (_company: string, taskId: string) => commentFor(taskId));
      const user = userEvent.setup();
      render(<BulkCopyPanel companyId="c1" />);
      await user.click(await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" }));
      await user.click(screen.getByRole("checkbox", { name: "Copy from CONFIGURE Delinquency" }));
      await screen.findByRole("button", { name: "Select facilities" });
      return user;
    }

    it("gives each chosen task its own card and comment, and keeps the others when one is unticked", async () => {
      const user = await chooseTwo();

      await waitFor(() => {
        expect(screen.getByLabelText("Comment for CONFIGURE Fees")).toHaveValue("Fees are configured.");
        expect(screen.getByLabelText("Comment for CONFIGURE Delinquency")).toHaveValue("Delinquency is configured.");
      });
      expect(getBulkPairs).toHaveBeenCalledWith("c1", "S1", { sourceFacilityId: "main", scope: "all" });
      expect(getBulkPairs).toHaveBeenCalledWith("c1", "S2", { sourceFacilityId: "main", scope: "all" });

      await user.click(screen.getByRole("checkbox", { name: "Copy from CONFIGURE Fees" }));

      expect(screen.queryByLabelText("Comment for CONFIGURE Fees")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Comment for CONFIGURE Delinquency")).toHaveValue("Delinquency is configured.");
    });

    it("copies each task with its own comment and source link, one request per task", async () => {
      bulkCopy.mockResolvedValueOnce(inlineOk(["T2", "T3"])).mockResolvedValueOnce(inlineOk(["T2", "T3"]));
      const user = await chooseTwo();
      await waitFor(() =>
        expect(screen.getByLabelText("Comment for CONFIGURE Delinquency")).toHaveValue("Delinquency is configured.")
      );
      await pick(user, "Second St", "Third St");

      const box = screen.getByLabelText("Comment for CONFIGURE Delinquency");
      await user.clear(box);
      await user.type(box, "Late fees done.");
      await user.click(screen.getByRole("button", { name: "Confirm — copy 2 tasks to 2 facilities" }));

      await waitFor(() => expect(bulkCopy).toHaveBeenCalledTimes(2));
      expect(bulkCopy).toHaveBeenNthCalledWith(
        1,
        "c1",
        expect.objectContaining({ sourceTaskId: "S1", comment: "Fees are configured.", background: false })
      );
      expect(bulkCopy).toHaveBeenNthCalledWith(
        2,
        "c1",
        expect.objectContaining({
          sourceTaskId: "S2",
          sourceTaskName: "CONFIGURE Delinquency",
          comment: "Late fees done.",
          background: false,
        })
      );
      // Each task's outcome is named.
      expect(await screen.findByText(/CONFIGURE Fees:/)).toBeInTheDocument();
      expect(screen.getByText(/CONFIGURE Delinquency:/)).toBeInTheDocument();
    });

    it("selects and clears a whole phase at once", async () => {
      const user = userEvent.setup();
      render(<BulkCopyPanel companyId="c1" />);
      await screen.findByRole("checkbox", { name: "Copy from CONFIGURE Fees" });

      await user.click(screen.getByRole("button", { name: "Select all in Set Up" }));

      expect(screen.getByRole("checkbox", { name: "Copy from CONFIGURE Fees" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Copy from CONFIGURE Delinquency" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Copy from IMPORT Tenants" })).not.toBeChecked();

      await user.click(screen.getByRole("button", { name: "Select none in Set Up" }));
      expect(screen.getByRole("checkbox", { name: "Copy from CONFIGURE Fees" })).not.toBeChecked();
    });

    it("sends every task to the background when the whole selection is too big, asking for notifications first", async () => {
      const many = Array.from({ length: 9 }, (_, n) => destination(`f${n}`, `Facility ${n}`, `T${n}`));
      getBulkPairs.mockResolvedValue(ok(pairs({ destinations: many })));
      getBulkTasks.mockResolvedValue(
        ok({
          ...bulkTasks(),
          destinations: many.map((d) => ({ facility_id: d.facility_id, facility_name: d.facility_name })),
        })
      );
      bulkCopy.mockResolvedValue(ok({ mode: "job", job_id: "j", total: 9, results: [], copied: 0, failed: 0 }));
      const user = await chooseTwo();
      await waitFor(() =>
        expect(screen.getByLabelText("Comment for CONFIGURE Delinquency")).toHaveValue("Delinquency is configured.")
      );
      await user.click(pickerButton());
      await user.click(screen.getByRole("button", { name: "Select all" }));
      await user.keyboard("{Escape}");

      // 2 tasks x 9 facilities x 3 calls = 54: over the 50 a request may do inline.
      await user.click(screen.getByRole("button", { name: "Confirm — copy 2 tasks to 9 facilities" }));

      await waitFor(() => expect(bulkCopy).toHaveBeenCalledTimes(2));
      expect(ask).toHaveBeenCalledTimes(1);
      expect(bulkCopy).toHaveBeenNthCalledWith(1, "c1", expect.objectContaining({ background: true }));
      expect(bulkCopy).toHaveBeenNthCalledWith(2, "c1", expect.objectContaining({ background: true }));
    });
  });
});
