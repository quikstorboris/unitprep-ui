"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getCompanyDetail, type CompanyDetail } from "@/lib/clientsDetail";
import { useAsyncResource } from "@/lib/useAsyncResource";

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
  // Reloads on a company switch (back to "Loading..." rather than
  // flashing the previous company) and on `refetch()`.
  const {
    data: company,
    error: loadError,
    refetch,
  } = useAsyncResource(() => getCompanyDetail(companyId), [companyId]);

  const value = useMemo(() => ({ company, loadError, refetch }), [company, loadError, refetch]);

  return <CompanyDetailContext.Provider value={value}>{children}</CompanyDetailContext.Provider>;
}

export function useCompanyDetail(): CompanyDetailContextValue {
  const value = useContext(CompanyDetailContext);
  if (!value) {
    throw new Error("useCompanyDetail must be used within a CompanyDetailProvider");
  }
  return value;
}
