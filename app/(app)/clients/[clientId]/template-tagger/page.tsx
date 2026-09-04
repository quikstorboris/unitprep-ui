"use client";

import { useParams, useRouter } from "next/navigation";

import TaggerUploadPage from "@/components/TaggerUploadPage";

export default function TemplateTaggerHome() {
  const router = useRouter();

  const { clientId } = useParams<{ clientId: string }>();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <TaggerUploadPage
          clientId={clientId}
          onChecked={(sessionId) =>
            router.push(`/clients/${clientId}/template-tagger/${sessionId}`)
          }
        />
      </div>
    </main>
  );
}
