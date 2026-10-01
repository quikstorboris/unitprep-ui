"use client";

import { useEffect, useState } from "react";

import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";
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
      try {
        const response = await fetch(`${API_URL}/dedup/file-requirements`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) notifyUnauthorized();

        if (!response.ok) {
          setError(await errorMessageFrom(response));
          return;
        }

        setRequirements((await response.json()) as DedupFileRequirementsResponse);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(describeFetchError(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return { requirements, loading, error };
}
