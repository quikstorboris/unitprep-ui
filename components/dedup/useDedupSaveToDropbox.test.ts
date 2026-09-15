import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDedupSaveToDropbox } from "./useDedupSaveToDropbox";

describe("useDedupSaveToDropbox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts folder_path (not a client-assembled dropbox_path) and facility_id to /dedup/export-dropbox", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "/qms onboarding/prairie enterprises llc/highway 20/preliminary data/Duplicate Check/MSS_v1_pull_check_09-14-2026.csv",
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

    await act(async () => {
      await result.current.handleSave(
        "csv",
        "/qms onboarding/prairie enterprises llc/highway 20/preliminary data/Duplicate Check",
        "facility-1"
      );
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/dedup/export-dropbox");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "s1",
      format: "csv",
      folder_path:
        "/qms onboarding/prairie enterprises llc/highway 20/preliminary data/Duplicate Check",
      facility_id: "facility-1",
    });
  });

  it("sends facility_id: null when no facility is known", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ path: "/some/folder/report.csv" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

    await act(async () => {
      await result.current.handleSave("csv", "/some/folder", undefined);
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ facility_id: null });
  });

  it("threads client_id into the request body, mirroring useDedupExport", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ path: "/some/folder/report.csv" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useDedupSaveToDropbox("s1", "client-1")
    );

    await act(async () => {
      await result.current.handleSave("csv", "/some/folder", "facility-1");
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ client_id: "client-1" });
  });

  it("sets savedPath from the backend's real computed path, not a client-assembled one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          path: "/some/folder/MSS_v3_pull_check_09-14-2026.xlsx",
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

    expect(result.current.savedPath).toBeNull();

    await act(async () => {
      await result.current.handleSave("xlsx", "/some/folder", "facility-1");
    });

    expect(result.current.savedPath).toBe(
      "/some/folder/MSS_v3_pull_check_09-14-2026.xlsx"
    );
    expect(result.current.saving).toBe(false);
  });

  it.each([404, 401])(
    "sets sessionExpired for a %i response without setting savedPath",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status }))
      );

      const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

      await act(async () => {
        await result.current.handleSave("csv", "/some/folder", "facility-1");
      });

      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.savedPath).toBeNull();
    }
  );

  it("surfaces an error for a non-ok, non-401/404 response without setting savedPath", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "dropbox save failed" }), {
          status: 500,
        })
      )
    );

    const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

    await act(async () => {
      await result.current.handleSave("csv", "/some/folder", "facility-1");
    });

    expect(result.current.error).toBe("dropbox save failed");
    expect(result.current.savedPath).toBeNull();
  });

  it("ignores a second concurrent handleSave call while one is already in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDedupSaveToDropbox("s1"));

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.handleSave(
        "csv",
        "/some/folder",
        "facility-1"
      );
      secondCall = result.current.handleSave(
        "csv",
        "/some/folder",
        "facility-1"
      );
    });

    resolveFetch(
      new Response(JSON.stringify({ path: "/some/folder/report.csv" }), {
        status: 200,
      })
    );
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
