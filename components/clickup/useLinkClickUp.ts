"use client";

import { useEffect, useState } from "react";

import {
  getClickUpSuggestions,
  listClickUpLists,
  resolveClickUpUrl,
  saveClickUpLinks,
  type ClickUpLinkedList,
  type ClickUpListOption,
  type ClickUpSuggestion,
  type SaveLinksResult,
} from "@/lib/clickupLinks";

export interface LinkRow {
  facilityId: string;
  facilityName: string;
  current: ClickUpLinkedList | null;
  suggestion: ClickUpSuggestion | null;
  /** The list currently chosen in the row's dropdown (null = none). */
  listId: string | null;
  /** Whether this row will be saved. Meaningful only when `listId`
   * differs from what the facility is already linked to. */
  include: boolean;
}

export interface ManualState {
  open: boolean;
  url: string;
  resolving: boolean;
  error: string | null;
}

const CLOSED_MANUAL: ManualState = { open: false, url: "", resolving: false, error: null };

/** A row only has something to save when its chosen list differs from
 * what the facility is already linked to. */
export function isChange(row: LinkRow): boolean {
  return row.listId !== null && row.listId !== row.current?.list_id;
}

/**
 * Everything the "Link ClickUp" dialog needs: the per-facility
 * suggestions, the catalog of lists for the dropdowns, each row's
 * selection, the manual-URL flow, and saving.
 *
 * Initial selections follow one rule -- **nothing is saved without a
 * person confirming, and shaky matches are not pre-ticked**: a facility
 * that is already linked keeps its link (nothing to save); otherwise a
 * high- or medium-confidence suggestion is pre-selected and ticked, a
 * low-confidence one is pre-selected but left unticked, and no
 * suggestion leaves the row empty.
 *
 * `facilityIds` narrows the dialog to specific facilities (the facility
 * page's own Link/Change link); omitted means every facility of the
 * company.
 */
export function useLinkClickUp(companyId: string, facilityIds?: string[]) {
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [lists, setLists] = useState<ClickUpListOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Lists that came from a pasted URL and so may not be in `lists`.
  const [extraLists, setExtraLists] = useState<Record<string, ClickUpListOption>>({});
  const [manual, setManual] = useState<Record<string, ManualState>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<SaveLinksResult | null>(null);

  const scopeKey = facilityIds?.join(",") ?? "";

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      const [suggestionsResult, listsResult] = await Promise.all([
        getClickUpSuggestions(companyId),
        listClickUpLists(),
      ]);
      if (cancelled) return;

      if (suggestionsResult.kind !== "ok") {
        setLoadError(suggestionsResult.message);
        return;
      }
      if (listsResult.kind !== "ok") {
        setLoadError(listsResult.message);
        return;
      }

      const scope = scopeKey ? scopeKey.split(",") : null;
      setLists(listsResult.data.lists);
      setRows(
        suggestionsResult.data.facilities
          .filter((facility) => !scope || scope.includes(facility.facility_id))
          .map((facility) => {
            const { current, suggestion } = facility;
            if (current) {
              return {
                facilityId: facility.facility_id,
                facilityName: facility.facility_name,
                current,
                suggestion,
                listId: current.list_id,
                include: false,
              };
            }
            return {
              facilityId: facility.facility_id,
              facilityName: facility.facility_name,
              current,
              suggestion,
              listId: suggestion?.list.list_id ?? null,
              include: suggestion !== null && suggestion.confidence !== "low",
            };
          })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, scopeKey]);

  function update(facilityId: string, change: (row: LinkRow) => LinkRow) {
    setRows((current) =>
      current ? current.map((row) => (row.facilityId === facilityId ? change(row) : row)) : current
    );
  }

  /** Changing a row's list ticks it when that is a real change. */
  function chooseList(facilityId: string, listId: string | null) {
    update(facilityId, (row) => {
      const next = { ...row, listId };
      return { ...next, include: isChange(next) };
    });
  }

  function setInclude(facilityId: string, include: boolean) {
    update(facilityId, (row) => ({ ...row, include }));
  }

  function setManualState(facilityId: string, change: Partial<ManualState>) {
    setManual((current) => ({
      ...current,
      [facilityId]: { ...(current[facilityId] ?? CLOSED_MANUAL), ...change },
    }));
  }

  /** Resolves the pasted URL; on success the row selects that list. */
  async function resolveManual(facilityId: string) {
    const url = (manual[facilityId]?.url ?? "").trim();
    if (!url) return;

    setManualState(facilityId, { resolving: true, error: null });
    const resolved = await resolveClickUpUrl(url);

    if (resolved.kind !== "ok") {
      setManualState(facilityId, { resolving: false, error: resolved.message });
      return;
    }

    setExtraLists((current) => ({ ...current, [resolved.data.list_id]: resolved.data }));
    chooseList(facilityId, resolved.data.list_id);
    setManual((current) => ({ ...current, [facilityId]: CLOSED_MANUAL }));
  }

  const changes = (rows ?? []).filter((row) => row.include && isChange(row));

  async function save(): Promise<boolean> {
    if (changes.length === 0) return false;

    setSaving(true);
    setSaveError(null);
    const response = await saveClickUpLinks(
      companyId,
      changes.map((row) => ({ facility_id: row.facilityId, list_id: row.listId as string }))
    );
    setSaving(false);

    if (response.kind !== "ok") {
      setSaveError(response.message);
      return false;
    }

    setResult(response.data);
    return true;
  }

  /** Every list a dropdown may offer: the catalog plus anything pasted. */
  function findList(listId: string): ClickUpListOption | undefined {
    return (
      extraLists[listId] ??
      lists.find((list) => list.list_id === listId) ??
      rows
        ?.flatMap((row) => (row.suggestion ? [row.suggestion.list] : []))
        .find((list) => list.list_id === listId)
    );
  }

  return {
    rows,
    lists,
    extraLists,
    loadError,
    manual,
    saving,
    saveError,
    result,
    changes,
    chooseList,
    setInclude,
    setManualState,
    resolveManual,
    findList,
    save,
  };
}
