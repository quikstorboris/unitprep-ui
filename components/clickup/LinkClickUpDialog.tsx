"use client";

import { useId, useMemo } from "react";

import ModalShell from "@/components/shared/ModalShell";
import Tooltip from "@/components/Tooltip";
import type { ClickUpListOption, MatchConfidence } from "@/lib/clickupLinks";
import { isChange, useLinkClickUp, type LinkRow } from "./useLinkClickUp";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";

const MANUAL_HELP =
  "In ClickUp, open this facility's list (the one with its onboarding tasks) and copy the address from your browser's address bar, then paste it here. We'll look it up and show you the list's name before anything is linked.";

const NO_LIST = "";

const CONFIDENCE_BADGE: Record<MatchConfidence, { label: string; className: string }> = {
  high: { label: "Strong match", className: "bg-green-900 text-green-200" },
  medium: { label: "Likely match", className: "bg-amber-900 text-amber-200" },
  low: { label: "Weak match — please check", className: "bg-red-900 text-red-200" },
};

/** The dropdown's options, grouped by ClickUp folder (the company, in
 * most cases) so a long list stays navigable with the keyboard. */
function groupByFolder(lists: ClickUpListOption[]): [string, ClickUpListOption[]][] {
  const groups = new Map<string, ClickUpListOption[]>();
  for (const list of lists) {
    const folder = list.folder_name || "(no folder)";
    groups.set(folder, [...(groups.get(folder) ?? []), list]);
  }
  return [...groups.entries()];
}

function RowBadge({ row }: { row: LinkRow }) {
  if (row.current && row.listId === row.current.list_id) {
    return <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">Linked</span>;
  }

  // A different list chosen by hand (or pasted) is a deliberate choice,
  // not a match the system is vouching for.
  if (row.suggestion && row.listId === row.suggestion.list.list_id) {
    const badge = CONFIDENCE_BADGE[row.suggestion.confidence];
    return <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>;
  }

  if (row.listId) {
    return <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">Chosen by you</span>;
  }

  return <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">No match found</span>;
}

/**
 * The "Link ClickUp" dialog: one row per facility, each preselected with
 * the best-matching ClickUp list. Nothing is saved until the person
 * confirms; shaky matches arrive unticked. Each row can switch to any
 * other onboarding list from its dropdown, or paste a ClickUp URL
 * ("Link manually"), which is resolved to the list's real name first.
 *
 * Pass `facilityIds` to scope it to specific facilities (the facility
 * page's own Link / Change link).
 */
