import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stashDedupReport } from "@/lib/dedupReportCache";

import { useDedupReport } from "./useDedupReport";

function dedupReport() {
  return {
    total_rows: 10,
    unique_tenants: 8,
    multi_unit_tenants: 2,
    flagged_groups: [],
    typo_variant_candidates: [],
    related_tenant_candidates: [],
  };
}

describe("useDedupReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /dedup/report with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(dedupReport()), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useDedupReport("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/dedup/report");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves report on a successful response", async () => {
    const report = dedupReport();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(report), { status: 200 }))
    );

    const { result } = renderHook(() => useDedupReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.report).toEqual(report);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });

  it.each([404, 401])(
    "treats a %i response as sessionExpired, not an error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status }))
      );

      const { result } = renderHook(() => useDedupReport("s1"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.report).toBeNull();
      expect(result.current.error).toBeNull();
    }
  );

  it("surfaces an error message for a non-ok, non-401/404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "report failed" }), { status: 500 })
      )
    );

    const { result } = renderHook(() => useDedupReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("report failed");
    expect(result.current.report).toBeNull();
  });

  it("does not fetch for an empty sessionId", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupReport(""));

    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a report stashed by DedupUploadPage instead of fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const report = dedupReport();
    stashDedupReport("s1", report);

    const { result } = renderHook(() => useDedupReport("s1"));

    expect(result.current.loading).toBe(false);
    expect(result.current.report).toEqual(report);
    expect(result.current.sessionExpired).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetching when nothing was stashed for this sessionId", async () => {
    const report = dedupReport();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(report), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // Something is stashed, but for a different sessionId -- a direct
    // visit/refresh of this URL, not a check-then-navigate flow.
    stashDedupReport("some-other-session", report);

    const { result } = renderHook(() => useDedupReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.report).toEqual(report);
  });
});
