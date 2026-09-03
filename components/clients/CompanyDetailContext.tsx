"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getCompanyDetail, type CompanyDetail } from "@/lib/clientsDetail";

/**
 * Fetches `getCompanyDetail` once per `companyId` and shares it across
 * the Company page and every Facility page under it (2026-09-03 fix --
 * both pages used to call `getCompanyDetail` independently, so clicking
 * between facilities in the rail refetched the *company's* data too,
 * even though it hadn't changed. Keyed on `companyId` alone, so
 * switching facilities within the same company reuses what's already
 * loaded instead of blinking back to "Loading…").
 */
interface CompanyDetailContextValue {
  company: CompanyDetail | null;
  loadError: string | null;
  refetch: () => void;
}

const CompanyDetailContext = createContext<CompanyDetailContextValue | null>(null);

export function CompanyDetailProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by `refetch()` to force the effect below to re-run without
  // depending on `companyId` changing.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      // Reset so a company switch shows "Loading…" again instead of
      // flashing the previous company's data -- done here (inside the
      // effect's async callback, not synchronously in the effect body)
      // per the `react-hooks/set-state-in-effect` rule.
      if (cancelled) return;
      setCompany(null);
      setLoadError(null);

      const result = await getCompanyDetail(companyId);
      if (cancelled) return;
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setCompany(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, generation]);

  return (
    <CompanyDetailContext.Provider
      value={{ company, loadError, refetch: () => setGeneration((g) => g + 1) }}
    >
      {children}
    </CompanyDetailContext.Provider>
  );
}

export function useCompanyDetail(): CompanyDetailContextValue {
  const value = useContext(CompanyDetailContext);
  if (!value) {
    throw new Error("useCompanyDetail must be used within a CompanyDetailProvider");
  }
  return value;
}
