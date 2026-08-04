import { afterEach, describe, expect, it, vi } from "vitest";

import {
  API_URL,
  basename,
  cancelSession,
  describeFetchError,
  errorMessageFrom,
  parentAndBasename,
} from "./api";

describe("basename", () => {
  it("returns the last segment of a forward-slash path", () => {
    expect(basename("Wave 3/Facility A/units.csv")).toBe("units.csv");
  });

  it("returns the last segment of a backslash path", () => {
    expect(basename("Wave 3\\Facility A\\units.csv")).toBe("units.csv");
  });

  it("returns the input unchanged when there is no separator", () => {
    expect(basename("units.csv")).toBe("units.csv");
  });
});

describe("parentAndBasename", () => {
  it("keeps one directory of context", () => {
    expect(parentAndBasename("Wave 3/Facility A/units.csv")).toBe(
      "Facility A/units.csv"
    );
  });

  it("falls back to the bare name when there is no parent segment", () => {
    expect(parentAndBasename("units.csv")).toBe("units.csv");
  });

  it("works with backslash-separated paths", () => {
    expect(parentAndBasename("Wave 3\\Facility A\\units.csv")).toBe(
      "Facility A/units.csv"
    );
  });
});

describe("describeFetchError", () => {
  it("explains a TypeError as an unreachable API server", () => {
    const message = describeFetchError(new TypeError("Failed to fetch"));

    expect(message).toContain(API_URL);
    expect(message).toContain("Could not reach the API server");
  });

  it("returns the message of a non-TypeError Error", () => {
    expect(describeFetchError(new Error("boom"))).toBe("boom");
  });

  it("returns the fallback for a non-Error value", () => {
    expect(describeFetchError("not an error", "fallback message")).toBe(
      "fallback message"
    );
  });

  it("defaults the fallback to Unknown error", () => {
    expect(describeFetchError("not an error")).toBe("Unknown error");
  });
});

describe("errorMessageFrom", () => {
  it("extracts message from a JSON error body", () => {
    const response = new Response(
      JSON.stringify({ error: "bad_request", message: "Name is required" })
    );

    return expect(errorMessageFrom(response)).resolves.toBe(
      "Name is required"
    );
  });

  it("falls back to the raw text when the body is not JSON", () => {
    const response = new Response("Internal Server Error");

    return expect(errorMessageFrom(response)).resolves.toBe(
      "Internal Server Error"
    );
  });

  it("falls back to the status code when the body is empty", async () => {
    const response = new Response("", { status: 503 });

    await expect(errorMessageFrom(response)).resolves.toBe("HTTP 503");
  });

  it("falls back to the raw text when JSON has no message field", async () => {
    const response = new Response(JSON.stringify({ error: "bad_request" }), {
      status: 400,
    });

    await expect(errorMessageFrom(response)).resolves.toBe(
      JSON.stringify({ error: "bad_request" })
    );
  });
});

describe("cancelSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the session id to the cancel endpoint", () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    cancelSession("s1");

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/session/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s1" }),
    });
  });

  it("never throws or leaves an unhandled rejection when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const onUnhandledRejection = vi.fn();
    process.on("unhandledRejection", onUnhandledRejection);

    expect(() => cancelSession("s1")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onUnhandledRejection).not.toHaveBeenCalled();
    process.off("unhandledRejection", onUnhandledRejection);
  });
});
