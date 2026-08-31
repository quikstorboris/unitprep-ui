"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import { useClients } from "@/lib/clients";

export default function ClientsPage() {
  const router = useRouter();

  const { clients, createClient } =
    useClients();

  const [name, setName] = useState("");
  // Picked here (not left for the info page alone) specifically to
  // reduce folder-selection ambiguity up front -- still editable
  // afterward on the client's info page via the same picker.
  const [dropboxPath, setDropboxPath] =
    useState("");

  const handleCreate = () => {
    const client = createClient({
      name,
      dropboxPath,
    });

    setName("");
    setDropboxPath("");

    router.push(
      `/clients/${client.id}/info`
    );
  };

  return (
    <main className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-4xl font-bold">
          Clients
        </h1>

        <div className="rounded border border-slate-700 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Start a new onboarding
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
              placeholder="Client name"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <button
              onClick={handleCreate}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500"
            >
              Create Client
            </button>

            <Link
              href="/clients/search"
              className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700"
            >
              Search Process Street
            </Link>

            <button
              disabled
              title="Zoho integration not connected yet"
              className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500 disabled:cursor-not-allowed"
            >
              Pull from Zoho (coming soon)
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-1 text-sm">
            <span className="text-slate-400">
              Dropbox folder (optional here — can
              also be set on the client&apos;s info
              page)
            </span>

            <DropboxFolderPicker
              value={dropboxPath}
              onChange={setDropboxPath}
            />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">
            This session&apos;s clients
          </h2>

          {clients.length === 0 ? (
            <p className="text-sm text-slate-400">
              No clients yet — create one above to
              get started.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {clients.map((client) => (
                <li key={client.id}>
                  <button
                    onClick={() =>
                      router.push(
                        `/clients/${client.id}/info`
                      )
                    }
                    className="w-full rounded border border-slate-700 px-4 py-3 text-left transition-colors hover:bg-slate-800"
                  >
                    <span className="font-medium">
                      {client.name}
                    </span>

                    {client.contactName && (
                      <span className="ml-2 text-sm text-slate-400">
                        {client.contactName}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
