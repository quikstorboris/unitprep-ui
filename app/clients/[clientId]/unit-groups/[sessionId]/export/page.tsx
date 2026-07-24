"use client";

import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import ExportCompletePage from "@/components/ExportCompletePage";
import { cancelSession } from "@/lib/api";

export default function ExportPage() {
  const router = useRouter();

  const { clientId, sessionId } = useParams<{
    clientId: string;
    sessionId: string;
  }>();

  const acknowledgeErrors =
    useSearchParams().get("ack") ===
    "1";

  return (
    <main className="p-8">
      <ExportCompletePage
        sessionId={sessionId}
        acknowledgeErrors={
          acknowledgeErrors
        }
        onBack={() =>
          router.push(
            `/clients/${clientId}/unit-groups/${sessionId}`
          )
        }
        onHome={() => {
          cancelSession(sessionId);
          router.replace(
            `/clients/${clientId}/info`
          );
        }}
      />
    </main>
  );
}
