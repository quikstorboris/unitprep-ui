"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// Frontend-only client registry — no backend entity exists yet (see the
// platform vision: a "client" only becomes real backend state once
// persistence is designed). sessionStorage (not localStorage) is
// deliberate: it's scoped per browser tab, so working on two different
// clients in two tabs doesn't collide, and it evaporates exactly as
// non-durably as everything else in this app does today.
//
// Backed by useSyncExternalStore (module-level cache + listener set)
// rather than useState+useEffect holding the data directly. getSnapshot/
// getServerSnapshot must be pure, side-effect-free reads of `cache` —
// they run during render (sometimes more than once per commit), so
// reading sessionStorage lazily from inside one of them mutates `cache`
// mid-render and makes the two getters disagree depending on call
// order, which is exactly what trips React's "getServerSnapshot should
// be cached" warning. The actual sessionStorage read happens once, in
// the effect below, well after mount — an effect calling this module's
// own commit() (not a useState setter) is the supported "sync from an
// external system" case, not the "setState in effect" antipattern.
const STORAGE_KEY = "unitprep:clients";

export interface Client {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  signerName: string;
  bankAccount: string;
  address: string;
  dropboxPath: string;
  createdAt: number;
}

export type ClientDraft = Partial<
  Omit<Client, "id" | "createdAt">
>;

const BLANK_DRAFT: Required<ClientDraft> = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  signerName: "",
  bankAccount: "",
  address: "",
  dropboxPath: "",
};

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: Client[] = [];
let hydratedFromStorage = false;
// Whether `hydrateFromStorage` below has run — exposed as its own
// external-store snapshot (see `getHydratedSnapshot`) so consumers can
// tell "haven't checked sessionStorage yet" apart from "checked, and
// this client genuinely isn't in it".
let hydrated = false;

function commit(next: Client[]) {
  cache = next;

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Storage blocked/full — keep working in-memory for this tab.
    }
  }

  listeners.forEach((listener) => listener());
}

// Runs once, after mount — folds whatever this tab already saved into
// the store via the normal commit() path, same as any other update.
function hydrateFromStorage() {
  if (hydratedFromStorage) return;

  hydratedFromStorage = true;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (raw) {
      cache = JSON.parse(raw) as Client[];
    }
  } catch {
    // Corrupted/blocked storage — keep the empty in-memory default.
  }

  // Always flip `hydrated` and notify, even when there was nothing to
  // load — subscribers need to know the check happened either way.
  hydrated = true;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Both getters are plain reads of `cache` — no lazy loading, no
// branching, nothing that could make them disagree depending on call
// order. See the module-level comment above for why that matters.
function getSnapshot(): Client[] {
  return cache;
}

function getServerSnapshot(): Client[] {
  return cache;
}

function getHydratedSnapshot(): boolean {
  return hydrated;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

function createClientRecord(
  draft: ClientDraft = {}
): Client {
  const merged = {
    ...BLANK_DRAFT,
    ...draft,
  };

  const client: Client = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...merged,
    name: merged.name.trim() || "Untitled Client",
  };

  commit([...cache, client]);

  return client;
}

function updateClientRecord(
  id: string,
  patch: ClientDraft
) {
  commit(
    cache.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    )
  );
}

interface ClientsContextValue {
  clients: Client[];
  // False for the one render before the hydration effect below runs.
  // Consumers should treat a lookup miss while this is false as "don't
  // know yet", not "this client doesn't exist" — sessionStorage hasn't
  // been read yet, so `clients` is still the empty initial cache.
  hydrated: boolean;
  getClient: (id: string) => Client | undefined;
  createClient: (draft?: ClientDraft) => Client;
  updateClient: (id: string, patch: ClientDraft) => void;
}

const ClientsContext =
  createContext<ClientsContextValue | null>(null);

export function ClientsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const clients = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getHydratedServerSnapshot
  );

  useEffect(() => {
    hydrateFromStorage();
  }, []);

  const value: ClientsContextValue = {
    clients,
    hydrated,
    getClient: (id) =>
      clients.find((c) => c.id === id),
    createClient: createClientRecord,
    updateClient: updateClientRecord,
  };

  return (
    <ClientsContext.Provider value={value}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);

  if (!ctx) {
    throw new Error(
      "useClients must be used within a ClientsProvider"
    );
  }

  return ctx;
}
