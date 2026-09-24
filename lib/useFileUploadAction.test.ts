import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockXMLHttpRequest } from "@/lib/testUtils/MockXMLHttpRequest";
import { useFileUploadAction } from "./useFileUploadAction";
import type { SessionActionResult } from "./useSessionAction";

describe("useFileUploadAction", () => {
  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    MockXMLHttpRequest.reset();
  });

  it("sends withCredentials and the FormData body as a POST", () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    act(() => {
      void result.current.run(new FormData());
    });

    const xhr = MockXMLHttpRequest.latest();
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toContain("/dedup/check");
    expect(xhr.withCredentials).toBe(true);
  });

  it("reports real, browser-driven upload progress rather than a fake percentage", () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    act(() => {
      void result.current.run(new FormData());
    });

    expect(result.current.uploadProgress).toBe(0);

    act(() => {
      MockXMLHttpRequest.latest().progress(50, 200);
    });

    expect(result.current.uploadProgress).toBe(0.25);

    act(() => {
      MockXMLHttpRequest.latest().progress(200, 200);
    });

    expect(result.current.uploadProgress).toBe(1);
  });

  it("resolves ok and returns a Response-shaped result on a 2xx reply", async () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    let outcome: SessionActionResult;
    await act(async () => {
      const runPromise = result.current.run(new FormData());
      MockXMLHttpRequest.latest().respond(
        200,
        JSON.stringify({ session_id: "s1" })
      );
      outcome = await runPromise;
    });

    expect(outcome!.kind).toBe("ok");
    if (outcome!.kind === "ok") {
      const body = await outcome!.response.json();
      expect(body).toEqual({ session_id: "s1" });
    }
    expect(result.current.pending).toBe(false);
  });

  it.each([404, 401])(
    "resolves sessionExpired for a %i response, not error",
    async (status) => {
      const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

      let outcome: SessionActionResult;
      await act(async () => {
        const runPromise = result.current.run(new FormData());
        MockXMLHttpRequest.latest().respond(status, "");
        outcome = await runPromise;
      });

      expect(outcome!).toEqual({ kind: "sessionExpired" });
      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.error).toBeNull();
    }
  );

  it("resolves an error result for a non-ok, non-401/404 response", async () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    let outcome: SessionActionResult;
    await act(async () => {
      const runPromise = result.current.run(new FormData());
      MockXMLHttpRequest.latest().respond(
        500,
        JSON.stringify({ message: "boom" })
      );
      outcome = await runPromise;
    });

    expect(outcome!.kind).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("resolves an error result on a network-level failure", async () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    let outcome: SessionActionResult;
    await act(async () => {
      const runPromise = result.current.run(new FormData());
      MockXMLHttpRequest.latest().networkError();
      outcome = await runPromise;
    });

    expect(outcome!.kind).toBe("error");
    expect(result.current.error).toContain("Could not reach the API server");
  });

  it("aborts the underlying XHR and resolves cancelled when cancel() is called mid-upload", async () => {
    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    let outcome: SessionActionResult;
    await act(async () => {
      const runPromise = result.current.run(new FormData());
      result.current.cancel();
      outcome = await runPromise;
    });

    expect(outcome!).toEqual({ kind: "cancelled" });
    expect(result.current.cancelled).toBe(true);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(MockXMLHttpRequest.latest().aborted).toBe(true);
  });

  it("tracks elapsed time while an upload is in flight", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFileUploadAction("/dedup/check"));

    act(() => {
      void result.current.run(new FormData());
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1000);

    vi.useRealTimers();
  });
});
