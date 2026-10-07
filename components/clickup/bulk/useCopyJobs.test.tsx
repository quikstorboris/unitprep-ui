import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CopyJob } from "@/lib/clickupBulkCopy";

const { listCopyJobs } = vi.hoisted(() => ({ listCopyJobs: vi.fn() }));

vi.mock("@/lib/clickupBulkCopy", () => ({ listCopyJobs }));

import { askForNotifications, notificationFor, POLL_MS, useCopyJobs } from "./useCopyJobs";

function job(overrides: Partial<CopyJob> = {}): CopyJob {
  return {
    id: "j1",
    status: "running",
    source_task_name: "CONFIGURE Fees",
    total: 20,
    copied: 0,
    failed: 0,
    results: [],
    message: null,
    created_at: "2026-10-07T12:00:00Z",
    finished_at: null,
    ...overrides,
  };
}

const ok = (jobs: CopyJob[]) => ({ kind: "ok", data: jobs });

/** Stands in for the browser's Notification, recording what is shown. */
const shown: { title: string; body?: string }[] = [];
class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(async () => {
    FakeNotification.permission = "granted";
    return "granted" as NotificationPermission;
  });
  constructor(title: string, options?: NotificationOptions) {
    shown.push({ title, body: options?.body });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  shown.length = 0;
  FakeNotification.permission = "granted";
  FakeNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", FakeNotification);
  listCopyJobs.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useCopyJobs", () => {
  it("loads the recent jobs", async () => {
    listCopyJobs.mockResolvedValue(ok([job({ id: "a", status: "done", copied: 20 })]));

    const { result } = renderHook(() => useCopyJobs("c1"));
    await advance(0);

    expect(listCopyJobs).toHaveBeenCalledWith("c1");
    expect(result.current.jobs.map((j) => j.id)).toEqual(["a"]);
  });

  it("keeps checking while a job runs, and notifies once when it finishes", async () => {
    listCopyJobs
      .mockResolvedValueOnce(ok([job({ copied: 5 })]))
      .mockResolvedValueOnce(ok([job({ copied: 12 })]))
      .mockResolvedValue(ok([job({ status: "done", copied: 20, finished_at: "2026-10-07T12:03:00Z" })]));

    const { result } = renderHook(() => useCopyJobs("c1"));
    await advance(0);
    expect(result.current.jobs[0].copied).toBe(5);
    expect(shown).toHaveLength(0);

    await advance(POLL_MS);
    expect(result.current.jobs[0].copied).toBe(12);
    expect(shown).toHaveLength(0);

    await advance(POLL_MS);
    expect(result.current.jobs[0].status).toBe("done");
    expect(shown).toEqual([
      { title: "ClickUp Copy finished", body: '"CONFIGURE Fees" was copied to 20 facilities.' },
    ]);

    // Finished: it stops polling, and never notifies a second time.
    const calls = listCopyJobs.mock.calls.length;
    await advance(POLL_MS * 3);
    expect(listCopyJobs.mock.calls.length).toBe(calls);
    expect(shown).toHaveLength(1);
  });

  it("does not notify about a job that was already finished when the page loaded", async () => {
    listCopyJobs.mockResolvedValue(ok([job({ status: "done", copied: 20 })]));

    renderHook(() => useCopyJobs("c1"));
    await advance(POLL_MS * 2);

    expect(shown).toHaveLength(0);
  });

  it("does not notify when the browser has not allowed notifications", async () => {
    FakeNotification.permission = "denied";
    listCopyJobs
      .mockResolvedValueOnce(ok([job()]))
      .mockResolvedValue(ok([job({ status: "done", copied: 20 })]));

    const { result } = renderHook(() => useCopyJobs("c1"));
    await advance(0);
    await advance(POLL_MS);

    expect(result.current.jobs[0].status).toBe("done");
    expect(shown).toHaveLength(0);
  });

  it("surfaces a failed read without throwing", async () => {
    listCopyJobs.mockResolvedValue({ kind: "error", message: "Could not load your ClickUp Copy jobs" });

    const { result } = renderHook(() => useCopyJobs("c1"));
    await advance(0);

    expect(result.current.loadError).toBe("Could not load your ClickUp Copy jobs");
    expect(result.current.jobs).toEqual([]);
  });
});

describe("notificationFor", () => {
  it("says how many copied, and points at the client when some failed", () => {
    expect(notificationFor(job({ status: "done", copied: 1 })).body).toBe(
      '"CONFIGURE Fees" was copied to 1 facility.'
    );
    expect(notificationFor(job({ status: "done", copied: 17, failed: 3 }))).toEqual({
      title: "ClickUp Copy finished",
      body: '"CONFIGURE Fees": 17 copied, 3 failed. Open the client to see which.',
    });
  });

  it("says when a job was interrupted or failed", () => {
    expect(notificationFor(job({ status: "interrupted", copied: 6, failed: 1 }))).toEqual({
      title: "ClickUp Copy stopped",
      body: '"CONFIGURE Fees" was interrupted after 7 of 20. Check ClickUp, then copy the rest again.',
    });
    expect(notificationFor(job({ status: "failed", message: "boom" })).body).toBe(
      '"CONFIGURE Fees" failed: boom'
    );
  });
});

describe("askForNotifications", () => {
  it("asks only when the browser has not been asked yet", async () => {
    FakeNotification.permission = "default";
    await askForNotifications();
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);

    await askForNotifications();
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("is harmless where notifications do not exist", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("Notification", undefined);

    await expect(askForNotifications()).resolves.toBeUndefined();
  });
});
