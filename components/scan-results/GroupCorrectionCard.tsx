"use client";
import { useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface GroupCorrectionCardProps {
  sessionId: string;
  groupName: string;
  /** Only set for a "Rare UnitGroup detected" card — how many units
   * currently share this group name in this file. */
  count?: number;
  onUpdated: (result: ValidateResponse) => void;
  /** Reports the group name back up once exclusion succeeds, so the
   * page can remember it was excluded (not just refresh `results`) --
   * excluding drops a group out of every future `/validate` response
   * entirely, so without this the page would have no way to later show
   * "this was excluded" or offer an undo. */
  onExcluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// One card per distinct UnitGroup name affected by a given warning
// reason — a group-wide fix (rename via `/correct-group`, or exclude
// entirely via `/exclude-group`) rather than a per-unit one, since a
// UnitGroup is by definition shared across many units. Width/Length are
// optional (an odd/non-dimensioned group like "Hertz Office Space" may
// have neither); Additional Properties, if supplied, is concatenated
// onto the dimensions (or the existing name, if dimensions are left
// blank).
export function GroupCorrectionCard({
  sessionId,
  groupName,
  count,
  onUpdated,
  onExcluded,
  onSessionExpired,
}: GroupCorrectionCardProps) {
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [
    additionalProperties,
    setAdditionalProperties,
  ] = useState("");
  const [saved, setSaved] = useState(false);

  // Two independent actions against two independent endpoints -- each
  // gets its own useSessionAction instance rather than sharing one, so
  // "Save" and "Exclude" have their own pending/error state (both are
  // still cross-disabled against each other in the JSX below, matching
  // the original behavior).
  const {
    pending: saving,
    error: saveError,
    run: runSave,
  } = useSessionAction(
    sessionId,
    "/correct-group"
  );

  const {
    pending: excluding,
    error: excludeError,
    run: runExclude,
  } = useSessionAction(
    sessionId,
    "/exclude-group"
  );

  const error = saveError ?? excludeError;

  const handleSave = async () => {
    const result = await runSave({
      group_name: groupName,
      width: width.trim() || null,
      length: length.trim() || null,
      additional_properties:
        additionalProperties.trim() ||
        null,
    });

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") {
      return;
    }

    const data: ValidateResponse =
      await result.response.json();

    setSaved(true);
    onUpdated(data);
  };

  const handleExclude = async () => {
    const result = await runExclude({
      group_name: groupName,
      excluded: true,
    });

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") {
      return;
    }

    const data: ValidateResponse =
      await result.response.json();

    onExcluded([groupName]);
    onUpdated(data);
  };

  return (
    <div className="rounded bg-slate-800 p-3">
      <div className="font-semibold">
        {groupName}
        {count !== undefined && (
          <span className="ml-1 font-normal text-slate-400">
            ({count})
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-400">
          Width
        </label>

        <input
          type="text"
          value={width}
          onChange={(e) => {
            setWidth(e.target.value);
            setSaved(false);
          }}
          disabled={saving || excluding}
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <label className="text-sm text-slate-400">
          Length
        </label>

        <input
          type="text"
          value={length}
          onChange={(e) => {
            setLength(e.target.value);
            setSaved(false);
          }}
          disabled={saving || excluding}
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <label className="text-sm text-slate-400">
          Additional Properties
        </label>

        <input
          type="text"
          value={additionalProperties}
          onChange={(e) => {
            setAdditionalProperties(
              e.target.value
            );
            setSaved(false);
          }}
          disabled={saving || excluding}
          placeholder="e.g. Ground Floor"
          className="w-48 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
        />

        <button
          onClick={handleSave}
          disabled={saving || excluding}
          className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <button
          onClick={handleExclude}
          disabled={saving || excluding}
          className="rounded bg-slate-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {excluding
            ? "Excluding..."
            : "Exclude this group"}
        </button>

        {saved && (
          <span className="text-sm text-green-400">
            ✓ saved
          </span>
        )}

        {error && (
          <span className="text-sm text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
