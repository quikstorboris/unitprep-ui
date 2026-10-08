import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSyncStatus, startSync } = vi.hoisted(() => ({
  getSyncStatus: vi.fn(),
  startSync: vi.fn(),
}));

vi.mock("@/lib/clientsSearch", () => ({ getSyncStatus, startSync }));

import SyncButton from "./SyncButton";

function status(state: "idle" | "running" | "completed", processed = 0) {
  return {
    kind: "ok" as const,
    data: { state, total_runs: 10, processed_runs: processed, percent: processed * 10, error: null },
  };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

async function flush() {
  // Lets the queueMicrotask'd first poll and its awaited fetch resolve.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SyncButton polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSyncStatus.mockReset();
    startSync.mockReset();
    setHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it("keeps polling while a sync runs and stops once it completes", async () => {
    getSyncStatus
      .mockResolvedValueOnce(status("running", 2))
      .mockResolvedValueOnce(status("running", 6))
      .mockResolvedValueOnce(status("completed", 10));
    render(<SyncButton />);
    await flush();
    expect(screen.getByText(/20% \(2\/10 runs\)/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText(/60% \(6\/10 runs\)/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText(/Sync complete/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getSyncStatus).toHaveBeenCalledTimes(3);
  });

  it("never starts a second status check before the first has answered", async () => {
    let answerFirst: (value: ReturnType<typeof status>) => void = () => {};
    getSyncStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      }),
    );
    render(<SyncButton />);
    await flush();

    // A slow answer: 10 s pass with the first request still open.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getSyncStatus).toHaveBeenCalledTimes(1);

    getSyncStatus.mockResolvedValue(status("completed", 10));
    await act(async () => {
      answerFirst(status("running", 1));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(getSyncStatus).toHaveBeenCalledTimes(2);
  });

  it("does not schedule polls while the tab is hidden, and resumes when it is shown", async () => {
    setHidden(true);
    getSyncStatus.mockResolvedValue(status("running", 3));
    render(<SyncButton />);
    await flush();
    expect(getSyncStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getSyncStatus).toHaveBeenCalledTimes(1);

    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(getSyncStatus).toHaveBeenCalledTimes(2);
  });

  it("stops polling when the page is left", async () => {
    getSyncStatus.mockResolvedValue(status("running", 3));
    const { unmount } = render(<SyncButton />);
    await flush();
    expect(getSyncStatus).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(getSyncStatus).toHaveBeenCalledTimes(1);
  });
});
