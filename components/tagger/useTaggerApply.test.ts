import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfirmedSubstitution } from "@/types/api";

import { useTaggerApply } from "./useTaggerApply";

function confirmed(): ConfirmedSubstitution[] {
  return [{ candidate_index: 0, tag_key: "TENANT_NAME" }];
}

describe("useTaggerApply", () => {
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

  it("posts to /tagger/apply with confirmed and preserve_blanks merged into the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["docx"]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaggerApply("s1"));

    await act(async () => {
      await result.current.handleApply(confirmed(), true);
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tagger/apply");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "s1",
      confirmed: confirmed(),
      preserve_blanks: true,
    });
  });

  it("triggers a download and sets downloadComplete on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Blob(["docx"]), { status: 200 }))
    );

    const { result } = renderHook(() => useTaggerApply("s1"));

    expect(result.current.downloadComplete).toBe(false);

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.current.downloadComplete).toBe(true);
    expect(result.current.applying).toBe(false);
  });

  it("falls back to tagged.docx when Content-Disposition is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Blob(["docx"]), { status: 200 }))
    );

    const { result } = renderHook(() => useTaggerApply("s1"));

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });

    expect(clickedFilenames).toEqual(["tagged.docx"]);
  });

  it("uses the filename from Content-Disposition when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Blob(["docx"]), {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="custom.docx"' },
        })
      )
    );

    const { result } = renderHook(() => useTaggerApply("s1"));

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });

    expect(clickedFilenames).toEqual(["custom.docx"]);
  });

  it.each([404, 401])(
    "sets sessionExpired for a %i response without downloading",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

      const { result } = renderHook(() => useTaggerApply("s1"));

      await act(async () => {
        await result.current.handleApply(confirmed(), false);
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
        new Response(JSON.stringify({ message: "tagger apply failed" }), {
          status: 500,
        })
      )
    );

    const { result } = renderHook(() => useTaggerApply("s1"));

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });

    expect(result.current.error).toBe("tagger apply failed");
    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.current.downloadComplete).toBe(false);
  });

  it("clears a stale downloadComplete from a prior success once a new attempt fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Blob(["docx"]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "tagger apply failed" }), {
          status: 500,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaggerApply("s1"));

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });
    expect(result.current.downloadComplete).toBe(true);

    await act(async () => {
      await result.current.handleApply(confirmed(), false);
    });

    expect(result.current.downloadComplete).toBe(false);
    expect(result.current.error).toBe("tagger apply failed");
  });

  it("ignores a second concurrent handleApply call while one is already in flight", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaggerApply("s1"));

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.handleApply(confirmed(), false);
      secondCall = result.current.handleApply(confirmed(), false);
    });

    resolveFetch(new Response(new Blob(["docx"]), { status: 200 }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
