"use client";

import { useParams, useRouter } from "next/navigation";

import ScanResultsPage from "@/components/ScanResultsPage";
import { cancelSession } from "@/lib/api";

export default function ResultsPage() {
  const router = useRouter();

  const { sessionId } =
    useParams<{ sessionId: string }>();

  return (
    <main className="min-h-screen bg-slate-900 p-8">
      <ScanResultsPage
        sessionId={sessionId}
        onBack={() => {
          cancelSession(sessionId);
          router.push("/");
        }}
        onExport={(acknowledged) =>
          router.push(
            acknowledged
              ? `/export/${sessionId}?ack=1`
              : `/export/${sessionId}`
          )
        }
      />
    </main>
  );
}
