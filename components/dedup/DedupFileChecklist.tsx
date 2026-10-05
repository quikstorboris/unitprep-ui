"use client";

import { blockReasonFor } from "@/components/dedup/dedupChecklist";
import type { DedupClassifyResponse, DedupFileClassification } from "@/types/api";

interface DedupFileChecklistProps {
  classification: DedupClassifyResponse;
  checked: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (fileName: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

function Badge({ file }: { file: DedupFileClassification }) {
  if (file.status === "recognized" && file.role === "supporting") {
    return (
      <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
        Supporting file – not used yet
      </span>
    );
  }

  if (file.status === "recognized") {
    return (
      <span className="rounded bg-blue-900 px-2 py-0.5 text-xs text-blue-200">
        {file.format_name}
      </span>
    );
  }

  return (
    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
      {file.status === "unreadable" ? "Could not be read" : "Not a dedup file"}
    </span>
  );
}

/**
 * One row per classified file: a real checkbox, name, a format badge and,
 * for a file that loses to a preferred alternative, a note saying which.
 * Files that can't be run are muted but stay tickable -- ticking one
 * blocks Run with an explanation rather than hiding the choice.
 */
export function DedupFileChecklist({
  classification,
  checked,
  disabled,
  onToggle,
  onSelectAll,
  onSelectNone,
}: DedupFileChecklistProps) {
  const { files, suggested } = classification;

  return (
    <fieldset disabled={disabled} className="mt-6 border-t border-slate-800 pt-4">
      <legend className="sr-only">Files to check</legend>

      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">
          {checked.size} of {files.length} file(s) selected
        </span>
        <span className="flex gap-3">
          <button type="button" onClick={onSelectAll} className="text-blue-400 hover:underline">
            Select all
          </button>
          <button type="button" onClick={onSelectNone} className="text-blue-400 hover:underline">
            Select none
          </button>
        </span>
      </div>

      <ul className="divide-y divide-slate-800 rounded border border-slate-800">
        {files.map((file) => {
          const muted = blockReasonFor(file) !== null;
          const alternativeTo = suggested.alternatives[file.file_name];
          const id = `dedup-file-${file.file_name}`;

          return (
            <li key={file.file_name} className="flex items-start gap-3 px-3 py-2">
              <input
                id={id}
                type="checkbox"
                checked={checked.has(file.file_name)}
                onChange={() => onToggle(file.file_name)}
                className="mt-1"
              />
              <div className={`min-w-0 flex-1 ${muted ? "text-slate-500" : "text-slate-200"}`}>
                <label htmlFor={id} className="break-all text-sm">
                  {file.file_name}
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge file={file} />
                  {alternativeTo && (
                    <span className="text-xs text-slate-400">Alternative to {alternativeTo}</span>
                  )}
                </div>
                {file.status === "unrecognized" && file.closest_vendor && (
                  <p className="mt-1 text-xs text-slate-400">
                    Looks like {file.closest_vendor}, but is missing:{" "}
                    {(file.missing_headers ?? []).join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
