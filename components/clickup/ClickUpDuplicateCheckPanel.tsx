"use client";

import { useEffect, useState } from "react";

import {
  getDuplicateCheckTasks,
  postDuplicateCheckResults,
  type DuplicateCheckTasks,
  type PostedDuplicateCheck,
  type StepOutcome,
} from "@/lib/clickupDuplicateCheck";
import { useClickUpAccess } from "./useClickUpAccess";

interface ClickUpDuplicateCheckPanelProps {
  companyId: string;
  facilityId: string;
  /** The dedup session being posted. */
  sessionId: string;
  /** Whether its summary file has been saved to Dropbox. The lookup is
   * redone when this flips, so the panel always knows whether the comment
   * will carry a link. */
  fileSavedToDropbox: boolean;
}

type Lookup =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tasks: DuplicateCheckTasks };

const linkClass = "text-blue-400 hover:underline";

function OutcomeLine({ label, outcome }: { label: string; outcome: StepOutcome }) {
  return (
    <li className={outcome.ok ? "text-green-300" : "text-red-300"}>
      {outcome.ok ? "✓" : "✗"} {label}
      {!outcome.ok && outcome.message ? ` — ${outcome.message}` : ""}
    </li>
  );
}

function PostedSummary({ posted }: { posted: PostedDuplicateCheck }) {
  const allDone = [posted.comment, posted.assignee, posted.status].every((o) => o === null || o.ok);

  return (
    <div className="space-y-2 text-sm">
      <div className={allDone ? "font-medium text-green-400" : "font-medium text-amber-300"}>
        {allDone
          ? "ClickUp task updated."
          : "ClickUp task partly updated — see below, and finish the rest in ClickUp."}
      </div>
      <ul className="space-y-1">
        <OutcomeLine label="Comment with the results link" outcome={posted.comment} />
        {posted.assignee && <OutcomeLine label="You added as assignee" outcome={posted.assignee} />}
        {posted.status && <OutcomeLine label="Task set to complete" outcome={posted.status} />}
      </ul>
      {posted.link_kind === "path" && (
        <div className="text-slate-400">
          Dropbox would not make a share link, so the comment links the file&apos;s Dropbox path
          instead — it opens for anyone with access to the facility folder.
        </div>
      )}
      {posted.link_kind === "none" && (
        <div className="text-amber-300">
          The comment has no link to the results file, because it is not saved in Dropbox. Add the
          file to the task in ClickUp yourself (or save it with Save to Facility Folder next time).
        </div>
      )}
      <a href={posted.task_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Open &ldquo;{posted.task_name}&rdquo; in ClickUp
      </a>
    </div>
  );
}

/**
 * Shown after a duplicate check's summary file is saved to the facility's
 * Dropbox folder: finds the facility's ClickUp task for this check (the
 * 1st or the 2nd) and asks whether to update it. The candidates always
 * appear as a list to confirm -- even a single match -- because a wrong
 * silent match would write to the wrong task under the user's name. With
 * several, the person must pick one (nothing is pre-selected).
 */
export default function ClickUpDuplicateCheckPanel({
  companyId,
  facilityId,
  sessionId,
  fileSavedToDropbox,
}: ClickUpDuplicateCheckPanelProps) {
  const access = useClickUpAccess();

  const [lookup, setLookup] = useState<Lookup>({ kind: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState<PostedDuplicateCheck | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!access.allowed) return;

    let cancelled = false;
    getDuplicateCheckTasks(companyId, facilityId, sessionId).then((result) => {
      if (cancelled) return;

      if (result.kind !== "ok") {
        setLookup({ kind: "error", message: result.message });
        return;
      }

      setLookup({ kind: "ready", tasks: result.data });
      // A lone candidate is shown selected; several need a deliberate pick.
      setSelected(result.data.candidates.length === 1 ? result.data.candidates[0].task_id : null);
    });

    return () => {
      cancelled = true;
    };
  }, [access.allowed, companyId, facilityId, sessionId, fileSavedToDropbox]);

  if (!access.allowed || dismissed) return null;

  async function handleUpdate() {
    if (!selected) return;

    setPostError(null);
    setPosting(true);
    const result = await postDuplicateCheckResults(companyId, facilityId, sessionId, selected);
    setPosting(false);

    if (result.kind !== "ok") {
      setPostError(result.message);
      return;
    }

    setPosted(result.data);
  }

  return (
    <section className="rounded border border-slate-700 p-4" aria-label="Update ClickUp">
      <h2 className="mb-3 text-lg font-semibold">Update ClickUp</h2>

      {lookup.kind === "loading" && (
        <div className="text-sm text-slate-400">Looking for this check&apos;s task in ClickUp…</div>
      )}

      {lookup.kind === "error" && (
        <div className="rounded bg-amber-950 p-3 text-sm text-amber-200">{lookup.message}</div>
      )}

      {lookup.kind === "ready" && posted && <PostedSummary posted={posted} />}

      {lookup.kind === "ready" && !posted && lookup.tasks.candidates.length === 0 && (
        <div className="space-y-2 text-sm text-slate-300">
          <div>
            No task that looks like the {lookup.tasks.step_label} was found in{" "}
            <a href={lookup.tasks.list_url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {lookup.tasks.list_name}
            </a>
            . Update it in ClickUp directly.
          </div>
        </div>
      )}

      {lookup.kind === "ready" && !posted && lookup.tasks.candidates.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Update the {lookup.tasks.step_label} task in ClickUp?{" "}
            {lookup.tasks.candidates.length > 1 ? "Choose the right one:" : "Is this the right task?"}
          </p>

          <fieldset className="space-y-2">
            <legend className="sr-only">ClickUp task</legend>
            {lookup.tasks.candidates.map((candidate) => (
              <label
                key={candidate.task_id}
                className="flex cursor-pointer items-start gap-3 rounded border border-slate-700 p-3 hover:bg-slate-800/50"
              >
                <input
                  type="radio"
                  name="clickup-task"
                  className="mt-1"
                  checked={selected === candidate.task_id}
                  onChange={() => setSelected(candidate.task_id)}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{candidate.name}</span>
                  <span className="block text-slate-400">
                    {candidate.parent_name ? `Under “${candidate.parent_name}” · ` : ""}
                    {candidate.status}
                    {candidate.is_finished ? " (already complete)" : ""}
                    {candidate.assignees.length > 0
                      ? ` · Assigned: ${candidate.assignees.join(", ")}`
                      : " · Unassigned"}
                  </span>
                  <a
                    href={candidate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkClass} text-xs`}
                  >
                    Open in ClickUp
                  </a>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-sm text-slate-400">
            {lookup.tasks.comment_only
              ? "This adds another comment to the task (it is already assigned and complete)."
              : "This adds a comment, adds you as an assignee, and sets the task to complete."}{" "}
            {lookup.tasks.file_link_available
              ? "The comment links the results file saved in Dropbox."
              : "The results file is not saved in Dropbox, so the comment will have no link — add the file to the task yourself, or save it with Save to Facility Folder first."}
          </p>

          {postError && <div className="rounded bg-red-900 p-3 text-sm text-red-200">{postError}</div>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={!selected || posting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posting ? "Updating…" : "Update ClickUp task"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              disabled={posting}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
