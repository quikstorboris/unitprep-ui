"use client";

import { useParams } from "next/navigation";

import BulkCopyPanel from "@/components/clickup/bulk/BulkCopyPanel";
import { useClickUpAccess } from "@/components/clickup/useClickUpAccess";

/**
 * ClickUp Copy tab -- copy one comment from a task in a source facility's
 * ClickUp list to the counterpart task in several other facilities'
 * lists. See `BulkCopyPanel`.
 */
export default function ClickUpCopyPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const access = useClickUpAccess();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-bold">ClickUp Copy</h1>
        <p className="mb-6 text-sm text-slate-400">
          Copy a comment from a task in one facility&apos;s ClickUp list to the matching task in the client&apos;s
          other facilities.
        </p>

        {access.allowed ? (
          <BulkCopyPanel companyId={clientId} />
        ) : (
          <p className="text-sm text-slate-400">
            You need ClickUp access to use this. Ask an admin to enable it for you.
          </p>
        )}
      </div>
    </main>
  );
}
