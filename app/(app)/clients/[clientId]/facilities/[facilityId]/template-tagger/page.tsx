"use client";

import { useParams, useRouter } from "next/navigation";

import TaggerUploadPage from "@/components/TaggerUploadPage";

export default function TemplateTaggerHome() {
  const router = useRouter();

  const { clientId, facilityId } = useParams<{ clientId: string; facilityId: string }>();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <TaggerUploadPage
          clientId={clientId}
          onChecked={(sessionId) =>
            router.push(`/clients/${clientId}/facilities/${facilityId}/template-tagger/${sessionId}`)
          }
        />
      </div>
    </main>
  );
}
