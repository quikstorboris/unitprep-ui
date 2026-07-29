import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadBlob, useSessionAction } from "./useSessionAction";

describe("useSessionAction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials: include plus session_id and any extraBody merged in", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSessionAction("s1", "/exclude-group")
    );

    await act(async () => {
      await result.current.run({ group_name: "10x10 Climate" });
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ credentials: "include", method: "POST" });
    expect(JSON.parse(init.body)).toEqual({
      session_id: "s1",
      group_name: "10x10 Climate",
    });
  });

  it.each([404, 401])(
    "resolves sessionExpired for a %i response, not error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status }))
      );

      const { result } = renderHook(() => useSessionAction("s1", "/correct"));

      let outcome;
      await act(async () => {
        outcome = await result.current.run();
      });

      expect(outcome).toEqual({ kind: "sessionExpired" });
      expect(result.current.sessionExpired).toBe(true);
      expect(result.current.error).toBeNull();
    }
  );

  it("resolves an error result for a non-ok, non-401/404 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "boom" }), { status: 500 })
      )
    );

    const { result } = renderHook(() => useSessionAction("s1", "/correct"));

    let outcome;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toMatchObject({ kind: "error" });
    expect(result.current.error).toBeTruthy();
  });

  it("resolves ok and returns the raw response on success", async () => {
    const response = new Response(null, { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const { result } = renderHook(() => useSessionAction("s1", "/correct"));

    let outcome;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({ kind: "ok", response });
  });

  it("resets sessionExpired back to false once a later run succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSessionAction("s1", "/correct"));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.sessionExpired).toBe(true);

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.sessionExpired).toBe(false);
  });

  it("describes an unreachable API server for a network-level fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const { result } = renderHook(() => useSessionAction("s1", "/correct"));

    let outcome;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toMatchObject({ kind: "error" });
    expect(result.current.error).toContain(
      "Could not reach the API server"
    );
  });
});

describe("downloadBlob", () => {
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

  it("uses the filename from Content-Disposition when present", () => {
    downloadBlob(
      new Blob(["data"]),
      'attachment; filename="report.csv"',
      "fallback.csv"
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to fallbackName when Content-Disposition is missing", () => {
    downloadBlob(new Blob(["data"]), null, "fallback.csv");

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the extended filename*= form when present", () => {
    const anchor = document.createElement("a");
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    downloadBlob(
      new Blob(["data"]),
      "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.zip",
      "fallback.csv"
    );

    expect(anchor.download).toBe("résumé.zip");
    createElementSpy.mockRestore();
  });

  it("decodes the extended filename*= form with a non-empty RFC 5987 language tag", () => {
    const anchor = document.createElement("a");
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    downloadBlob(
      new Blob(["data"]),
      "attachment; filename*=UTF-8'en'r%C3%A9sum%C3%A9.zip",
      "fallback.csv"
    );

    expect(anchor.download).toBe("résumé.zip");
    createElementSpy.mockRestore();
  });

  it("prefers the extended filename*= form over the plain form when both are present", () => {
    const anchor = document.createElement("a");
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    downloadBlob(
      new Blob(["data"]),
      'attachment; filename="fallback-ascii.csv"; filename*=UTF-8\'\'r%C3%A9sum%C3%A9.zip',
      "fallback.csv"
    );

    expect(anchor.download).toBe("résumé.zip");
    createElementSpy.mockRestore();
  });

  it("falls back to the plain filename= form when filename*= is malformed", () => {
    const anchor = document.createElement("a");
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    downloadBlob(
      new Blob(["data"]),
      'attachment; filename="report.csv"; filename*=UTF-8\'\'%',
      "fallback.csv"
    );

    expect(anchor.download).toBe("report.csv");
    createElementSpy.mockRestore();
  });
});
