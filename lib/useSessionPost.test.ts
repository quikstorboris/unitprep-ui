import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSessionPost } from "./useSessionPost";

describe("useSessionPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials: include on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useSessionPost("s1", "/validate"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("resolves data on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ facilities: 3 }), { status: 200 })
      )
    );

    const { result } = renderHook(() =>
      useSessionPost<{ facilities: number }>("s1", "/analyze")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ facilities: 3 });
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it.each([404, 401])(
    "treats a %i response as sessionExpired, not an error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status }))
      );

      const { result } = renderHook(() => useSessionPost("s1", "/analyze"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.error).toBeNull();
    }
  );

  it("surfaces a real error message for a non-ok, non-401/404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "boom" }), { status: 500 })
      )
    );

    const { result } = renderHook(() => useSessionPost("s1", "/analyze"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.sessionExpired).toBe(false);
  });

  it("does nothing for an empty sessionId", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSessionPost("", "/analyze"));

    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("describes an unreachable API server for a network-level fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const { result } = renderHook(() => useSessionPost("s1", "/analyze"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain(
      "Could not reach the API server"
    );
    expect(result.current.sessionExpired).toBe(false);
  });

  it("skips the fetch entirely when initialData is provided", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSessionPost<{ facilities: number }>(
        "s1",
        "/analyze",
        { facilities: 3 }
      )
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ facilities: 3 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves cancelled (not error) when cancel() aborts the in-flight fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          })
      )
    );

    const { result } = renderHook(() => useSessionPost("s1", "/analyze"));

    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => {
      result.current.cancel();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cancelled).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });

  it("ticks elapsedMs while the initial fetch is in flight", async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise<Response>(() => {}))
    );

    const { result } = renderHook(() => useSessionPost("s1", "/analyze"));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1000);

    vi.useRealTimers();
  });

  it("does not mark cancelled when a sessionId change aborts the previous fetch", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
          // Never resolves on its own within this test -- only the
          // sessionId change's cleanup-triggered abort ends it.
          void resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ sessionId }) => useSessionPost(sessionId, "/analyze"),
      { initialProps: { sessionId: "s1" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({ sessionId: "s2" });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // The old request's abort (cleanup, not a user cancel()) must not
    // surface as "cancelled" -- that flag is reserved for an explicit
    // cancel() call.
    expect(result.current.cancelled).toBe(false);
  });

  it("clears stale data from a prior sessionId once a new fetch starts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ facilities: 3 }), { status: 200 })
      )
      .mockImplementationOnce(
        () => new Promise<Response>(() => {})
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useSessionPost<{ facilities: number }>(sessionId, "/analyze"),
      { initialProps: { sessionId: "s1" } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ facilities: 3 });

    rerender({ sessionId: "s2" });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
