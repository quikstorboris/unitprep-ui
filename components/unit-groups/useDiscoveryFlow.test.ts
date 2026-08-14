import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDiscoveryFlow } from "./useDiscoveryFlow";
import type { DiscoverResponse } from "@/types/api";

function makeFileList(files: File[]): FileList {
  const fileList: Record<string | number, unknown> = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  };

  files.forEach((file, i) => {
    fileList[i] = file;
  });

  return fileList as unknown as FileList;
}

function discoverResponse(overrides: Partial<DiscoverResponse> = {}): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 0,
    group_file_names: [],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [],
    selected_unit_file_names: [],
    requires_unit_file_selection: false,
    requires_format_resolution: false,
    current_unit_file_name: null,
    pending_unit_file_names: [],
    mismatched_header_files: [],
    detected_vendor_name: null,
    confirmed_vendor_name: null,
    source_headers: [],
    suggested_mapping: [],
    canonical_target_fields: [],
    required_target_fields: [],
    ...overrides,
  };
}

function mockFetchByPath(
  handlers: Record<string, () => Response | Promise<Response>>
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- keeps the mock's call-tuple shape matching real fetch(url, init)
  return vi.fn((url: string, _init: RequestInit) => {
    const path = Object.keys(handlers).find((p) => url.includes(p));
    if (!path) {
      throw new Error(`Unexpected fetch to ${url}`);
    }
    return Promise.resolve(handlers[path]());
  });
}

