import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({
  notifyUnauthorized: vi.fn(),
}));

vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import { apiFetch, apiRequest } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiFetch", () => {
  it("sends credentials and nothing else on a plain GET", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await apiFetch("GET", "/clients");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients`);
    expect(init).toEqual({ method: "GET", credentials: "include" });
  });

  it("sends a JSON content type on every non-GET, with or without a body", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await apiFetch("POST", "/auth/logout");
    await apiFetch("DELETE", "/clients/c1");

    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(init.body).toBeUndefined();
    }
  });

  it("JSON-encodes a body, GET included", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));

    await apiFetch("PUT", "/x", { a: 1 });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ a: 1 });
  });

  it("passes an abort signal through", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 200 }));
    const controller = new AbortController();

    await apiFetch("GET", "/x", undefined, { signal: controller.signal });

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe("apiRequest", () => {
  it("returns the parsed body on success", async () => {
    stubFetch(new Response(JSON.stringify({ id: "c1" }), { status: 200 }));

    expect(await apiRequest("GET", "/clients/c1")).toEqual({ kind: "ok", data: { id: "c1" } });
  });

  it("treats a 204 as success with no data", async () => {
    stubFetch(new Response(null, { status: 204 }));

    expect(await apiRequest("POST", "/clients/c1/archive")).toEqual({ kind: "ok", data: undefined });
  });

  it("tells the session-expiry listener about a 401 and keeps the server's message", async () => {
    stubFetch(new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 }));

    const result = await apiRequest("GET", "/clients");

    expect(notifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });

  it("returns the server's message for any other failure", async () => {
    stubFetch(new Response(JSON.stringify({ message: "not found" }), { status: 404 }));

    expect(await apiRequest("GET", "/clients/missing")).toEqual({ kind: "error", message: "not found" });
    expect(notifyUnauthorized).not.toHaveBeenCalled();
  });

  it("never throws: a network failure is an error result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await apiRequest("GET", "/clients");

    expect(result.kind).toBe("error");
  });

  it("reports an aborted request as an error result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted.", "AbortError")),
    );

    const result = await apiRequest("GET", "/clients", undefined, { signal: AbortSignal.abort() });

    expect(result.kind).toBe("error");
  });
});
