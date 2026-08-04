"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import ClientTabs from "@/components/nav/ClientTabs";
import { useClients } from "@/lib/clients";

export default function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { clientId } =
    useParams<{ clientId: string }>();

  const { getClient, hydrated } = useClients();

  const client = getClient(clientId);

  // Before hydration, `clients` is still the empty initial cache — a
  // lookup miss here just means sessionStorage hasn't been read yet, not
  // that the client is actually missing. Wait rather than flashing the
  // "not in session" message on every refresh.
  if (!hydrated) {
    return (
      <div className="p-8 text-slate-400">
        Loading…
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8">
        <p className="mb-4 text-slate-300">
          This client isn&apos;t in the current
          browser session — clients aren&apos;t
          saved yet, so they only exist in the tab
          that created them.
        </p>

        <Link
          href="/clients"
          className="text-blue-400 hover:underline"
        >
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold">
          {client.name}
        </h1>
      </div>

      <ClientTabs clientId={clientId} />

      <div>{children}</div>
    </div>
  );
}
