import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExportDownload } from "./useExportDownload";

describe("useExportDownload", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...window.URL,
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });

    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to /export with acknowledge_errors merged into the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["zip"]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExportDownload("s1", true));

    await act(async () => {
      await result.current.handleExport();
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/export");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "s1",
      acknowledge_errors: true,
    });
  });

  it("defaults acknowledge_errors to false when not passed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["zip"]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExportDownload("s1"));

    await act(async () => {
      await result.current.handleExport();
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ acknowledge_errors: false });
  });

  it("triggers a download and sets downloadComplete on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Blob(["zip"]), { status: 200 }))
    );

    const { result } = renderHook(() => useExportDownload("s1"));

    expect(result.current.downloadComplete).toBe(false);

    await act(async () => {
      await result.current.handleExport();
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.downloadComplete).toBe(true);
    expect(result.current.exporting).toBe(false);
  });

  it.each([404, 401])(
    "sets sessionExpired for a %i response without downloading",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

      const { result } = renderHook(() => useExportDownload("s1"));

      await act(async () => {
        await result.current.handleExport();
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
        new Response(JSON.stringify({ message: "export failed" }), { status: 500 })
      )
    );

    const { result } = renderHook(() => useExportDownload("s1"));

    await act(async () => {
      await result.current.handleExport();
    });

    expect(result.current.error).toBe("export failed");
    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.current.downloadComplete).toBe(false);
  });
});
