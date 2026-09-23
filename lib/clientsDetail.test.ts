import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  addFacilityPerson,
  deleteToolRun,
  editFacilityPerson,
  getCompanyDetail,
  getCompanyOnboardingSummary,
  getFacilityDetail,
  getFacilityElavon,
  getFacilityPeople,
  getFacilityPolicies,
  linkFacilityElavon,
  listFacilityToolRuns,
  resyncElavonData,
  toolRunOutputUrl,
  toolRunSourceUrl,
  unlinkFacilityElavon,
  unlinkFacilityPerson,
  updateFacilityDropboxFolder,
  updateFacilityFees,
  updateFacilitySpecials,
} from "./clientsDetail";

function ok(body: unknown = {}) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function noContent() {
  return new Response(null, { status: 204 });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("company/facility reads", () => {
  it("getCompanyDetail GETs /clients/{companyId}", async () => {
    const fetchMock = stubFetch(ok());
    await getCompanyDetail("c1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1`);
  });

  it("getCompanyOnboardingSummary GETs the onboarding-summary sub-path", async () => {
    const fetchMock = stubFetch(ok());
    await getCompanyOnboardingSummary("c1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/onboarding-summary`);
  });

  it("getFacilityDetail GETs the nested facility path", async () => {
    const fetchMock = stubFetch(ok());
    await getFacilityDetail("c1", "f1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/facilities/f1`);
  });

  it("getFacilityPolicies GETs the policies sub-path", async () => {
    const fetchMock = stubFetch(ok());
    await getFacilityPolicies("c1", "f1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/facilities/f1/policies`);
  });
});

describe("policy writes", () => {
  it("updateFacilityFees PUTs the fees wrapped in { fees }", async () => {
    const fetchMock = stubFetch(noContent());
    await updateFacilityFees("c1", "f1", [{ fee_type: "admin", label: null, raw_value: "$25" }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/policies/fees`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      fees: [{ fee_type: "admin", label: null, raw_value: "$25" }],
    });
  });

  it("updateFacilitySpecials renames its argument to raw_text", async () => {
    const fetchMock = stubFetch(noContent());
    await updateFacilitySpecials("c1", "f1", "10% off first month");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ raw_text: "10% off first month" });
  });
});

describe("Elavon", () => {
  it("getFacilityElavon GETs the elavon sub-path", async () => {
    const fetchMock = stubFetch(ok());
    await getFacilityElavon("c1", "f1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/facilities/f1/elavon`);
  });

  it("linkFacilityElavon POSTs the run id", async () => {
    const fetchMock = stubFetch(noContent());
    await linkFacilityElavon("c1", "f1", "run-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/elavon/link`);
    expect(JSON.parse(init.body)).toEqual({ merchant_account_run_id: "run-1" });
  });

  it("unlinkFacilityElavon sends a DELETE to the link path", async () => {
    const fetchMock = stubFetch(noContent());
    await unlinkFacilityElavon("c1", "f1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/elavon/link`);
    expect(init.method).toBe("DELETE");
  });

  it("resyncElavonData POSTs to the resync path with no body", async () => {
    const fetchMock = stubFetch(noContent());
    await resyncElavonData("c1", "f1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/elavon/resync`);
    expect(init.method).toBe("POST");
  });
});

describe("facility people", () => {
  it("getFacilityPeople GETs the people sub-path", async () => {
    const fetchMock = stubFetch(ok());
    await getFacilityPeople("c1", "f1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/clients/c1/facilities/f1/people`);
  });

  it("addFacilityPerson spreads the assignment and appends source", async () => {
    const fetchMock = stubFetch(noContent());
    await addFacilityPerson(
      "c1",
      "f1",
      { full_name: "Irene Chen", email: null, phone: "301-787-9221", role: "manager" },
      "manual"
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      full_name: "Irene Chen",
      email: null,
      phone: "301-787-9221",
      role: "manager",
      source: "manual",
    });
  });

  it("editFacilityPerson renames old role and protect flag into snake_case", async () => {
    const fetchMock = stubFetch(noContent());
    await editFacilityPerson(
      "c1",
      "f1",
      "p1",
      "manager",
      { full_name: "Irene Chen", email: "irene@example.com", phone: null, role: "owner" },
      true
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/people/p1`);
    expect(JSON.parse(init.body)).toEqual({
      old_role: "manager",
      full_name: "Irene Chen",
      email: "irene@example.com",
      phone: null,
      role: "owner",
      protect_from_resync: true,
    });
  });

  it("unlinkFacilityPerson sends the role as a URL-encoded query param", async () => {
    const fetchMock = stubFetch(noContent());
    await unlinkFacilityPerson("c1", "f1", "p1", "site manager");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/people/p1?role=site%20manager`);
    expect(init.method).toBe("DELETE");
  });
});

describe("tool runs", () => {
  it("listFacilityToolRuns always includes tool, adds limit/beforeId only when given", async () => {
    const fetchMock = stubFetch(ok({ runs: [] }));
    await listFacilityToolRuns("c1", "f1", { tool: "dedup" });

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get("tool")).toBe("dedup");
    expect(params.has("limit")).toBe(false);
    expect(params.has("before_id")).toBe(false);
  });

  it("listFacilityToolRuns includes limit and before_id when given", async () => {
    const fetchMock = stubFetch(ok({ runs: [] }));
    await listFacilityToolRuns("c1", "f1", { tool: "dedup", limit: 20, beforeId: "run-9" });

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get("limit")).toBe("20");
    expect(params.get("before_id")).toBe("run-9");
  });

  it("deleteToolRun sends a DELETE to the specific run", async () => {
    const fetchMock = stubFetch(noContent());
    await deleteToolRun("c1", "f1", "run-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/tool-runs/run-1`);
    expect(init.method).toBe("DELETE");
  });

  it("toolRunOutputUrl/toolRunSourceUrl build the expected relative paths", () => {
    expect(toolRunOutputUrl("c1", "f1", "run-1")).toBe(
      "/clients/c1/facilities/f1/tool-runs/run-1/output"
    );
    expect(toolRunSourceUrl("c1", "f1", "run-1")).toBe(
      "/clients/c1/facilities/f1/tool-runs/run-1/source"
    );
  });
});

describe("updateFacilityDropboxFolder", () => {
  it("PUTs the folder url, which may be null to clear it", async () => {
    const fetchMock = stubFetch(noContent());
    await updateFacilityDropboxFolder("c1", "f1", null);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/clients/c1/facilities/f1/dropbox-folder`);
    expect(JSON.parse(init.body)).toEqual({ dropbox_folder_url: null });
  });
});
