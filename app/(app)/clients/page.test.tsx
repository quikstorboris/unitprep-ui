import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listClientsDirectory,
  getClientsFilterOptions,
  archiveCompany,
  unarchiveCompany,
  deleteCompany,
  useRouter,
} = vi.hoisted(() => ({
  listClientsDirectory: vi.fn(),
  getClientsFilterOptions: vi.fn(),
  archiveCompany: vi.fn(),
  unarchiveCompany: vi.fn(),
  deleteCompany: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("@/lib/clientsDirectory", () => ({
  listClientsDirectory,
  getClientsFilterOptions,
}));

vi.mock("@/lib/clientsCompanies", () => ({
  archiveCompany,
  unarchiveCompany,
  deleteCompany,
}));

vi.mock("next/navigation", () => ({
  useRouter,
}));

import ClientsPage from "./page";

function company(overrides: Record<string, unknown> = {}) {
  return {
    id: "company-1",
    legal_name: "Prairie Enterprises LLC",
    created_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    facility_names: ["Highway 20", "Carpentersville"],
    implementation_manager: { id: "im-1", name: "Sarah McDougal" },
    sales_rep: null,
    ...overrides,
  };
}

const emptyFilterOptions = { states: [], previous_pms: [], staff: [] };

describe("ClientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ push: vi.fn() });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    getClientsFilterOptions.mockResolvedValue({ kind: "ok", data: emptyFilterOptions });
    listClientsDirectory.mockResolvedValue({ kind: "ok", data: [] });
  });

  it("shows a loading state before the directory query has resolved", () => {
    listClientsDirectory.mockReturnValue(new Promise(() => {}));

    render(<ClientsPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty state distinct from loading once resolved with no clients", async () => {
    render(<ClientsPage />);

    expect(await screen.findByText(/No clients yet/)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("shows only the legal name on each grid button, grouped under its Implementation Manager, and never the word conductor", async () => {
    listClientsDirectory.mockResolvedValue({
      kind: "ok",
      data: [
        company(),
        company({
          id: "company-2",
          legal_name: "Absolute Management",
          implementation_manager: null,
        }),
      ],
    });

    render(<ClientsPage />);

    expect(await screen.findByText("Prairie Enterprises LLC")).toBeInTheDocument();
    expect(screen.getByText("Implementation Manager: Sarah McDougal")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("Absolute Management")).toBeInTheDocument();

    // Only the company name shows on the button -- no facility names.
    expect(screen.queryByText(/Highway 20/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carpentersville/)).not.toBeInTheDocument();

    expect(document.body.textContent?.toLowerCase()).not.toContain("conductor");
  });

  it("links Add from Process Street to the PS search page", async () => {
    render(<ClientsPage />);
    await screen.findByText(/No clients yet/);

    expect(screen.getByRole("link", { name: "Add from Process Street" })).toHaveAttribute(
      "href",
      "/clients/search"
    );
  });

  it("keeps archived clients out of the main grid, inside a collapsed Archived section", async () => {
    listClientsDirectory.mockResolvedValue({
      kind: "ok",
      data: [
        company(),
        company({ id: "company-2", legal_name: "Absolute Management", archived_at: "2026-08-01T00:00:00Z" }),
      ],
    });

    render(<ClientsPage />);

    await screen.findByText("Prairie Enterprises LLC");
    expect(screen.getByText("Archived (1)")).toBeInTheDocument();
    expect(screen.getByText("Absolute Management")).toBeInTheDocument();

    const details = screen.getByText("Archived (1)").closest("details");
    expect(details).toContainElement(screen.getByText("Absolute Management"));
  });

  it("archives a client from its kebab menu and reloads the directory", async () => {
    listClientsDirectory.mockResolvedValue({ kind: "ok", data: [company()] });
    archiveCompany.mockResolvedValue({ kind: "ok", data: undefined });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await screen.findByText("Prairie Enterprises LLC");

    listClientsDirectory.mockClear();
    await user.click(screen.getByRole("button", { name: "More actions for Prairie Enterprises LLC" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveCompany).toHaveBeenCalledWith("company-1");
    await waitFor(() => expect(listClientsDirectory).toHaveBeenCalled());
  });

  it("unarchives a client from its kebab menu", async () => {
    listClientsDirectory.mockResolvedValue({
      kind: "ok",
      data: [company({ archived_at: "2026-08-01T00:00:00Z" })],
    });
    unarchiveCompany.mockResolvedValue({ kind: "ok", data: undefined });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await user.click(await screen.findByText("Archived (1)"));

    listClientsDirectory.mockClear();
    await user.click(screen.getByRole("button", { name: "More actions for Prairie Enterprises LLC" }));
    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    expect(unarchiveCompany).toHaveBeenCalledWith("company-1");
    await waitFor(() => expect(listClientsDirectory).toHaveBeenCalled());
  });

  it("shows an error and does not reload when archiving fails", async () => {
    listClientsDirectory.mockResolvedValue({ kind: "ok", data: [company()] });
    archiveCompany.mockResolvedValue({ kind: "error", message: "Could not update this client" });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await screen.findByText("Prairie Enterprises LLC");

    listClientsDirectory.mockClear();
    await user.click(screen.getByRole("button", { name: "More actions for Prairie Enterprises LLC" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update this client");
    expect(listClientsDirectory).not.toHaveBeenCalled();
  });

  it("asks for confirmation, then permanently deletes a client and reloads", async () => {
    listClientsDirectory.mockResolvedValue({ kind: "ok", data: [company()] });
    deleteCompany.mockResolvedValue({ kind: "ok", data: undefined });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await screen.findByText("Prairie Enterprises LLC");

    listClientsDirectory.mockClear();
    await user.click(screen.getByRole("button", { name: "More actions for Prairie Enterprises LLC" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Permanently delete "Prairie Enterprises LLC"')
    );
    expect(deleteCompany).toHaveBeenCalledWith("company-1");
    await waitFor(() => expect(listClientsDirectory).toHaveBeenCalled());
  });

  it("does not delete when the confirmation is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    listClientsDirectory.mockResolvedValue({ kind: "ok", data: [company()] });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await screen.findByText("Prairie Enterprises LLC");

    await user.click(screen.getByRole("button", { name: "More actions for Prairie Enterprises LLC" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteCompany).not.toHaveBeenCalled();
  });

  it("does not query below the 3-character search minimum, but does at 3+", async () => {
    render(<ClientsPage />);
    await waitFor(() => expect(listClientsDirectory).toHaveBeenCalledTimes(1));
    listClientsDirectory.mockClear();

    const input = screen.getByPlaceholderText(/Search by facility/);
    const user = userEvent.setup();

    await user.type(input, "ab");
    // The debounce timer firing 400ms later is what settles the state
    // change below the 3-character minimum below into a no-op --
    // `act` here (not a bare `setTimeout`) is what tells React Testing
    // Library that resulting state update belongs to this test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(listClientsDirectory).not.toHaveBeenCalled();

    await user.type(input, "c");
    await waitFor(
      () => expect(listClientsDirectory).toHaveBeenCalledWith(expect.objectContaining({ q: "abc" })),
      { timeout: 1000 }
    );
  });

  it("combines a Previous PMS filter selection into the directory query", async () => {
    getClientsFilterOptions.mockResolvedValue({
      kind: "ok",
      data: { states: [], previous_pms: ["SiteLink"], staff: [] },
    });

    const user = userEvent.setup();
    render(<ClientsPage />);
    await waitFor(() => expect(listClientsDirectory).toHaveBeenCalledTimes(1));
    listClientsDirectory.mockClear();

    const previousPmsLabel = (await screen.findByText("Previous PMS")).closest("label");
    expect(previousPmsLabel).not.toBeNull();
    await user.click(within(previousPmsLabel as HTMLElement).getByRole("button"));
    await user.click(screen.getByRole("checkbox", { name: "SiteLink" }));

    await waitFor(() =>
      expect(listClientsDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ previousPms: ["SiteLink"] })
      )
    );
  });
});
