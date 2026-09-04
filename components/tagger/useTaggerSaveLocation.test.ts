import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTaggerSaveLocation } from "./useTaggerSaveLocation";

describe("useTaggerSaveLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /tagger/save-location with credentials: include", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ default_folder_path: null }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useTaggerSaveLocation("s1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tagger/save-location");
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
  });

  it("resolves the Tagged Templates subfolder for a Dropbox-imported session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            default_folder_path: "/qms onboarding/prairie enterprises llc/highway 20/templates/Tagged Templates",
          }),
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useTaggerSaveLocation("s1"));

    await waitFor(() =>
      expect(result.current.defaultFolderPath).toBe(
        "/qms onboarding/prairie enterprises llc/highway 20/templates/Tagged Templates"
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

    const { result } = renderHook(() => useTaggerSaveLocation("s1"));

    await waitFor(() => expect(result.current.defaultFolderPath).toBeNull());
  });
});
