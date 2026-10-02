import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({ notifyUnauthorized: vi.fn() }));
vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import {
  getClickUpConnection,
  removeClickUpToken,
  saveClickUpToken,
  testClickUpConnection,
} from "./clickup";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lib/clickup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reads the connection with GET and credentials, sending no body", async () => {
    const fetchMock = stubFetch({ status: "not_connected" });

    await getClickUpConnection();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/connection`);
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
    expect(init.body).toBeUndefined();
  });

  it("saves a token with PUT and the token in the body", async () => {
    const fetchMock = stubFetch({ status: "connected" });

    await saveClickUpToken("pk_abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/token`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ token: "pk_abc" });
  });

  it("tests the connection with POST", async () => {
    const fetchMock = stubFetch({ status: "connected" });

    await testClickUpConnection();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/test`);
    expect(init.method).toBe("POST");
  });

  it("removes the token with DELETE", async () => {
    const fetchMock = stubFetch({ status: "not_connected" });

    await removeClickUpToken();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/token`);
    expect(init.method).toBe("DELETE");
  });

  it("surfaces the server's message when ClickUp rejects the token", async () => {
    stubFetch({ error: "invalid_clickup_token", message: "ClickUp rejected this token." }, 400);

    const result = await saveClickUpToken("pk_bad");

    expect(result).toEqual({ kind: "error", message: "ClickUp rejected this token." });
  });
});
