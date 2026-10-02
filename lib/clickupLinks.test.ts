import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";

const { notifyUnauthorized } = vi.hoisted(() => ({ notifyUnauthorized: vi.fn() }));
vi.mock("@/lib/sessionExpiry", () => ({ notifyUnauthorized }));

import {
  getClickUpSuggestions,
  listClickUpLists,
  resolveClickUpUrl,
  saveClickUpLinks,
  unlinkCompanyClickUp,
  unlinkFacilityClickUp,
} from "./clickupLinks";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lib/clickupLinks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads the list catalog with GET", async () => {
    const fetchMock = stubFetch({ lists: [] });
    await listClickUpLists();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/lists`);
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("resolves a pasted URL with POST and the url in the body", async () => {
    const fetchMock = stubFetch({ list_id: "1" });
    await resolveClickUpUrl("https://app.clickup.com/1/v/li/2");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/clickup/resolve-url`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ url: "https://app.clickup.com/1/v/li/2" });
  });

  it("surfaces the server's explanation for a refused URL", async () => {
    stubFetch({ error: "invalid_clickup_url", message: "That ClickUp link is not a list." }, 400);

    const result = await resolveClickUpUrl("https://app.clickup.com/1/v/o/f/2");

    expect(result).toEqual({ kind: "error", message: "That ClickUp link is not a list." });
  });

  it("reads a company's suggestions", async () => {
    const fetchMock = stubFetch({ facilities: [] });
    await getClickUpSuggestions("c1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/clickup/suggestions`);
  });

  it("saves links with PUT and the whole batch", async () => {
    const fetchMock = stubFetch({ linked: 1, shared_lists: [] });
    await saveClickUpLinks("c1", [{ facility_id: "f1", list_id: "100" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/clickup/links`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ links: [{ facility_id: "f1", list_id: "100" }] });
  });

  it("unlinks one facility and a whole company with DELETE", async () => {
    const fetchMock = stubFetch({ unlinked: 1 });

    await unlinkFacilityClickUp("c1", "f1");
    await unlinkCompanyClickUp("c1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/facilities/f1/clickup-link`);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/clients/c1/clickup/links`);
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
  });
});
