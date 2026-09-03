"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { listCompanies, type CompanySummary } from "@/lib/clientsCompanies";

// Real, backend-driven client registry (2026-09-01) -- replaces the
// original sessionStorage-only stub, whose own doc comment always
// anticipated this: "no backend entity exists yet... a client only
// becomes real backend state once persistence is designed." That
// design now exists (Process Street-sourced `clients.companies`), so
// this module fetches from it instead of sessionStorage. Every
// consumer (`ClientLayout`, `ClientTabs`, `DedupUploadPage`,
// `DedupResultsPage`, ...) only ever used `clients`/`getClient`/
// `hydrated` for display/routing, never the storage mechanism itself,
// so this swap needed no changes anywhere else.
//
// Same `useSyncExternalStore` shape as before, for the same reason:
// getSnapshot/getServerSnapshot must be pure reads of `cache` (see the
// git history on this file for the original, more detailed rationale)
// -- the actual fetch happens once, in the effect below, via this
// module's own `commit()`, the supported "sync from an external
// system" pattern.

export interface Client {
  id: string;
  /** The company's `legal_name` -- kept as `name` so every existing
   * consumer (`client.name` in `ClientLayout`, etc.) needed no changes. */
  name: string;
  facilityNames: string[];
  archivedAt: string | null;
  /**
   * Always `undefined` for now -- real Dropbox-root connection is a
   * Company-page feature that isn't built yet (per Boris, 2026-09-01:
   * lives directly on the client page, not its own tab). Kept as a
   * field so `DedupUploadPage`/`DedupResultsPage`'s existing
   * `client?.dropboxPath` usage needed no changes; remove this comment
   * once that feature ships and this is a real value.
   */
  dropboxPath: string | undefined;
}

function toClient(summary: CompanySummary): Client {
  return {
    id: summary.id,
    name: summary.legal_name,
    facilityNames: summary.facility_names,
    archivedAt: summary.archived_at,
    dropboxPath: undefined,
  };
}

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: Client[] = [];
// Whether the initial fetch has resolved (success OR failure) -- exposed
// as its own external-store snapshot so consumers can tell "haven't
// checked the backend yet" apart from "checked, and this client
// genuinely isn't in it". A failed fetch still flips this to true with
// an empty cache; there's no separate error surface here, matching the
// simplicity of what this replaced.
let loaded = false;
let fetchStarted = false;

function commit(next: Client[]) {
  cache = next;
  listeners.forEach((listener) => listener());
}

async function loadFromBackend() {
  if (fetchStarted) return;
  fetchStarted = true;

  const result = await listCompanies();
  if (result.kind === "ok") {
    commit(result.data.map(toClient));
  }

  loaded = true;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Client[] {
  return cache;
}

function getServerSnapshot(): Client[] {
  return cache;
}

function getLoadedSnapshot(): boolean {
  return loaded;
}

function getLoadedServerSnapshot(): boolean {
  return false;
}

interface ClientsContextValue {
  clients: Client[];
  // False for the one render before the initial fetch resolves.
  // Consumers should treat a lookup miss while this is false as "don't
  // know yet", not "this client doesn't exist".
  hydrated: boolean;
  getClient: (id: string) => Client | undefined;
  /** Re-fetches the list -- call after archiving/unarchiving or
   * creating a client so the UI reflects the new state immediately. */
  refresh: () => Promise<void>;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

// Mounted exactly once, wrapping everything in app/layout.tsx (the App
// Router's single root layout) -- by construction, every route in this app
// renders underneath that one instance, so the module-level `cache`/
// `listeners`/`loaded` state above is only ever driven by one provider.
// If that ever changes -- a second ClientsProvider mounted somewhere else
// (a nested layout, a test rendering it twice, a future refactor) -- it
// would silently share this same module state with the root one rather
// than getting its own, which would surprise whoever does that. Keep this
// mounted in exactly one place; if a second mount ever becomes necessary,
// this module needs a real per-instance store, not just a comment.
export function ClientsProvider({ children }: { children: ReactNode }) {
  const clients = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribe, getLoadedSnapshot, getLoadedServerSnapshot);

  useEffect(() => {
    loadFromBackend();
  }, []);

  const value: ClientsContextValue = {
    clients,
    hydrated,
    getClient: (id) => clients.find((c) => c.id === id),
    refresh: () => {
      fetchStarted = false;
      return loadFromBackend();
    },
  };

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients(): ClientsContextValue {
  const ctx = useContext(ClientsContext);

  if (!ctx) {
    throw new Error("useClients must be used within a ClientsProvider");
  }

  return ctx;
}
