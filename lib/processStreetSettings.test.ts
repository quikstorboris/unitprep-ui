import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  TIMEZONE_OPTIONS,
  getProcessStreetSettings,
  updateProcessStreetSettings,
} from "./processStreetSettings";

describe("TIMEZONE_OPTIONS", () => {
  it("is a non-empty, closed list matching the backend's ALLOWED_TIMEZONES", () => {
    expect(TIMEZONE_OPTIONS.length).toBeGreaterThan(0);
    expect(TIMEZONE_OPTIONS.map((tz) => tz.value)).toContain("UTC");
  });
});

describe("getProcessStreetSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("GETs /integrations/process-street/settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schedule_mode: "interval",
          sync_interval_hours: 24,
          sync_time: null,
          sync_timezone: null,
          api_key: "key",
          api_key_source: "database",
          updated_at: "2026-08-01T00:00:00Z",
          updated_by: null,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await getProcessStreetSettings();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/process-street/settings`);
    expect(init.method).toBe("GET");
  });

  it("returns kind: unauthorized on a 401, not a thrown exception", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Sign in required" }), { status: 401 })
      )
    );

    const result = await getProcessStreetSettings();

    expect(result).toEqual({ kind: "unauthorized", message: "Sign in required" });
  });
});

describe("updateProcessStreetSettings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("maps every camelCase field to the backend's snake_case request shape", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateProcessStreetSettings({
      scheduleMode: "daily_time",
      syncIntervalHours: 24,
      syncTime: "03:00",
      syncTimezone: "America/Denver",
      apiKey: "secret-key",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/integrations/process-street/settings`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      schedule_mode: "daily_time",
      sync_interval_hours: 24,
      sync_time: "03:00",
      sync_timezone: "America/Denver",
      api_key: "secret-key",
    });
  });

  it("sends null sync_time/sync_timezone for interval mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateProcessStreetSettings({
      scheduleMode: "interval",
      syncIntervalHours: 6,
      syncTime: null,
      syncTimezone: null,
      apiKey: "secret-key",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.sync_time).toBeNull();
    expect(body.sync_timezone).toBeNull();
  });
});
