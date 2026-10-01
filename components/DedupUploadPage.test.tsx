import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { folderResponse, requirementsResponse } from "@/components/dedup/dedupTestData";
import { MockXMLHttpRequest } from "@/lib/testUtils/MockXMLHttpRequest";

import DedupUploadPage from "./DedupUploadPage";

vi.mock("@/components/dedup/useFacilityDropboxFolder", () => ({
  useFacilityDropboxFolder: () => ({
    client: undefined,
    facilityNames: [],
    selectedFacility: null,
    facilityDropboxPath: null,
    selectFacility: vi.fn(),
  }),
}));

vi.mock("@/components/clients/DropboxFolderPicker", () => ({
  DropboxFolderPicker: ({ onChange }: { onChange: (path: string) => void }) => (
    <button type="button" onClick={() => onChange("/QMS/Facility")}>
      pick dropbox folder
    </button>
  ),
}));

const CHECK_RESPONSE = {
  session_id: "s-1",
  report: {
    total_rows: 1,
    unique_tenants: 1,
    multi_unit_tenants: 0,
    flagged_groups: [],
    typo_variant_candidates: [],
    related_tenant_candidates: [],
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function localFile(name: string, text: string) {
  return new File([text], name);
}

describe("DedupUploadPage", () => {
  const onChecked = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChecked.mockReset();
    fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/dedup/file-requirements")) return json(requirementsResponse());
      if (url.endsWith("/dedup/classify-files")) return json(folderResponse());
      if (url.endsWith("/dedup/classify-dropbox-folder")) {
        const response = folderResponse();
        response.files.forEach((f) => (f.path = `/QMS/Facility/${f.file_name}`));
        return json(response);
      }
      if (url.endsWith("/dedup/import-dropbox")) return json(CHECK_RESPONSE);
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    MockXMLHttpRequest.reset();
  });

  const renderPage = () =>
    render(<DedupUploadPage clientId="c1" facilityId="f1" onChecked={onChecked} />);

  const pickLocalFiles = (files: File[]) =>
    fireEvent.change(document.getElementById("dedup-folder-picker")!, { target: { files } });

  const bodyOf = (endpoint: string) => {
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith(endpoint));
    return JSON.parse(call![1].body as string);
  };

  it("shows the requirements panel before any folder is chosen", async () => {
    renderPage();

    expect(
      screen.getByRole("region", { name: "Files required for deduplication" })
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("QSX"));
    expect(screen.getByRole("button", { name: "Run Check" })).toBeDisabled();
  });

  it("sniffs headers locally, sends only names and headers, and pre-selects the suggestion", async () => {
    renderPage();

    pickLocalFiles([
      localFile("Directory.xlsx", "ignored"),
      localFile("Directory.csv", "Tenant,Phone\nSECRET-SSN,555"),
      localFile("readme.txt", "x"),
    ]);

    expect(await screen.findByRole("checkbox", { name: "Directory.xlsx" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "notes.csv" })).not.toBeChecked();

    const body = bodyOf("/dedup/classify-files");
    expect(body.files).toEqual([
      { file_name: "Directory.xlsx", headers: null },
      { file_name: "Directory.csv", headers: ["Tenant", "Phone"] },
    ]);
    expect(JSON.stringify(body)).not.toContain("SECRET-SSN");

    // The scan's detected PMS now drives the requirements panel.
    expect(screen.getByRole("combobox")).toHaveValue("SiteLink");
  });

  it("only offers a folder's own files, not nested subfolders", async () => {
    renderPage();

    const top = localFile("Directory.csv", "A,B");
    const nested = localFile("Deep.csv", "A,B");
    Object.defineProperty(top, "webkitRelativePath", { value: "Folder/Directory.csv" });
    Object.defineProperty(nested, "webkitRelativePath", { value: "Folder/Sub/Deep.csv" });
    pickLocalFiles([top, nested]);

    await screen.findByRole("checkbox", { name: "Directory.xlsx" });
    expect(bodyOf("/dedup/classify-files").files.map((f: { file_name: string }) => f.file_name)).toEqual([
      "Directory.csv",
    ]);
  });

  it("gates Run Check on the confirmation, then uploads one file part per checked file", async () => {
    renderPage();
    pickLocalFiles([localFile("Directory.xlsx", "x"), localFile("Directory.csv", "A,B")]);

    const run = screen.getByRole("button", { name: "Run Check" });
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });
    expect(run).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /These files are correct: SiteLink Directory/ }));
    expect(run).toBeEnabled();

    fireEvent.click(run);

    const xhr = MockXMLHttpRequest.latest();
    expect(xhr.url).toContain("/dedup/check?facility_id=f1");
    const parts = (xhr.sentBody as FormData).getAll("file") as File[];
    expect(parts.map((f) => f.name)).toEqual(["Directory.xlsx"]);

    await act(async () => {
      xhr.respond(200, JSON.stringify(CHECK_RESPONSE));
    });
    await waitFor(() => expect(onChecked).toHaveBeenCalledWith("s-1"));
  });

  it("withdraws the confirmation when the ticked set changes", async () => {
    renderPage();
    pickLocalFiles([localFile("Directory.xlsx", "x"), localFile("Directory.csv", "A,B")]);
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });

    fireEvent.click(screen.getByRole("checkbox", { name: /These files are correct/ }));
    expect(screen.getByRole("button", { name: "Run Check" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Directory.csv" }));
    expect(screen.getByRole("button", { name: "Run Check" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /These files are correct/ })).not.toBeChecked();
  });

  it("blocks Run with a clear message when an unrecognized or supporting file is ticked", async () => {
    renderPage();
    pickLocalFiles([localFile("Directory.xlsx", "x"), localFile("notes.csv", "A")]);
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });

    fireEvent.click(screen.getByRole("checkbox", { name: "notes.csv" }));
    expect(screen.getByText(/"notes.csv" is not a dedup file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Check" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "notes.csv" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Ledgers.csv" }));
    expect(screen.getByText(/"Ledgers.csv" is a supporting file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Check" })).toBeDisabled();
  });

  it("Select none disables Run and Select all ticks every row", async () => {
    renderPage();
    pickLocalFiles([localFile("Directory.xlsx", "x")]);
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });

    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(screen.getByText("Tick at least one file to run the check.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Check" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText(/5 of 5 file\(s\) selected/)).toBeInTheDocument();
  });

  it("classifies a Dropbox folder server-side and imports the ticked paths", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "pick dropbox folder" }));
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });

    expect(bodyOf("/dedup/classify-dropbox-folder")).toEqual({ path: "/QMS/Facility" });

    fireEvent.click(screen.getByRole("checkbox", { name: /These files are correct/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledWith("s-1"));
    expect(bodyOf("/dedup/import-dropbox")).toEqual({
      paths: ["/QMS/Facility/Directory.xlsx"],
      facility_id: "f1",
    });
  });

  it("shows the server's message when classification fails", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/dedup/file-requirements")
        ? json(requirementsResponse())
        : json({ error: "bad", message: "Folder not readable" }, 400)
    );
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "pick dropbox folder" }));

    expect(await screen.findByText(/Folder not readable/)).toBeInTheDocument();
  });

  it("shows the server's message when the check itself fails", async () => {
    renderPage();
    pickLocalFiles([localFile("Directory.xlsx", "x")]);
    await screen.findByRole("checkbox", { name: "Directory.xlsx" });

    fireEvent.click(screen.getByRole("checkbox", { name: /These files are correct/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run Check" }));
    await act(async () => {
      MockXMLHttpRequest.latest().respond(400, JSON.stringify({ error: "x", message: "Mixed vendors" }));
    });

    expect(await screen.findByText(/Mixed vendors/)).toBeInTheDocument();
    expect(onChecked).not.toHaveBeenCalled();
  });
});
