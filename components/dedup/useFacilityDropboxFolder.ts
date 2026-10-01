"use client";

import { useEffect, useRef, useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import { useClients } from "@/lib/clients";
import { getFacilityDropboxFolder } from "@/lib/dropbox";

/**
 * Which of this client's own facilities to browse Dropbox from -- a
 * company can have several, each with its own real Dropbox folder, and
 * there's no single "client Dropbox root" to default to (Boris,
 * 2026-09-04: require an explicit pick rather than guessing).
 * `facilityDropboxPath`: `undefined` = still resolving, `null` = this
 * facility has no folder findable by name in Dropbox.
 */
export function useFacilityDropboxFolder(clientId: string, facilityId: string) {
  const { getClient } = useClients();
  const client = getClient(clientId);
  const { company } = useCompanyDetail();

  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [facilityDropboxPath, setFacilityDropboxPath] = useState<string | null | undefined>(undefined);

  const selectFacility = async (facilityName: string) => {
    setSelectedFacility(facilityName || null);
    setFacilityDropboxPath(undefined);

    if (!facilityName || !clientId) return;

    const result = await getFacilityDropboxFolder(clientId, facilityName);
    setFacilityDropboxPath(result.kind === "ok" ? result.data.path : null);
  };

  // Pre-selects the facility this tab is already scoped to -- the
  // dropdown still lets the user override it, but defaulting to
  // "nothing picked yet" made it too easy to import against the wrong
  // facility (2026-09-23: a real Dedup check run against the wrong
  // facility's data). Only fires once per facility --
  // `autoSelectedFacilityIdRef` stops it from re-firing and fighting a
  // deliberate manual re-pick.
  const autoSelectedFacilityIdRef = useRef<string | null>(null);
  useEffect(() => {
    const facilityName = company?.facilities.find((f) => f.id === facilityId)?.name;
    if (!facilityName) return;
    if (autoSelectedFacilityIdRef.current === facilityId) return;

    autoSelectedFacilityIdRef.current = facilityId;
    void selectFacility(facilityName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectFacility is stable in shape; only re-run when the resolvable facility changes
  }, [company, facilityId]);

  return {
    client,
    facilityNames: client?.facilityNames ?? [],
    selectedFacility,
    facilityDropboxPath,
    selectFacility,
  };
}