describe("useDiscoveryFlow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects files and clears any previous discovery/uploadSummary/apiError", () => {
    const { result } = renderHook(() => useDiscoveryFlow());
    const files = makeFileList([new File(["a"], "units.csv")]);

    act(() => {
      result.current.handleFileSelection(files);
    });

    expect(result.current.selectedFiles).toBe(files);
    expect(result.current.discovery).toBeNull();
    expect(result.current.uploadSummary).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it("fails fast with a message when no files are selected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.apiError).toBe(
      "Please select a folder before continuing."
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("fails fast when the selected FileList is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(makeFileList([]));
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.apiError).toBe(
      "Please select a folder before continuing."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters out unsupported file extensions before uploading", async () => {
    const fetchMock = mockFetchByPath({
      "/upload": () =>
        new Response(
          JSON.stringify({
            session_id: "s1",
            files_uploaded: 1,
            files_failed: 0,
            multipart_errors: 0,
          }),
          { status: 200 }
        ),
      "/discover": () =>
        new Response(JSON.stringify(discoverResponse()), { status: 200 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([
          new File(["a"], "units.csv"),
          new File(["b"], "readme.txt"),
        ])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    const [, uploadInit] = fetchMock.mock.calls[0];
    const body = uploadInit.body as FormData;
    expect(body.getAll("files")).toHaveLength(1);
    expect(result.current.uploadSummary?.files_selected).toBe(1);
  });

  it("uploads via multipart FormData without a Content-Type header, then discovers", async () => {
    const uploadResponse = {
      session_id: "s1",
      files_uploaded: 1,
      files_failed: 0,
      multipart_errors: 0,
    };
    const discovery = discoverResponse({ unit_files_found: 2 });

    const fetchMock = mockFetchByPath({
      "/upload": () =>
        new Response(JSON.stringify(uploadResponse), { status: 200 }),
      "/discover": () =>
        new Response(JSON.stringify(discovery), { status: 200 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0];
    expect(uploadUrl).toContain("/upload");
    expect(uploadInit.body).toBeInstanceOf(FormData);
    expect(uploadInit.headers).toBeUndefined();

    const [discoverUrl, discoverInit] = fetchMock.mock.calls[1];
    expect(discoverUrl).toContain("/discover");
    expect(JSON.parse(discoverInit.body as string)).toEqual({
      session_id: "s1",
    });

    expect(result.current.sessionId).toBe("s1");
    expect(result.current.discovery).toEqual(discovery);
    expect(result.current.uploadSummary).toEqual({
      files_selected: 1,
      files_uploaded: 1,
      files_failed: 0,
      multipart_errors: 0,
      integrity_verified: true,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.apiError).toBeNull();
  });

  it("stops before calling /discover when the upload integrity check fails", async () => {
    const fetchMock = mockFetchByPath({
      "/upload": () =>
        new Response(
          JSON.stringify({
            session_id: "s1",
            files_uploaded: 0,
            files_failed: 1,
            multipart_errors: 0,
          }),
          { status: 200 }
        ),
      "/discover": () => {
        throw new Error("should not be called");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.uploadSummary?.integrity_verified).toBe(false);
    expect(result.current.discovery).toBeNull();
    expect(result.current.apiError).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets an apiError message when the upload response is not ok", async () => {
    const fetchMock = mockFetchByPath({
      "/upload": () => new Response(null, { status: 500 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.apiError).toBe("HTTP 500");
    expect(result.current.loading).toBe(false);
  });

  it("sets an apiError message when the discover response is not ok", async () => {
    const fetchMock = mockFetchByPath({
      "/upload": () =>
        new Response(
          JSON.stringify({
            session_id: "s1",
            files_uploaded: 1,
            files_failed: 0,
            multipart_errors: 0,
          }),
          { status: 200 }
        ),
      "/discover": () => new Response(null, { status: 404 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.apiError).toBe("HTTP 404");
    expect(result.current.loading).toBe(false);
  });

  it("describes an unreachable API server for a network-level fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.apiError).toContain("Could not reach the API server");
    expect(result.current.loading).toBe(false);
  });

  it("sets loading while the discover flow is in flight", async () => {
    let resolveUpload!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => (resolveUpload = resolve))
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    let discoverPromise!: Promise<void>;
    act(() => {
      discoverPromise = result.current.handleDiscover();
    });

    expect(result.current.loading).toBe(true);

    resolveUpload(new Response(null, { status: 500 }));
    await act(async () => {
      await discoverPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("clears a stale uploadSummary/discovery from a prior run once a retry starts", async () => {
    const uploadResponse = {
      session_id: "s1",
      files_uploaded: 1,
      files_failed: 0,
      multipart_errors: 0,
    };
    const discovery = discoverResponse({ unit_files_found: 2 });

    const fetchMock = mockFetchByPath({
      "/upload": () =>
        new Response(JSON.stringify(uploadResponse), { status: 200 }),
      "/discover": () =>
        new Response(JSON.stringify(discovery), { status: 200 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(result.current.uploadSummary).not.toBeNull();
    expect(result.current.discovery).not.toBeNull();

    // Second attempt: stall the upload response so we can observe state
    // while discover_started has fired but the new pipeline hasn't
    // resolved yet.
    let resolveUpload!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveUpload = resolve))
    );

    let secondCall!: Promise<void>;
    act(() => {
      secondCall = result.current.handleDiscover();
    });

    expect(result.current.uploadSummary).toBeNull();
    expect(result.current.discovery).toBeNull();

    resolveUpload(new Response(null, { status: 500 }));
    await act(async () => {
      await secondCall;
    });
  });

  it("ignores a second concurrent handleDiscover call while one is already in flight", async () => {
    let resolveUpload!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => (resolveUpload = resolve))
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDiscoveryFlow());

    act(() => {
      result.current.handleFileSelection(
        makeFileList([new File(["a"], "units.csv")])
      );
    });

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.handleDiscover();
      secondCall = result.current.handleDiscover();
    });

    resolveUpload(new Response(null, { status: 500 }));
    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    // Only the first call's own /upload request should have fired.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies an externally-updated discovery via handleDiscoveryUpdated", () => {
    const { result } = renderHook(() => useDiscoveryFlow());
    const updated = discoverResponse({ ready: true });

    act(() => {
      result.current.handleDiscoveryUpdated(updated);
    });

    expect(result.current.discovery).toEqual(updated);
    expect(result.current.apiError).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
