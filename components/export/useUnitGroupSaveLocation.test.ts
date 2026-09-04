import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUnitGroupSaveLocation } from "./useUnitGroupSaveLocation";

describe("useUnitGroupSaveLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /export/save-location with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ default_folder_path: null }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useUnitGroupSaveLocation("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/export/save-location");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves the Group Prep Output subfolder for a Dropbox-imported session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            default_folder_path: "/qms onboarding/prairie enterprises llc/highway 20/Group Prep Output",
          }),
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useUnitGroupSaveLocation("s1"));

    await waitFor(() =>
      expect(result.current.defaultFolderPath).toBe(
        "/qms onboarding/prairie enterprises llc/highway 20/Group Prep Output"
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

    const { result } = renderHook(() => useUnitGroupSaveLocation("s1"));

    await waitFor(() => expect(result.current.defaultFolderPath).toBeNull());
  });
});