export default function LinkClickUpDialog({
  companyId,
  companyName,
  facilityIds,
  onClose,
  onSaved,
}: {
  companyId: string;
  companyName: string;
  facilityIds?: string[];
  onClose: () => void;
  /** Called once links were saved, so the page can reload them. */
  onSaved: () => void;
}) {
  const titleId = useId();
  const link = useLinkClickUp(companyId, facilityIds);

  const groups = useMemo(() => {
    const merged = [...link.lists, ...Object.values(link.extraLists)].filter(
      (list, index, all) => all.findIndex((other) => other.list_id === list.list_id) === index
    );
    return groupByFolder(merged);
  }, [link.lists, link.extraLists]);

  async function handleSave() {
    if (await link.save()) onSaved();
  }

  const scoped = facilityIds !== undefined;
  const heading = scoped ? "ClickUp list" : "Link ClickUp";

  // After a save that reuses a list another facility already has, show
  // the warning instead of closing silently.
  if (link.result && link.result.shared_lists.length > 0) {
    return (
      <ModalShell labelledBy={titleId} onClose={onClose}>
        <h2 id={titleId} className="mb-2 text-lg font-semibold text-slate-100">
          Linked {link.result.linked} {link.result.linked === 1 ? "facility" : "facilities"}
        </h2>
        <p className="mb-3 text-sm text-amber-300">
          Heads up: some of these lists are also used by other facilities. One list per facility is
          the usual setup, so double-check these were meant to be shared.
        </p>
        <ul className="mb-4 flex flex-col gap-2 text-sm text-slate-300">
          {link.result.shared_lists.map((shared) => (
            <li key={shared.list_id}>
              <strong>{shared.list_name}</strong> is also linked to {shared.also_linked_to.join(", ")}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            Done
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell labelledBy={titleId} onClose={onClose} width="max-w-3xl">
      <div className="mb-1 flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold text-slate-100">
          {heading}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-slate-500 hover:text-slate-200"
        >
          ×
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        {companyName} — confirm which ClickUp list each facility uses. Nothing is saved until you
        click the button below.
      </p>

      {link.loadError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {link.loadError}
        </p>
      )}

      {!link.rows && !link.loadError && (
        <p className="text-sm text-slate-400">Looking through ClickUp…</p>
      )}

      {link.rows && link.rows.length === 0 && (
        <p className="text-sm text-slate-500">This company has no facilities to link.</p>
      )}

      <ul className="flex flex-col gap-3">
        {link.rows?.map((row) => {
          const manual = link.manual[row.facilityId];
          const chosen = row.listId ? link.findList(row.listId) : undefined;
          const duplicate =
            row.include && row.listId
              ? link.rows?.find(
                  (other) =>
                    other.facilityId !== row.facilityId &&
                    other.listId === row.listId &&
                    (other.include || other.current?.list_id === row.listId)
                )
              : undefined;

          return (
            <li key={row.facilityId} className="rounded border border-slate-800 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{row.facilityName}</span>
                  <RowBadge row={row} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={row.include && isChange(row)}
                    disabled={!isChange(row)}
                    onChange={(event) => link.setInclude(row.facilityId, event.target.checked)}
                    aria-label={`Link ${row.facilityName}`}
                  />
                  Link
                </label>
              </div>

              <select
                aria-label={`ClickUp list for ${row.facilityName}`}
                value={row.listId ?? NO_LIST}
                onChange={(event) => link.chooseList(row.facilityId, event.target.value || null)}
                className={inputClass}
              >
                <option value={NO_LIST}>— No ClickUp list —</option>
                {row.current && !groups.some(([, items]) => items.some((l) => l.list_id === row.current!.list_id)) && (
                  <optgroup label="Currently linked">
                    <option value={row.current.list_id}>{row.current.list_name}</option>
                  </optgroup>
                )}
                {groups.map(([folder, items]) => (
                  <optgroup key={folder} label={folder}>
                    {items.map((list) => (
                      <option key={list.list_id} value={list.list_id}>
                        {list.list_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {chosen && chosen.folder_name && (
                <p className="mt-1 text-xs text-slate-500">Folder: {chosen.folder_name}</p>
              )}
              {duplicate && (
                <p className="mt-1 text-xs text-amber-300">
                  {duplicate.facilityName} uses this list too. One list per facility is the usual
                  setup.
                </p>
              )}

              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    link.setManualState(row.facilityId, { open: !(manual?.open ?? false), error: null })
                  }
                  className={buttonClass}
                  aria-label={`Link ${row.facilityName} manually`}
                >
                  Link manually
                </button>
                <Tooltip text={MANUAL_HELP} label="How to link manually" />
              </div>

              {manual?.open && (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={manual.url}
                      onChange={(event) =>
                        link.setManualState(row.facilityId, { url: event.target.value, error: null })
                      }
                      placeholder="https://app.clickup.com/…"
                      aria-label={`ClickUp URL for ${row.facilityName}`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={manual.resolving || manual.url.trim().length === 0}
                      onClick={() => link.resolveManual(row.facilityId)}
                      className={buttonClass}
                    >
                      {manual.resolving ? "Looking up…" : "Look up"}
                    </button>
                  </div>
                  {manual.error && (
                    <p role="alert" className="text-sm text-red-400">
                      {manual.error}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {link.saveError && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {link.saveError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={link.saving || link.changes.length === 0}
          onClick={handleSave}
          className={primaryButtonClass}
        >
          {link.saving
            ? "Saving…"
            : link.changes.length === 0
              ? "Nothing to link"
              : `Link ${link.changes.length} ${link.changes.length === 1 ? "facility" : "facilities"}`}
        </button>
      </div>
    </ModalShell>
  );
}
