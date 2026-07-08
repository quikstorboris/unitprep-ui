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

  const { sessionId } =
    useParams<{ sessionId: string }>();

  const acknowledgeErrors =
    useSearchParams().get("ack") ===
    "1";

  return (
    <main className="min-h-screen bg-slate-900 p-8">
      <ExportCompletePage
        sessionId={sessionId}
        acknowledgeErrors={
          acknowledgeErrors
        }
        onHome={() => {
          cancelSession(sessionId);
          router.push("/");
        }}
      />
    </main>
  );
}
