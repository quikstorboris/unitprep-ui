import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncLogEntry } from "@/lib/clickupCopy";

const { getSyncLog } = vi.hoisted(() => ({ getSyncLog: vi.fn() }));
vi.mock("@/lib/clickupCopy", () => ({ getSyncLog }));

import CopySyncLog from "./CopySyncLog";

function entry(overrides: Partial<SyncLogEntry> = {}): SyncLogEntry {
  return {
    id: "e1",
    created_at: "2026-10-09T15:00:00Z",
    actor_name: "Boris M",
    source_facility_id: "f-parent",
    source_facility_name: "Affordable Storage Synott",
    copied: 3,
    failed: 0,
    bulk: false,
    pointers_posted: 3,
    complete_requested: false,
    tasks_completed: 0,
    ...overrides,
  };
}

const ok = (entries: SyncLogEntry[], has_more = false) => ({ kind: "ok" as const, data: { entries, has_more } });

beforeEach(() => {
  getSyncLog.mockReset();
});

describe("CopySyncLog", () => {
  it("says so when nothing has been copied onto the facility yet", async () => {
    getSyncLog.mockResolvedValue(ok([]));
    render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);

    expect(await screen.findByText(/No comments have been copied onto this facility yet/)).toBeInTheDocument();
  });

  it("shows the latest source project and a line per copy", async () => {
    getSyncLog.mockResolvedValue(
      ok([
        entry({ id: "e2", source_facility_name: "Highway 20", bulk: true, copied: 1, failed: 2, tasks_completed: 1 }),
        entry(),
      ])
    );
    render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);

    // The latest copy is named at the top (and again in its own row).
    expect((await screen.findAllByText(/Highway 20/)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1 comment copied, 2 failed, 1 task completed/)).toBeInTheDocument();
    expect(screen.getByText(/3 comments copied/)).toBeInTheDocument();
    expect(screen.getByText(/from the client tab/)).toBeInTheDocument();
  });

  it("names a deleted source facility as removed", async () => {
    getSyncLog.mockResolvedValue(ok([entry({ source_facility_name: null })]));
    render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);

    expect((await screen.findAllByText(/A removed facility/)).length).toBeGreaterThan(0);
  });

  it("loads older entries after the last one shown", async () => {
    getSyncLog.mockResolvedValueOnce(ok([entry({ id: "e2" })], true));
    getSyncLog.mockResolvedValueOnce(ok([entry({ id: "e1", copied: 5 })]));
    render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);

    await userEvent.click(await screen.findByRole("button", { name: "Show older" }));

    await waitFor(() => expect(getSyncLog).toHaveBeenLastCalledWith("c", "f", "e2"));
    expect(await screen.findByText(/5 comments copied/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show older" })).not.toBeInTheDocument();
  });

  it("reloads when the refresh key changes", async () => {
    getSyncLog.mockResolvedValue(ok([]));
    const { rerender } = render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);
    await waitFor(() => expect(getSyncLog).toHaveBeenCalledTimes(1));

    rerender(<CopySyncLog companyId="c" facilityId="f" refreshKey={1} />);
    await waitFor(() => expect(getSyncLog).toHaveBeenCalledTimes(2));
  });

  it("shows the server's message when the log cannot be loaded", async () => {
    getSyncLog.mockResolvedValue({ kind: "error", message: "Could not load the sync log" });
    render(<CopySyncLog companyId="c" facilityId="f" refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the sync log");
  });
});
