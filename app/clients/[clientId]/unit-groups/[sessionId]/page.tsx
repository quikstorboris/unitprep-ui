"use client";

import { useParams, useRouter } from "next/navigation";

import ScanResultsPage from "@/components/ScanResultsPage";
import { cancelSession } from "@/lib/api";

export default function ResultsPage() {
  const router = useRouter();

  const { clientId, sessionId } = useParams<{
    clientId: string;
    sessionId: string;
  }>();

  return (
    <main className="p-8">
      <ScanResultsPage
        sessionId={sessionId}
        onBack={() => {
          cancelSession(sessionId);
          router.push(
            `/clients/${clientId}/unit-groups`
          );
        }}
        onExport={(acknowledged) =>
          router.push(
            acknowledged
              ? `/clients/${clientId}/unit-groups/${sessionId}/export?ack=1`
              : `/clients/${clientId}/unit-groups/${sessionId}/export`
          )
        }
      />
    </main>
  );
}
