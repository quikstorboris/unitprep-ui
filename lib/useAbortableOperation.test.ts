import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, isAbortError, useAbortableOperation } from "./useAbortableOperation";

describe("useAbortableOperation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at zero elapsed and not cancelled", () => {
    const { result } = renderHook(() => useAbortableOperation());

    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.cancelled).toBe(false);
  });

  it("ticks elapsedMs while an attempt is in flight", () => {
    const { result } = renderHook(() => useAbortableOperation());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1000);
  });

  it("freezes elapsedMs once finish() is called", () => {
    const { result } = renderHook(() => useAbortableOperation());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const elapsedAtFinish = result.current.elapsedMs;

    act(() => {
      result.current.finish();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.elapsedMs).toBe(elapsedAtFinish);
  });

  it("resets elapsedMs and cancelled on a fresh start()", () => {
    const { result } = renderHook(() => useAbortableOperation());

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.cancel();
    });

    expect(result.current.cancelled).toBe(true);

    act(() => {
      result.current.start();
    });

    expect(result.current.cancelled).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
  });

  it("aborts the controller returned by start() when cancel() is called", () => {
    const { result } = renderHook(() => useAbortableOperation());

    let controller: AbortController;
    act(() => {
      controller = result.current.start();
    });

    expect(controller!.signal.aborted).toBe(false);

    act(() => {
      result.current.cancel();
    });

    expect(controller!.signal.aborted).toBe(true);
    expect(result.current.cancelled).toBe(true);
  });

  it("is a no-op when cancel() is called with nothing in flight", () => {
    const { result } = renderHook(() => useAbortableOperation());

    act(() => {
      result.current.cancel();
    });

    expect(result.current.cancelled).toBe(false);
  });
});

describe("formatElapsed", () => {
  it.each([
    [0, "0s"],
    [999, "0s"],
    [1000, "1s"],
    [59000, "59s"],
    [60000, "1m 00s"],
    [65000, "1m 05s"],
    [125000, "2m 05s"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatElapsed(ms)).toBe(expected);
  });
});

describe("isAbortError", () => {
  it("recognizes a DOMException/Error named AbortError", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
  });

  it("does not recognize an unrelated error", () => {
    expect(isAbortError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isAbortError("not an error")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
