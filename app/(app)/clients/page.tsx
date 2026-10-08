"use client";

import { useRouter } from "next/navigation";

import Link from "next/link";

import ClientsFilterBar from "@/components/clients/directory/ClientsFilterBar";
import ManagerGroupedGrids from "@/components/clients/directory/ManagerGroupedGrids";
import { useClientsDirectory } from "@/components/clients/directory/useClientsDirectory";
import CompanyDirectoryGrid from "@/components/clients/CompanyDirectoryGrid";
import type { CompanyDirectoryEntry } from "@/lib/clientsDirectory";

export default function ClientsPage() {
  const router = useRouter();
  const directory = useClientsDirectory();
  const { active, archived, inFlight, completed, hydrated } = directory;

  function renderGrid(list: CompanyDirectoryEntry[]) {
    return (
      <CompanyDirectoryGrid
        companies={list}
        pendingId={directory.pendingId}
        onNavigate={(id) => router.push(`/clients/${id}/info`)}
        onArchive={(id) => directory.toggleArchived(id, true)}
        onUnarchive={(id) => directory.toggleArchived(id, false)}
        onDelete={directory.handleDelete}
      />
    );
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Clients</h1>

          <Link
            href="/clients/search"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500"
          >
            Add from Process Street
          </Link>
        </div>

        <ClientsFilterBar filters={directory.filters} />

        {directory.filterOptionsError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {directory.filterOptionsError}
          </p>
        )}

        {directory.loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {directory.loadError}
          </p>
        )}

        {directory.actionError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {directory.actionError}
          </p>
        )}

        {!hydrated ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-400">
            {directory.hasActiveFilter
              ? "No matching clients."
              : "No clients yet — click Create to search Process Street and add one."}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-slate-100">Implementations in Flight</h2>

              {inFlight.length === 0 ? (
                <p className="text-sm text-slate-400">No implementations in flight.</p>
              ) : (
                <ManagerGroupedGrids groups={directory.managerGroups} renderGrid={renderGrid} />
              )}
            </section>

            {completed.length > 0 && (
              <details>
                <summary className="cursor-pointer text-2xl font-semibold text-slate-100 hover:text-white">
                  Completed Implementations ({completed.length})
                </summary>

                <ManagerGroupedGrids
                  groups={directory.completedGroups}
                  renderGrid={renderGrid}
                  className="mt-4"
                />
              </details>
            )}
          </div>
        )}

        {hydrated && archived.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
              Archived ({archived.length})
            </summary>

            <div className="mt-3">
              {renderGrid(archived)}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
