import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  KNOWN_STEP_UP_ACTIONS,
  getAuthConfiguration,
  updateAuthConfiguration,
} from "./auth-config";

describe("KNOWN_STEP_UP_ACTIONS", () => {
  it("matches the backend's single known step-up action, add_passkey", () => {
    expect(KNOWN_STEP_UP_ACTIONS).toEqual([
      { value: "add_passkey", label: expect.any(String) },
    ]);
  });
});

describe("getAuthConfiguration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GETs /auth/configuration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ step_up_actions: [], updated_at: "2026-08-01T00:00:00Z", updated_by: null }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await getAuthConfiguration();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/configuration`);
    expect(init.method).toBe("GET");
  });

  it("returns kind: unauthorized on a 401, not a thrown exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 })
      )
    );

    const result = await getAuthConfiguration();

    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });
});

describe("updateAuthConfiguration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("PUTs the step-up actions to /auth/configuration", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ step_up_actions: ["add_passkey"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateAuthConfiguration(["add_passkey"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/configuration`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ step_up_actions: ["add_passkey"] });
  });

  it("can clear every step-up action with an empty array", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ step_up_actions: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateAuthConfiguration([]);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ step_up_actions: [] });
  });
});
