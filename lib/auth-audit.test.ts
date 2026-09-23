import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  exportAuditLogsPdf,
  listAuditLogEventTypes,
  listAuditLogs,
  previewAuditLogsExport,
} from "./auth-audit";

describe("listAuditLogs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("hits the bare path with no query string when no filters are given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listAuditLogs();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/audit-logs`);
  });

  it("builds a query string from every filter that is set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listAuditLogs({
      limit: 50,
      beforeId: 100,
      eventType: "role_changed",
      userId: "u1",
    });

    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("limit")).toBe("50");
    expect(params.get("before_id")).toBe("100");
    expect(params.get("event_type")).toBe("role_changed");
    expect(params.get("user_id")).toBe("u1");
  });

  it("omits a filter entirely when it is undefined, rather than sending an empty value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listAuditLogs({ limit: 10 });

    const [url] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.has("event_type")).toBe(false);
  });
});

describe("listAuditLogEventTypes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GETs /auth/audit-logs/event-types", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ event_types: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listAuditLogEventTypes();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/auth/audit-logs/event-types`);
    expect(init.method).toBe("GET");
  });
});

describe("previewAuditLogsExport / exportAuditLogsPdf request shape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("converts a plain date range to UTC day bounds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [], truncated: false }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await previewAuditLogsExport({ dateFrom: "2026-08-01", dateTo: "2026-08-05" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.date_from).toBe("2026-08-01T00:00:00Z");
    expect(body.date_to).toBe("2026-08-05T23:59:59Z");
  });

  it("defaults eventTypes/userIds to empty arrays and drops an empty ipAddress", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [], truncated: false }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await previewAuditLogsExport({ dateFrom: "2026-08-01", dateTo: "2026-08-05", ipAddress: "" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.event_types).toEqual([]);
    expect(body.user_ids).toEqual([]);
    expect(body.ip_address).toBeUndefined();
  });

  it("preview hits the preview path, export hits the export path, same filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("%PDF-1.4", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const filters = { dateFrom: "2026-08-01", dateTo: "2026-08-05" };
    await previewAuditLogsExport(filters);
    await exportAuditLogsPdf(filters);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/auth/audit-logs/export/preview`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_URL}/auth/audit-logs/export`);
  });

  it("exportAuditLogsPdf returns the raw response for a blob download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("%PDF-1.4", { status: 200 }))
    );

    const result = await exportAuditLogsPdf({ dateFrom: "2026-08-01", dateTo: "2026-08-05" });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.response.status).toBe(200);
    }
  });
});
