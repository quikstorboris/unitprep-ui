import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import { getTaskRoles, normalizeTaskNames, updateTaskRole } from "./processStreetTaskRoles";

describe("normalizeTaskNames", () => {
  it("trims, drops blanks, and dedupes case-insensitively keeping the first spelling", () => {
    expect(
      normalizeTaskNames(["  Document Credentials ", "", "document credentials", "Add Credentials to QMS"])
    ).toEqual(["Document Credentials", "Add Credentials to QMS"]);
  });
});

describe("task role requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GETs /integrations/process-street/task-roles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ roles: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTaskRoles();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/process-street/task-roles`);
    expect(init.method).toBe("GET");
    expect(result).toEqual({ kind: "ok", data: { roles: [] } });
  });

  it("PUTs the whole name list to the role's own path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateTaskRole("qms_credentials", ["Document Credentials", "Add Credentials to QMS"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/process-street/task-roles/qms_credentials`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      task_names: ["Document Credentials", "Add Credentials to QMS"],
    });
  });

  it("surfaces the server's message on a refused save", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "At least one task name is required." }), {
            status: 400,
          })
        )
    );

    const result = await updateTaskRole("qms_credentials", []);

    expect(result).toEqual({ kind: "error", message: "At least one task name is required." });
  });
});
