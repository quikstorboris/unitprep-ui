"use client";

import { useParams } from "next/navigation";

import {
  useClients,
  type ClientDraft,
} from "@/lib/clients";

const FIELDS: Array<{
  key: keyof ClientDraft;
  label: string;
}> = [
  { key: "name", label: "Client Name" },
  { key: "contactName", label: "Primary Contact" },
  { key: "contactEmail", label: "Contact Email" },
  { key: "contactPhone", label: "Contact Phone" },
  { key: "signerName", label: "Signer" },
  { key: "bankAccount", label: "Bank Account" },
];

export default function ClientInfoPage() {
  const { clientId } =
    useParams<{ clientId: string }>();

  const { getClient, updateClient } = useClients();

  const client = getClient(clientId);

  // The workspace layout already shows the "not in this session"
  // message for a missing client — nothing to render here in that case.
  if (!client) return null;

  return (
    <main className="p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <section className="rounded border border-slate-700 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Client Details
          </h2>

          <p className="mb-4 text-sm text-slate-400">
            Nothing here is required, and nothing is
            saved beyond this browser tab — there&apos;s
            no backend persistence yet.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label
                key={field.key}
                className="flex flex-col gap-1 text-sm"
              >
                <span className="text-slate-400">
                  {field.label}
                </span>

                <input
                  type="text"
                  value={client[field.key]}
                  onChange={(e) =>
                    updateClient(clientId, {
                      [field.key]: e.target.value,
                    } as ClientDraft)
                  }
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>
            ))}

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-400">
                Address
              </span>

              <textarea
                value={client.address}
                onChange={(e) =>
                  updateClient(clientId, {
                    address: e.target.value,
                  })
                }
                rows={3}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
        </section>

        <section className="rounded border border-slate-700 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Source Files
          </h2>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">
              Dropbox folder path (manual reference
              only, for now)
            </span>

            <input
              type="text"
              value={client.dropboxPath}
              onChange={(e) =>
                updateClient(clientId, {
                  dropboxPath: e.target.value,
                })
              }
              placeholder="e.g. /Clients/Acme Storage/Onboarding"
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500"
            />
          </label>
        </section>

        <section className="rounded border border-slate-800 bg-slate-950/50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-slate-300">
            QMS API Connection
          </h2>

          <p className="text-sm text-slate-500">
            Not yet connected — placeholder for future
            API-based credential setup.
          </p>
        </section>
      </div>
    </main>
  );
}
