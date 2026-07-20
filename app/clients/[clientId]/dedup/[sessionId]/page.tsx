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
        sessionId={sessionId}
        onHome={() => {
          cancelSession(sessionId);
          router.push(`/clients/${clientId}/dedup`);
        }}
      />
    </main>
  );
}
