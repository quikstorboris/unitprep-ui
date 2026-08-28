"use client";

import { useParams, useRouter } from "next/navigation";

import DedupResultsPage from "@/components/DedupResultsPage";
import { cancelSession } from "@/lib/api";

export default function DedupResultsRoute() {
  const router = useRouter();

  const { clientId, sessionId } = useParams<{
    clientId: string;
    sessionId: string;
  }>();

  return (
    <main className="p-8">
      <DedupResultsPage
        // A new sessionId means a new dedup report — force a full
        // remount so this page's local fetch/export state can't leak
        // from a session this page previously rendered.
        key={sessionId}
        clientId={clientId}
        sessionId={sessionId}
        onHome={() => {
          cancelSession(sessionId);
          router.replace(`/clients/${clientId}/info`);
        }}
      />
    </main>
  );
}
