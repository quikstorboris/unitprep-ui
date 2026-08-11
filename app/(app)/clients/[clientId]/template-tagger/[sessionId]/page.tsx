"use client";

import { useParams, useRouter } from "next/navigation";

import TaggerResultsPage from "@/components/TaggerResultsPage";
import { cancelSession } from "@/lib/api";

export default function TemplateTaggerResultsRoute() {
  const router = useRouter();

  const { clientId, sessionId } = useParams<{
    clientId: string;
    sessionId: string;
  }>();

  return (
    <main className="p-8">
      <TaggerResultsPage
        // A new sessionId means a new tagger session -- force a full
        // remount so this page's local fetch/review state can't leak
        // from a session this page previously rendered.
        key={sessionId}
        sessionId={sessionId}
        onHome={() => {
          cancelSession(sessionId);
          router.replace(`/clients/${clientId}/info`);
        }}
      />
    </main>
  );
}
