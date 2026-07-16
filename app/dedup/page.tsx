"use client";

import { useRouter } from "next/navigation";

import DedupUploadPage from "@/components/DedupUploadPage";

export default function DedupHome() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-900 p-8">
      <div className="mx-auto max-w-4xl text-slate-100">
        <DedupUploadPage
          onChecked={(sessionId) =>
            router.push(
              `/dedup/${sessionId}`
            )
          }
        />
      </div>
    </main>
  );
}
