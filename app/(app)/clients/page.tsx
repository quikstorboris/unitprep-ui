"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import { useClients } from "@/lib/clients";
import { archiveCompany, unarchiveCompany } from "@/lib/clientsCompanies";

export default function ClientsPage() {
  const router = useRouter();

  const { clients, hydrated, refresh } = useClients();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = clients.filter((client) => !client.archivedAt);
  const archived = clients.filter((client) => client.archivedAt);

  async function toggleArchived(id: string, archive: boolean) {
    setError(null);
    setPendingId(id);

    const result = archive ? await archiveCompany(id) : await unarchiveCompany(id);

    setPendingId(null);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    await refresh();
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Clients</h1>

          <Link
            href="/clients/search"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500"
          >
            Create
          </Link>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {!hydrated ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-400">
            No clients yet — click Create to search Process Street and add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((client) => (
              <li
                key={client.id}
                className="flex items-center gap-3 rounded border border-slate-700 px-4 py-3"
              >
                <button
                  onClick={() => router.push(`/clients/${client.id}/info`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="font-medium">{client.name}</span>

                  {client.facilityNames.length > 0 && (
                    <span className="ml-2 text-sm text-slate-400">
                      {client.facilityNames.join(", ")}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => toggleArchived(client.id, true)}
                  disabled={pendingId === client.id}
                  className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
        )}

        {hydrated && archived.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
              Archived ({archived.length})
            </summary>

            <ul className="mt-3 flex flex-col gap-2">
              {archived.map((client) => (
                <li
                  key={client.id}
                  className="flex items-center gap-3 rounded border border-slate-800 px-4 py-3 text-slate-500"
                >
                  <button
                    onClick={() => router.push(`/clients/${client.id}/info`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-medium">{client.name}</span>

                    {client.facilityNames.length > 0 && (
                      <span className="ml-2 text-sm">{client.facilityNames.join(", ")}</span>
                    )}
                  </button>

                  <button
                    onClick={() => toggleArchived(client.id, false)}
                    disabled={pendingId === client.id}
                    className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Unarchive
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}
