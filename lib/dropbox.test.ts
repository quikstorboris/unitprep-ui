import { afterEach, describe, expect, it, vi } from "vitest";

import { API_URL } from "@/lib/api";
import {
  dropboxFolderWebUrl,
  dropboxParentFolder,
  getFacilityDropboxFolder,
  listDropboxFolder,
  searchDropboxFolders,
} from "./dropbox";

describe("dropboxParentFolder", () => {
  it("drops the last path segment", () => {
    expect(dropboxParentFolder("/QS Fileserver/Shared/QMS Onboarding/Highway 20")).toBe(
      "/QS Fileserver/Shared/QMS Onboarding"
    );
  });

  it("returns the input unchanged when there is no slash", () => {
    expect(dropboxParentFolder("Highway 20")).toBe("Highway 20");
  });
});

describe("dropboxFolderWebUrl", () => {
  it("builds a Dropbox home deep link with each segment encoded", () => {
    expect(dropboxFolderWebUrl("/QMS Onboarding/Highway 20")).toBe(
      "https://www.dropbox.com/home/QMS%20Onboarding/Highway%2020"
    );
  });

  it("drops empty segments from a leading/trailing slash", () => {
    expect(dropboxFolderWebUrl("/Highway 20/")).toBe(
      "https://www.dropbox.com/home/Highway%2020"
    );
  });
});

describe("listDropboxFolder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("hits /dropbox/list with no query string for the configured root", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ path: "/", entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listDropboxFolder();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/dropbox/list`);
  });

  it("passes path and include_files when given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ path: "/x", entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listDropboxFolder("/QMS Onboarding", true);

    const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(params.get("path")).toBe("/QMS Onboarding");
    expect(params.get("include_files")).toBe("true");
  });

  it("omits include_files entirely when false, not include_files=false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ path: "/", entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await listDropboxFolder(undefined, false);

    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.has("include_files")).toBe(false);
  });
});

describe("searchDropboxFolders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("short-circuits without a network call for a query under 2 characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchDropboxFolders("h");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "ok", data: { entries: [] } });
  });

  it("short-circuits for a query that is only whitespace", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await searchDropboxFolders("  ");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("URL-encodes and trims the query for a real search", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await searchDropboxFolders("  Highway & 20  ");

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_URL}/dropbox/search?q=Highway%20%26%2020`
    );
  });
});

describe("getFacilityDropboxFolder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("looks up by company id and URL-encoded facility name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ path: null }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getFacilityDropboxFolder("c1", "Highway 20");

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_URL}/clients/c1/dropbox-folder?facility_name=Highway%2020`
    );
  });
});
