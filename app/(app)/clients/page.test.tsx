import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useClients, archiveCompany, unarchiveCompany, useRouter } = vi.hoisted(() => ({
  useClients: vi.fn(),
  archiveCompany: vi.fn(),
  unarchiveCompany: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("@/lib/clients", () => ({
  useClients,
}));

vi.mock("@/lib/clientsCompanies", () => ({
  archiveCompany,
  unarchiveCompany,
}));

vi.mock("next/navigation", () => ({
  useRouter,
}));

import ClientsPage from "./page";

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "company-1",
    name: "Prairie Enterprises LLC",
    facilityNames: ["Highway 20", "Carpentersville"],
    archivedAt: null,
    dropboxPath: undefined,
    ...overrides,
  };
}

describe("ClientsPage", () => {
  const refresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useRouter.mockReturnValue({ push: vi.fn() });
    refresh.mockResolvedValue(undefined);
  });

  it("shows a loading state before the client list has hydrated", () => {
    useClients.mockReturnValue({ clients: [], hydrated: false, refresh });

    render(<ClientsPage />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty state distinct from loading once hydrated with no clients", () => {
    useClients.mockReturnValue({ clients: [], hydrated: true, refresh });

    render(<ClientsPage />);

    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByText(/No clients yet/)).toBeInTheDocument();
  });

  it("lists active clients with their facility names, and links Create to the PS search page", () => {
    useClients.mockReturnValue({ clients: [client()], hydrated: true, refresh });

    render(<ClientsPage />);

    expect(screen.getByText("Prairie Enterprises LLC")).toBeInTheDocument();
    expect(screen.getByText("Highway 20, Carpentersville")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute("href", "/clients/search");
  });

  it("keeps archived clients out of the main list, inside a collapsed Archived section", () => {
    useClients.mockReturnValue({
      clients: [client(), client({ id: "company-2", name: "Absolute Management", archivedAt: "2026-08-01T00:00:00Z" })],
      hydrated: true,
      refresh,
    });

    render(<ClientsPage />);

    // Main list shows only the active client.
    const mainListItem = screen.getByText("Prairie Enterprises LLC").closest("li");
    expect(mainListItem).not.toBeNull();

    // The archived one is present but under a <details> disclosure, not
    // the main list.
    expect(screen.getByText("Archived (1)")).toBeInTheDocument();
    expect(screen.getByText("Absolute Management")).toBeInTheDocument();
    const details = screen.getByText("Archived (1)").closest("details");
    expect(details).toContainElement(screen.getByText("Absolute Management"));
  });

  it("archives a client and refreshes the list", async () => {
    archiveCompany.mockResolvedValue({ kind: "ok", data: undefined });
    useClients.mockReturnValue({ clients: [client()], hydrated: true, refresh });

    const user = userEvent.setup();
    render(<ClientsPage />);

    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveCompany).toHaveBeenCalledWith("company-1");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("unarchives a client and refreshes the list", async () => {
    unarchiveCompany.mockResolvedValue({ kind: "ok", data: undefined });
    useClients.mockReturnValue({
      clients: [client({ archivedAt: "2026-08-01T00:00:00Z" })],
      hydrated: true,
      refresh,
    });

    const user = userEvent.setup();
    render(<ClientsPage />);

    await user.click(screen.getByText("Archived (1)"));
    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    expect(unarchiveCompany).toHaveBeenCalledWith("company-1");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows an error and does not refresh when archiving fails", async () => {
    archiveCompany.mockResolvedValue({ kind: "error", message: "Could not update this client" });
    useClients.mockReturnValue({ clients: [client()], hydrated: true, refresh });

    const user = userEvent.setup();
    render(<ClientsPage />);

    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update this client");
    expect(refresh).not.toHaveBeenCalled();
  });
});
