"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/http";
import type { DedupFileRequirementsResponse } from "@/types/api";

interface UseDedupFileRequirementsResult {
  requirements: DedupFileRequirementsResponse | null;
  loading: boolean;
  error: string | null;
}

/** Fetches GET /dedup/file-requirements once on mount. */
export function useDedupFileRequirements(): UseDedupFileRequirementsResult {
  const [requirements, setRequirements] = useState<DedupFileRequirementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const result = await apiRequest<DedupFileRequirementsResponse>(
        "GET",
        "/dedup/file-requirements",
        undefined,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;

      if (result.kind === "ok") {
        setRequirements(result.data);
      } else {
        setError(result.message);
      }
      setLoading(false);
    };

    void load();
    return () => controller.abort();
  }, []);

  return { requirements, loading, error };
}
