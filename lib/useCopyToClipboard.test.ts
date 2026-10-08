import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies, flags copied, and clears the flag after the delay", async () => {
    writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard(1500));

    let ok = false;
    await act(async () => {
      ok = await result.current.copy("hello");
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("reports a refused write as false without throwing or flagging copied", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    let ok = true;
    await act(async () => {
      ok = await result.current.copy("x");
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it("restarts the delay on a repeat copy", async () => {
    writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard(1000));

    await act(async () => {
      await result.current.copy("a");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await act(async () => {
      await result.current.copy("b");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.copied).toBe(true);
  });

  it("clears its timer on unmount", async () => {
    writeText.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useCopyToClipboard(1000));
    await act(async () => {
      await result.current.copy("a");
    });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
