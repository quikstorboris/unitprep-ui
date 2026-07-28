import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Client,
  ClientsProvider as ClientsProviderType,
  useClients as useClientsType,
} from "./clients";

async function freshClientsModule() {
  vi.resetModules();
  const mod = await import("./clients");
  return mod as {
    ClientsProvider: typeof ClientsProviderType;
    useClients: typeof useClientsType;
  };
}

describe("useClients / ClientsProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("starts unhydrated and flips to hydrated after mount", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
  });

  it("creates a client with an auto-generated id and defaults", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient({ name: "Acme Storage" });
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Acme Storage");
    expect(created.contactName).toBe("");
    expect(created.contactEmail).toBe("");
    expect(created.contactPhone).toBe("");
    expect(created.signerName).toBe("");
    expect(created.bankAccount).toBe("");
    expect(created.address).toBe("");
    expect(created.dropboxPath).toBe("");
    expect(typeof created.createdAt).toBe("number");
  });

  it("trims a provided name", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient({ name: "  Acme Storage  " });
    });

    expect(created.name).toBe("Acme Storage");
  });

  it('falls back to "Untitled Client" when no name is given', async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient();
    });

    expect(created.name).toBe("Untitled Client");
  });

  it('falls back to "Untitled Client" when the name is only whitespace', async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient({ name: "   " });
    });

    expect(created.name).toBe("Untitled Client");
  });

  it("updates a client by id, leaving other fields untouched", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient({ name: "Acme Storage" });
    });
    act(() => {
      result.current.updateClient(created.id, { contactEmail: "a@b.com" });
    });

    expect(result.current.getClient(created.id)?.contactEmail).toBe(
      "a@b.com"
    );
    expect(result.current.getClient(created.id)?.name).toBe("Acme Storage");
  });

  it("looks up a client by id and returns undefined for an unknown id", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: Client;
    act(() => {
      created = result.current.createClient({ name: "Acme Storage" });
    });

    expect(result.current.getClient(created.id)?.name).toBe("Acme Storage");
    expect(result.current.getClient("nonexistent-id")).toBeUndefined();
  });

  it("persists created clients to sessionStorage under the clients key", async () => {
    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.createClient({ name: "Acme Storage" });
    });

    const raw = sessionStorage.getItem("unitprep:clients");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw as string);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Acme Storage");
  });

  it("loads clients already present in sessionStorage on mount", async () => {
    const seeded = [
      {
        id: "seed-1",
        name: "Seeded Client",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        signerName: "",
        bankAccount: "",
        address: "",
        dropboxPath: "",
        createdAt: 123,
      },
    ];
    sessionStorage.setItem("unitprep:clients", JSON.stringify(seeded));

    const { useClients, ClientsProvider } = await freshClientsModule();

    const { result } = renderHook(() => useClients(), {
      wrapper: ClientsProvider,
    });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.getClient("seed-1")?.name).toBe("Seeded Client");
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
