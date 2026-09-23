import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({
  notifyUnauthorized: vi.fn(),
}));

vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import { trySettingsFetch } from "./integrationSettings";

describe("trySettingsFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("always sends credentials: include and a JSON content type, GET or PUT", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/dropbox/settings`);
    expect(init).toMatchObject({
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(init.body).toBeUndefined();
  });

  it("JSON-encodes the body for a PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await trySettingsFetch(
      "/integrations/dropbox/settings",
      { app_key: "key" },
      "PUT"
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ app_key: "key" });
  });

  it("notifies unauthorized listeners and returns kind: unauthorized on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 })
      )
    );

    const result = await trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");

    expect(notifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });

  it("returns kind: error for a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "boom" }), { status: 500 }))
    );

    const result = await trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");

    expect(result).toEqual({ kind: "error", message: "boom" });
  });

  it("returns kind: ok with the parsed body on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ app_key: "key" }), { status: 200 }))
    );

    const result = await trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");

    expect(result).toEqual({ kind: "ok", data: { app_key: "key" } });
  });

  it("returns kind: error, not a thrown exception, on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await trySettingsFetch("/integrations/dropbox/settings", undefined, "GET");

    expect(result.kind).toBe("error");
  });
});
