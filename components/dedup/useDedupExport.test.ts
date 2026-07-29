import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDedupExport } from "./useDedupExport";

describe("useDedupExport", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clickedFilenames: string[];

  beforeEach(() => {
    clickedFilenames = [];

    vi.stubGlobal("URL", {
      ...window.URL,
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });

    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedFilenames.push(this.download);
      });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to /dedup/export with the requested format merged into the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["csv"]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupExport("s1"));

    await act(async () => {
      await result.current.handleExport("csv");
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/dedup/export");
    expect(JSON.parse(init.body)).toEqual({ session_id: "s1", format: "csv" });
  });

  it("triggers a download and sets downloadComplete on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Blob(["csv"]), { status: 200 }))
    );

    const { result } = renderHook(() => useDedupExport("s1"));

    expect(result.current.downloadComplete).toBe(false);

    await act(async () => {
      await result.current.handleExport("csv");
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.downloadComplete).toBe(true);
    expect(result.current.exporting).toBe(false);
  });

  it.each([
    ["csv", "duplicate_tenant_check.csv"],
    ["xlsx", "duplicate_tenant_check.xlsx"],
    ["both", "duplicate_tenant_check.zip"],
  ] as const)(
    "falls back to the %s format's own filename when Content-Disposition is missing",
    async (format, expectedFilename) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(new Blob(["data"]), { status: 200 }))
      );

      const { result } = renderHook(() => useDedupExport("s1"));

      await act(async () => {
        await result.current.handleExport(format);
      });

      expect(clickedFilenames).toEqual([expectedFilename]);
    }
  );

  it("uses the filename from Content-Disposition when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Blob(["data"]), {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="custom.zip"' },
        })
      )
    );

    const { result } = renderHook(() => useDedupExport("s1"));

    await act(async () => {
      await result.current.handleExport("both");
    });

    expect(clickedFilenames).toEqual(["custom.zip"]);
  });

  it.each([404, 401])(
    "sets sessionExpired for a %i response without downloading",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

      const { result } = renderHook(() => useDedupExport("s1"));

      await act(async () => {
        await result.current.handleExport("csv");
      });

      expect(result.current.sessionExpired).toBe(true);
      expect(clickSpy).not.toHaveBeenCalled();
      expect(result.current.downloadComplete).toBe(false);
    }
  );

  it("surfaces an error for a non-ok, non-401/404 response without downloading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "dedup export failed" }), {
          status: 500,
        })
      )
    );

    const { result } = renderHook(() => useDedupExport("s1"));

    await act(async () => {
      await result.current.handleExport("xlsx");
    });

    expect(result.current.error).toBe("dedup export failed");
    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.current.downloadComplete).toBe(false);
  });

  it("clears a stale downloadComplete from a prior success once a new attempt fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Blob(["csv"]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "dedup export failed" }), {
          status: 500,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupExport("s1"));

    await act(async () => {
      await result.current.handleExport("csv");
    });
    expect(result.current.downloadComplete).toBe(true);

    await act(async () => {
      await result.current.handleExport("csv");
    });

    expect(result.current.downloadComplete).toBe(false);
    expect(result.current.error).toBe("dedup export failed");
  });

  it("ignores a second concurrent handleExport call while one is already in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupExport("s1"));

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.handleExport("csv");
      secondCall = result.current.handleExport("csv");
    });

    resolveFetch(new Response(new Blob(["csv"]), { status: 200 }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
