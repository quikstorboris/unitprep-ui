import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Client,
  ClientsProvider as ClientsProviderType,
  useClients as useClientsType,
} from "./clients";
import type { CompanySummary } from "./clientsCompanies";

const { listCompanies } = vi.hoisted(() => ({
  listCompanies: vi.fn(),
}));

vi.mock("@/lib/clientsCompanies", () => ({
  listCompanies,
}));

async function freshClientsModule() {
  vi.resetModules();
  const mod = await import("./clients");
  return mod as {
    ClientsProvider: typeof ClientsProviderType;
    useClients: typeof useClientsType;
  };
}

function summary(overrides: Partial<CompanySummary> = {}): CompanySummary {
  return {
    id: "company-1",
    legal_name: "Prairie Enterprises LLC",
    created_at: "2026-08-28T12:00:00Z",
    archived_at: null,
    facility_names: ["Highway 20", "Carpentersville"],
    ...overrides,
  };
}

describe("useClients / ClientsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts unhydrated and flips to hydrated once the backend fetch resolves", async () => {
    listCompanies.mockResolvedValue({ kind: "ok", data: [] });
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });

    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
  });

  it("maps a real company summary to a Client, keeping legal_name as .name for existing consumers", async () => {
    listCompanies.mockResolvedValue({ kind: "ok", data: [summary()] });
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const client = result.current.getClient("company-1") as Client;
    expect(client.name).toBe("Prairie Enterprises LLC");
    expect(client.facilityNames).toEqual(["Highway 20", "Carpentersville"]);
    expect(client.archivedAt).toBeNull();
  });

  it("returns undefined for an unknown id", async () => {
    listCompanies.mockResolvedValue({ kind: "ok", data: [summary()] });
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.getClient("nonexistent-id")).toBeUndefined();
  });

  // A failed fetch must not leave the page stuck on a loading state
  // forever -- `hydrated` still flips to true, just with an empty list,
  // the same "checked, and it's not there" semantics a real 404 would
  // produce for a single lookup.
  it("still flips to hydrated (with an empty list) when the backend fetch fails", async () => {
    listCompanies.mockResolvedValue({ kind: "error", message: "boom" });
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.clients).toEqual([]);
  });

  it("refresh() re-fetches from the backend", async () => {
    listCompanies.mockResolvedValueOnce({ kind: "ok", data: [] });
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.clients).toHaveLength(0);

    listCompanies.mockResolvedValueOnce({ kind: "ok", data: [summary()] });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.clients).toHaveLength(1);
    expect(listCompanies).toHaveBeenCalledTimes(2);
  });

  it("throws when useClients is used outside a ClientsProvider", async () => {
    const { useClients } = await freshClientsModule();

    const { result } = renderHook(() => {
      try {
        return useClients();
      } catch (error) {
        return error;
      }
    });

    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toContain(
      "useClients must be used within a ClientsProvider"
    );
  });
});
