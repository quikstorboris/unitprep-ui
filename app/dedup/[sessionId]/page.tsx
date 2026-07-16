"use client";

import { useParams, useRouter } from "next/navigation";

import DedupResultsPage from "@/components/DedupResultsPage";
import { cancelSession } from "@/lib/api";

export default function DedupResultsRoute() {
  const router = useRouter();

  const { sessionId } =
    useParams<{ sessionId: string }>();

  return (
    <main className="min-h-screen bg-slate-900 p-8">
      <DedupResultsPage
        sessionId={sessionId}
        onHome={() => {
          cancelSession(sessionId);
          router.push("/dedup");
        }}
      />
    </main>
  );
}
