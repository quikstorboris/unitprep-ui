"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ClientRootPage() {
  const router = useRouter();

  const { clientId } =
    useParams<{ clientId: string }>();

  useEffect(() => {
    router.replace(`/clients/${clientId}/info`);
  }, [clientId, router]);

  return null;
}
