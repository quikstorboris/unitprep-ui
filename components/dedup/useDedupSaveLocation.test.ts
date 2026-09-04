import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDedupSaveLocation } from "./useDedupSaveLocation";

describe("useDedupSaveLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /dedup/save-location with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ default_folder_path: null }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useDedupSaveLocation("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/dedup/save-location");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves the Duplicate Check subfolder for a Dropbox-imported session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            default_folder_path: "/qms onboarding/prairie enterprises llc/highway 20/preliminary data/Duplicate Check",
          }),
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useDedupSaveLocation("s1"));

    await waitFor(() =>
      expect(result.current.defaultFolderPath).toBe(
        "/qms onboarding/prairie enterprises llc/highway 20/preliminary data/Duplicate Check"
      )
    );
  });

  it("resolves null for a locally-uploaded session, not undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ default_folder_path: null }), { status: 200 })
      )
    );

    const { result } = renderHook(() => useDedupSaveLocation("s1"));

    // undefined means "still loading" (no data at all yet) -- a
    // resolved response explicitly saying "no source folder" must come
    // through as null, distinguishably, not collapse into the same
    // "not ready" state.
    await waitFor(() => expect(result.current.defaultFolderPath).toBeNull());
  });
});
