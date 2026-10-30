"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import {
  CompanyDetailProvider,
  useCompanyDetail,
} from "@/components/clients/CompanyDetailContext";
import ClientTabs from "@/components/nav/ClientTabs";
import CompanyTabs from "@/components/nav/CompanyTabs";

// The company's detail (name, facilities, ...) is fetched once here and
// shared with every page below. This layout used to wait for the *full*
// client list (`useClients`, `GET /clients`) just to look up the client's
// name before it would mount the detail fetch, so opening a client was a
// serial chain: whoami, then the whole list, then the detail. The name is
// already in the detail, so the list is no longer on this path: the detail
// request starts as soon as the route is known, and the tabs and page
// render at once (each page handles its own loading state, as it always
// did -- it was mounted in the same render as the detail fetch before too).
export default function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { clientId, facilityId } =
    useParams<{ clientId: string; facilityId?: string }>();

  return (
    <CompanyDetailProvider companyId={clientId}>
      <ClientShell clientId={clientId} facilityId={facilityId}>
        {children}
      </ClientShell>
    </CompanyDetailProvider>
  );
}

function ClientShell({
  clientId,
  facilityId,
  children,
}: {
  clientId: string;
  facilityId?: string;
  children: ReactNode;
}) {
  const { company, loadError } = useCompanyDetail();

  if (loadError) {
    return (
      <div className="p-8">
        <p role="alert" className="mb-4 text-slate-300">
          {loadError}
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
        {/* A non-breaking space keeps the title's height while the name loads. */}
        <h1 className="text-2xl font-bold">
          {company?.legal_name ?? " "}
        </h1>
      </div>

      <CompanyTabs clientId={clientId} facilityId={facilityId} />
      <ClientTabs clientId={clientId} facilityId={facilityId} />

      <div>{children}</div>
    </div>
  );
}
