import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({
  notifyUnauthorized: vi.fn(),
}));

vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import { clientsDelete, clientsGet, clientsPost, clientsPut } from "./clientsApi";

describe("clientsGet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("requests credentials: include against the given path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "c1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await clientsGet("/clients/c1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1`);
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
    expect(result).toEqual({ kind: "ok", data: { id: "c1" } });
  });

  it("notifies unauthorized listeners and returns kind: unauthorized on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 })
      )
    );

    const result = await clientsGet("/clients/c1");

    expect(notifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });

  it("returns kind: error for a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "not found" }), { status: 404 }))
    );

    const result = await clientsGet("/clients/missing");

    expect(result).toEqual({ kind: "error", message: "not found" });
  });

  it("returns kind: error, not a thrown exception, on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await clientsGet("/clients/c1");

    expect(result.kind).toBe("error");
  });
});

describe("clientsPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends no body/content-type at all when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await clientsPost("/clients/c1/facilities/f1/elavon/resync");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it("JSON-encodes a body when one is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await clientsPost("/clients/c1/manual-link", { facility_id: "f1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ facility_id: "f1" });
  });

  it("treats a 204 as ok with no body to parse", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await clientsPost("/clients/c1/archive");

    expect(result).toEqual({ kind: "ok", data: undefined });
  });
});

describe("clientsPut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("always sends a JSON body and content-type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await clientsPut("/clients/c1/facilities/f1/policies/fees", { fees: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/policies/fees`);
    expect(init).toMatchObject({ method: "PUT", credentials: "include" });
    expect(JSON.parse(init.body)).toEqual({ fees: [] });
  });
});

describe("clientsDelete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends a DELETE with credentials: include and no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await clientsDelete("/clients/c1/facilities/f1/elavon/link");

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: "DELETE", credentials: "include" });
    expect(init.body).toBeUndefined();
  });
});
