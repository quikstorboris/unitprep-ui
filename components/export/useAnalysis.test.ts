import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAnalysis } from "./useAnalysis";

describe("useAnalysis", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /analyze with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ facilities: 1 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useAnalysis("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/analyze");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves analysis on a successful response", async () => {
    const analyzeResponse = {
      facilities: 3,
      global_groups: 10,
      net_new_groups: 2,
      similar_groups: 1,
      advisory_issues: 0,
      net_new_group_details: [],
      similar_group_details: [],
      advisory_issue_details: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(analyzeResponse), { status: 200 })
      )
    );

    const { result } = renderHook(() => useAnalysis("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.analysis).toEqual(analyzeResponse);
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

      const { result } = renderHook(() => useAnalysis("s1"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.analysis).toBeNull();
      expect(result.current.error).toBeNull();
    }
  );

  it("surfaces an error message for a non-ok, non-401/404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "analysis failed" }), {
          status: 500,
        })
      )
    );

    const { result } = renderHook(() => useAnalysis("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("analysis failed");
    expect(result.current.analysis).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });

  it("does not fetch for an empty sessionId", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAnalysis(""));

    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
