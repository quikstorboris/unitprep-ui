import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({
  notifyUnauthorized: vi.fn(),
}));

vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import {
  authFetch,
  fetchForDownload,
  parseAuthResult,
  tryAuthFetch,
} from "./auth-shared";

describe("authFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("always sends credentials: include and a JSON content type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/auth/logout");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/logout`);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("JSON-encodes a body when one is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/auth/login/begin", { email: "ada@example.com" });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: "ada@example.com" });
  });

  it("sends no body at all when none is given, not an empty string", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/auth/logout");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it("respects an explicit method", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/auth/users", undefined, "GET");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
  });
});

describe("parseAuthResult", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("notifies unauthorized listeners and returns kind: unauthorized on a 401", async () => {
    const response = new Response(
      JSON.stringify({ error: "unauthorized", message: "Sign in required" }),
      { status: 401 }
    );

    const result = await parseAuthResult(response);

    expect(notifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "unauthorized",
      message: "Sign in required",
    });
  });

  it("returns kind: error without notifying on a non-401 failure", async () => {
    const response = new Response(
      JSON.stringify({ error: "internal_error", message: "boom" }),
      { status: 500 }
    );

    const result = await parseAuthResult(response);

    expect(notifyUnauthorized).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "error", message: "boom" });
  });

  it("returns kind: ok with the parsed body on success", async () => {
    const response = new Response(JSON.stringify({ user_id: "u1" }), {
      status: 200,
    });

    const result = await parseAuthResult<{ user_id: string }>(response);

    expect(result).toEqual({ kind: "ok", data: { user_id: "u1" } });
  });
});

describe("tryAuthFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns kind: ok for a successful round trip", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
    );

    const result = await tryAuthFetch<{ success: boolean }>("/auth/logout");

    expect(result).toEqual({ kind: "ok", data: { success: true } });
  });

  it("returns kind: error, not a thrown exception, when the network call rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const result = await tryAuthFetch("/auth/logout");

    expect(result.kind).toBe("error");
  });
});

describe("fetchForDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("notifies unauthorized listeners and returns kind: unauthorized on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), {
          status: 401,
        })
      )
    );

    const result = await fetchForDownload("/auth/audit-logs/export");

    expect(notifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "unauthorized",
      message: "Sign in required",
    });
  });

  it("returns kind: error for a non-401 failure without consuming the body as JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 }))
    );

    const result = await fetchForDownload("/auth/audit-logs/export");

    expect(result).toEqual({ kind: "error", message: "boom" });
  });

  it("returns kind: ok with the raw response on success, unparsed", async () => {
    const body = new Blob(["%PDF-1.4"]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    );

    const result = await fetchForDownload("/auth/audit-logs/export");

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.response.status).toBe(200);
    }
  });

  it("returns kind: error, not a thrown exception, when the network call rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const result = await fetchForDownload("/auth/audit-logs/export");

    expect(result.kind).toBe("error");
  });
});
