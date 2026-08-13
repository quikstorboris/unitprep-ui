import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stashTaggerCheck } from "@/lib/taggerReportCache";
import type { TaggerCheckResponse } from "@/types/api";

import { useTaggerReport } from "./useTaggerReport";

function taggerCheckResponse(
  overrides: Partial<TaggerCheckResponse> = {}
): TaggerCheckResponse {
  return {
    session_id: "s1",
    candidates: [
      {
        index: 0,
        region: "body",
        tag_key: "TENANT_NAME",
        matched_text: "John Doe",
        tier: "auto",
        snippet: "Tenant: John Doe lives here",
      },
    ],
    ...overrides,
  };
}

describe("useTaggerReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /tagger/report with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(taggerCheckResponse()), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useTaggerReport("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tagger/report");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves candidates on a successful response", async () => {
    const response = taggerCheckResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    );

    const { result } = renderHook(() => useTaggerReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.candidates).toEqual(response.candidates);
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

      const { result } = renderHook(() => useTaggerReport("s1"));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.candidates).toBeNull();
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

    const { result } = renderHook(() => useTaggerReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("report failed");
    expect(result.current.candidates).toBeNull();
  });

  it("does not fetch for an empty sessionId", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaggerReport(""));

    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a response stashed by TaggerUploadPage instead of fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = taggerCheckResponse();
    stashTaggerCheck(response);

    const { result } = renderHook(() => useTaggerReport("s1"));

    expect(result.current.loading).toBe(false);
    expect(result.current.candidates).toEqual(response.candidates);
    expect(result.current.sessionExpired).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetching when nothing was stashed for this sessionId", async () => {
    const response = taggerCheckResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // Something is stashed, but for a different sessionId -- a direct
    // visit/refresh of this URL, not a check-then-navigate flow.
    stashTaggerCheck({ ...response, session_id: "some-other-session" });

    const { result } = renderHook(() => useTaggerReport("s1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.candidates).toEqual(response.candidates);
  });
});
