"use client";

import { useParams, useRouter } from "next/navigation";

import DedupUploadPage from "@/components/DedupUploadPage";

export default function DedupHome() {
  const router = useRouter();

  const { clientId, facilityId } =
    useParams<{ clientId: string; facilityId: string }>();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <DedupUploadPage
          clientId={clientId}
          facilityId={facilityId}
          onChecked={(sessionId) =>
            router.push(
              `/clients/${clientId}/facilities/${facilityId}/dedup/${sessionId}`
            )
          }
        />
      </div>
    </main>
  );
}
