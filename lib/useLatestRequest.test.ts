import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatestRequest } from "./useLatestRequest";

describe("useLatestRequest", () => {
  it("aborts the previous request when a new one begins", () => {
    const { result } = renderHook(() => useLatestRequest());

    const first = result.current();
    expect(first.aborted).toBe(false);

    const second = result.current();

    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it("hands back a stable begin function across re-renders", () => {
    const { result, rerender } = renderHook(() => useLatestRequest());
    const begin = result.current;

    rerender();

    expect(result.current).toBe(begin);
  });

  it("aborts what is still in flight on unmount", () => {
    const { result, unmount } = renderHook(() => useLatestRequest());
    const signal = result.current();

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
