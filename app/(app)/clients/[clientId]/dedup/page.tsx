"use client";

import { useParams, useRouter } from "next/navigation";

import DedupUploadPage from "@/components/DedupUploadPage";

export default function DedupHome() {
  const router = useRouter();

  const { clientId } =
    useParams<{ clientId: string }>();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <DedupUploadPage
          onChecked={(sessionId) =>
            router.push(
              `/clients/${clientId}/dedup/${sessionId}`
            )
          }
        />
      </div>
    </main>
  );
}
