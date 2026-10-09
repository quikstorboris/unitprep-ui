import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({ notifyUnauthorized: vi.fn() }));
vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import { getRunUpdateTasks, postRunUpdate } from "./clickupRunUpdate";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lib/clickupRunUpdate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("looks tasks up by session, encoding the session id", async () => {
    const fetchMock = stubFetch({ candidates: [] });
    await getRunUpdateTasks("co", "fa", "a b/c");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_URL}/clients/co/facilities/fa/clickup/run-tasks?session_id=a%20b%2Fc`
    );
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("posts only the session and the confirmed task", async () => {
    const fetchMock = stubFetch({ task_name: "t" });
    await postRunUpdate("co", "fa", "se", "c1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/co/facilities/fa/clickup/run-results`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ session_id: "se", task_id: "c1" });
  });

  it("surfaces the server's message on a refusal", async () => {
    stubFetch({ error: "facility_not_linked_to_clickup", message: "Link this facility first." }, 409);
    const result = await getRunUpdateTasks("co", "fa", "se");

    expect(result).toEqual({ kind: "error", message: "Link this facility first." });
  });
});
