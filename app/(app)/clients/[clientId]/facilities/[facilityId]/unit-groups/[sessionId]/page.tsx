"use client";

import { useParams, useRouter } from "next/navigation";

import ScanResultsPage from "@/components/ScanResultsPage";
import { cancelSession } from "@/lib/api";

export default function ResultsPage() {
  const router = useRouter();

  const { clientId, facilityId, sessionId } = useParams<{
    clientId: string;
    facilityId: string;
    sessionId: string;
  }>();

  return (
    <main className="p-8">
      <ScanResultsPage
        // A new sessionId means a brand-new scan — force a full remount
        // so this page's local exclude/acknowledge/warning-total state
        // (see ScanResultsPage's own state) can't leak from a session
        // this page previously rendered. Same fix as DiscoveryPage's.
        key={sessionId}
        sessionId={sessionId}
        onBack={() => {
          cancelSession(sessionId);
          router.push(
            `/clients/${clientId}/facilities/${facilityId}/unit-groups`
          );
        }}
        onExport={() =>
          router.push(
            `/clients/${clientId}/facilities/${facilityId}/unit-groups/${sessionId}/export`
          )
        }
        onSessionExpired={() =>
          router.replace(
            `/clients/${clientId}/facilities/${facilityId}`
          )
        }
      />
    </main>
  );
}
