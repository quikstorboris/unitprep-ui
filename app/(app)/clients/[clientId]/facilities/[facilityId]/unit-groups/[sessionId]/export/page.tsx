"use client";

import { useParams, useRouter } from "next/navigation";

import ExportCompletePage from "@/components/ExportCompletePage";
import { cancelSession } from "@/lib/api";

export default function ExportPage() {
  const router = useRouter();

  const { clientId, facilityId, sessionId } = useParams<{
    clientId: string;
    facilityId: string;
    sessionId: string;
  }>();

  return (
    <main className="p-8">
      <ExportCompletePage
        // A new sessionId means a new export flow — force a full remount
        // so this page's local exporting/downloadComplete/error state
        // can't leak from a session this page previously rendered.
        key={sessionId}
        sessionId={sessionId}
        clientId={clientId}
        onBack={() =>
          router.push(
            `/clients/${clientId}/facilities/${facilityId}/unit-groups/${sessionId}`
          )
        }
        onHome={() => {
          cancelSession(sessionId);
          router.replace(
            `/clients/${clientId}/facilities/${facilityId}`
          );
        }}
      />
    </main>
  );
}
