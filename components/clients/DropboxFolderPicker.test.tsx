import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDropboxFolder, searchDropboxFolders } = vi.hoisted(() => ({
  listDropboxFolder: vi.fn(),
  searchDropboxFolders: vi.fn(),
}));

vi.mock("@/lib/dropbox", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dropbox")>("@/lib/dropbox");
  return { ...actual, listDropboxFolder, searchDropboxFolders };
});

import { DropboxFolderPicker } from "./DropboxFolderPicker";

const ROOT = "/QMS Onboarding";

function folder(name: string, parent = ROOT) {
  return { name, path_display: `${parent}/${name}`, is_folder: true };
}
function file(name: string, parent = ROOT) {
  return { name, path_display: `${parent}/${name}`, is_folder: false };
}

/** Answers a listing by path; the root answers when no path is given. */
function mockListing(tree: Record<string, ReturnType<typeof folder>[]>) {
  listDropboxFolder.mockImplementation(async (path?: string) => {
    const resolved = path ?? ROOT;
    if (!(resolved in tree)) return { kind: "error", message: `no such folder ${resolved}` };
    return { kind: "ok", data: { path: resolved, entries: tree[resolved] } };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DropboxFolderPicker", () => {
  it("shows the current value read-only until Browse is opened", () => {
    render(<DropboxFolderPicker value="/QMS Onboarding/Acme" onChange={vi.fn()} />);
    expect(screen.getByText("/QMS Onboarding/Acme")).toBeInTheDocument();
    expect(listDropboxFolder).not.toHaveBeenCalled();
  });

  it("browses from initialPath when there is no value, and commits a row's Select", async () => {
    mockListing({ [`${ROOT}/Acme`]: [folder("Highway 20", `${ROOT}/Acme`)] });
    const onChange = vi.fn();
    render(<DropboxFolderPicker value="" onChange={onChange} initialPath={`${ROOT}/Acme`} />);

    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    expect(await screen.findByText("📁 Highway 20")).toBeInTheDocument();
    expect(listDropboxFolder).toHaveBeenCalledWith(`${ROOT}/Acme`, false, expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(onChange).toHaveBeenCalledWith(`${ROOT}/Acme/Highway 20`);
    expect(screen.getByRole("button", { name: "Browse…" })).toBeInTheDocument();
  });

  it("commits the open folder with Select this folder, and Up goes to the parent", async () => {
    mockListing({
      [ROOT]: [folder("Acme")],
      [`${ROOT}/Acme`]: [],
    });
    const onChange = vi.fn();
    render(<DropboxFolderPicker value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    await userEvent.click(await screen.findByText("📁 Acme"));
    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "↑ Up" }));
    expect(await screen.findByText("📁 Acme")).toBeInTheDocument();
    expect(listDropboxFolder).toHaveBeenLastCalledWith(ROOT, false, expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Select this folder" }));
    expect(onChange).toHaveBeenCalledWith(ROOT);
  });

  it("file mode starts in the file's folder and commits a clicked file", async () => {
    mockListing({ [`${ROOT}/Acme`]: [file("a.csv", `${ROOT}/Acme`), folder("sub", `${ROOT}/Acme`)] });
    const onChange = vi.fn();
    render(<DropboxFolderPicker value={`${ROOT}/Acme/old.csv`} onChange={onChange} mode="select-file" />);

    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    await userEvent.click(await screen.findByText("📄 a.csv"));

    expect(listDropboxFolder).toHaveBeenCalledWith(`${ROOT}/Acme`, true, expect.anything());
    expect(onChange).toHaveBeenCalledWith(`${ROOT}/Acme/a.csv`);
    // No folder-commit controls in file mode.
    expect(screen.queryByRole("button", { name: "Select this folder" })).not.toBeInTheDocument();
  });

  it("showFiles in folder mode lists files as plain labels with a reference-only hint", async () => {
    mockListing({ [ROOT]: [file("notes.txt")] });
    render(<DropboxFolderPicker value="" onChange={vi.fn()} showFiles />);

    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /notes\.txt/ })).not.toBeInTheDocument();
    expect(screen.getByText(/shown for reference only/)).toBeInTheDocument();
  });

  it("shows a listing error", async () => {
    mockListing({});
    render(<DropboxFolderPicker value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    expect(await screen.findByText(`no such folder ${ROOT}`)).toBeInTheDocument();
  });

  it("searches after two characters, shows root-relative breadcrumbs, and navigates to a hit", async () => {
    mockListing({
      [ROOT]: [folder("Acme")],
      [`${ROOT}/Acme/Highway 20`]: [],
    });
    searchDropboxFolders.mockResolvedValue({
      kind: "ok",
      data: { entries: [{ name: "Highway 20", path_display: `${ROOT}/Acme/Highway 20`, is_folder: true }] },
    });
    render(<DropboxFolderPicker value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    await screen.findByText("📁 Acme");

    const box = screen.getByPlaceholderText("Search folders…");
    await userEvent.type(box, "h");
    expect(searchDropboxFolders).not.toHaveBeenCalled();
    await userEvent.type(box, "i");

    const hit = await screen.findByRole("button", { name: /Acme.*Highway 20/ });
    expect(searchDropboxFolders).toHaveBeenCalledWith("hi", expect.anything());
    // Up and "Select this folder" are disabled while a search is showing.
    expect(screen.getByRole("button", { name: "↑ Up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select this folder" })).toBeDisabled();

    await userEvent.click(hit);
    await waitFor(() =>
      expect(listDropboxFolder).toHaveBeenLastCalledWith(`${ROOT}/Acme/Highway 20`, false, expect.anything())
    );
    expect(box).toHaveValue("");
    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
  });

  it("shows a search error and 'No matching folders' for an empty result", async () => {
    mockListing({ [ROOT]: [] });
    searchDropboxFolders.mockResolvedValueOnce({ kind: "ok", data: { entries: [] } });
    render(<DropboxFolderPicker value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    await screen.findByText("This folder is empty.");

    await userEvent.type(screen.getByPlaceholderText("Search folders…"), "zz");
    await waitFor(() => expect(searchDropboxFolders).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("No matching folders.")).toBeInTheDocument();

    searchDropboxFolders.mockResolvedValueOnce({ kind: "error", message: "search failed" });
    await userEvent.type(screen.getByPlaceholderText("Search folders…"), "z");
    expect(await screen.findByText("search failed")).toBeInTheDocument();
  });

  it("Cancel closes without committing", async () => {
    mockListing({ [ROOT]: [] });
    const onChange = vi.fn();
    render(<DropboxFolderPicker value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Browse…" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Browse…" })).toBeInTheDocument();
  });
});
