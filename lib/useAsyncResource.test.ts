import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApiResult } from "./http";
import { useAsyncResource } from "./useAsyncResource";

const ok = <T,>(data: T): ApiResult<T> => ({ kind: "ok", data });

describe("useAsyncResource", () => {
  it("loads on mount, starting in the loading state", async () => {
    const load = vi.fn().mockResolvedValue(ok("first"));

    const { result } = renderHook(() => useAsyncResource(load, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("first"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports a failed load as an error with no data", async () => {
    const load = vi.fn().mockResolvedValue({ kind: "error", message: "nope" });

    const { result } = renderHook(() => useAsyncResource(load, []));

    await waitFor(() => expect(result.current.error).toBe("nope"));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("reloads when a dependency changes, dropping the old value first", async () => {
    const load = vi.fn(async () => ok("value"));
    const { result, rerender } = renderHook(({ id }) => useAsyncResource(() => load(), [id]), {
      initialProps: { id: "a" },
    });
    await waitFor(() => expect(result.current.data).toBe("value"));

    rerender({ id: "b" });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("value");
  });

  it("refetch loads again without a dependency change", async () => {
    const load = vi.fn().mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(ok(2));
    const { result } = renderHook(() => useAsyncResource(load, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it("ignores an answer that arrives after a newer load started", async () => {
    let answerFirst: (value: ApiResult<string>) => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(ok("newer"));
    const { result, rerender } = renderHook(({ id }) => useAsyncResource(load, [id]), {
      initialProps: { id: "a" },
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    rerender({ id: "b" });
    await waitFor(() => expect(result.current.data).toBe("newer"));
    await act(async () => {
      answerFirst(ok("stale"));
      await Promise.resolve();
    });

    expect(result.current.data).toBe("newer");
  });
});
