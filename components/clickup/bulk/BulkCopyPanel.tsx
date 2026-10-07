"use client";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import type { CopyScope } from "@/lib/clickupCopy";
import BulkDestinations from "./BulkDestinations";
import BulkTaskPicker from "./BulkTaskPicker";
import CopyJobsList from "./CopyJobsList";
import CopyResults from "./CopyResults";
import { useBulkCopy } from "./useBulkCopy";
import { useCopyJobs } from "./useCopyJobs";

const selectClass = "rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200";

interface Source {
  id: string;
  name: string;
}

function Inner({
  companyId,
  sources,
  defaultSourceId,
}: {
  companyId: string;
  sources: Source[];
  defaultSourceId: string;
}) {
  const jobs = useCopyJobs(companyId);
  const copy = useBulkCopy(companyId, defaultSourceId, () => void jobs.refresh());

  const started = copy.result?.mode === "job";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Copy from
          <select
            value={copy.sourceId ?? ""}
            onChange={(event) => copy.setSourceId(event.target.value || null)}
            className={selectClass}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
                {source.id === defaultSourceId ? " (parent)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Tasks
          <select
            value={copy.scope}
            onChange={(event) => copy.setScope(event.target.value as CopyScope)}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="corporate">Corporate only</option>
            <option value="facility">Facility only</option>
          </select>
        </label>
      </div>

      {jobs.loadError && (
        <p role="alert" className="text-sm text-red-400">
          {jobs.loadError}
        </p>
      )}
      <CopyJobsList jobs={jobs.jobs} />

      {copy.loadError && (
        <p role="alert" className="text-sm text-red-400">
          {copy.loadError}
        </p>
      )}
      {!copy.tasks && !copy.loadError && <p className="text-sm text-slate-400">Loading tasks from ClickUp…</p>}

      {copy.tasks && (
        <>
          {copy.tasks.parent === null && (
            <p className="text-xs text-slate-500">
              No parent facility is designated, so no &quot;main task list&quot; note will be added to the
              target tasks.
            </p>
          )}

          <section aria-label="Task to copy" className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-200">1. Choose the task</h2>
            <BulkTaskPicker
              tasks={copy.tasks.tasks}
              selectedId={copy.selectedTaskId}
              onSelect={(id) => void copy.chooseTask(id)}
            />
          </section>

          {copy.selectedTask && (
            <section aria-label="Where to copy it" className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">2. Choose the facilities</h2>
              {copy.pairsError && (
                <p role="alert" className="text-sm text-red-400">
                  {copy.pairsError}
                </p>
              )}
              {!copy.pairs && !copy.pairsError && (
                <p className="text-sm text-slate-400">Finding each facility&apos;s matching task…</p>
              )}
              {copy.pairs && (
                <BulkDestinations
                  pairs={copy.pairs}
                  destinations={copy.destinations}
                  unlinked={copy.tasks.unlinked}
                  onToggle={copy.toggle}
                  onSetAll={copy.setAll}
                  onChooseTarget={copy.chooseTarget}
                />
              )}

              <h2 className="pt-2 text-sm font-semibold text-slate-200">3. Write the comment</h2>
              <textarea
                aria-label="Comment to post"
                value={copy.comment}
                rows={4}
                autoFocus
                onChange={(event) => copy.editComment(event.target.value)}
                placeholder={
                  copy.commentLoading
                    ? "Loading the source comment…"
                    : copy.noSourceComment
                      ? "The source task has no comment — type one."
                      : ""
                }
                className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <p className="text-xs text-slate-500">
                Plain text, posted under your name on every selected task. The same comment goes to all.
                A link to the source task is added at the bottom automatically:{" "}
                <span className="text-slate-400">
                  Main tracker task - {copy.selectedTask.name}
                </span>
                .
              </p>

              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={copy.completeTasks}
                  onChange={(event) => copy.setCompleteTasks(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Also mark each task complete
                  <span className="block text-xs text-slate-500">
                    Leave this unticked to only add the comment: the tasks keep their current status.
                  </span>
                </span>
              </label>

              {copy.missingTargets > 0 && (
                <p role="status" className="text-xs text-amber-300">
                  {copy.missingTargets === 1
                    ? "One selected facility still needs a task."
                    : `${copy.missingTargets} selected facilities still need a task.`}
                </p>
              )}

              {copy.copyError && (
                <p role="alert" className="text-sm text-red-400">
                  {copy.copyError}
                </p>
              )}

              <button
                type="button"
                disabled={!copy.canSubmit}
                onClick={() => void copy.submit()}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {copy.copying
                  ? "Copying…"
                  : `Confirm — copy to ${copy.chosenCount} ${copy.chosenCount === 1 ? "facility" : "facilities"}`}
              </button>

              {started && (
                <p role="status" className="rounded bg-slate-900 p-3 text-sm text-slate-200">
                  This is a big one, so it&apos;s running in the background, paced to ClickUp&apos;s limits.
                  We&apos;ll notify you when copying is complete — you can leave this page.
                </p>
              )}
              {copy.result?.mode === "inline" && (
                <div role="status" className="space-y-2">
                  <p
                    className={`text-sm font-medium ${copy.result.failed === 0 ? "text-green-400" : "text-amber-300"}`}
                  >
                    {copy.result.failed === 0
                      ? `Copied to ${copy.result.copied} ${copy.result.copied === 1 ? "facility" : "facilities"}.`
                      : `${copy.result.copied} copied, ${copy.result.failed} failed.`}
                  </p>
                  <CopyResults results={copy.result.results} />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The client page's ClickUp Copy tab: copy one comment from a task in one
 * facility's ClickUp list (the parent by default) to the counterpart task
 * in any of the client's other facilities. Choose the task, pick the
 * facilities from the dropdown (none is picked to begin with), edit the
 * comment, Confirm. Every copied comment ends with a link to the source
 * task. A copy
 * too big for one request runs in the background and ends with a browser
 * notification.
 */
export default function BulkCopyPanel({ companyId }: { companyId: string }) {
  const { company } = useCompanyDetail();

  if (!company) return <p className="text-sm text-slate-400">Loading…</p>;

  const sources = company.facilities
    .filter((facility) => facility.clickup_list_id)
    .map((facility) => ({ id: facility.id, name: facility.name }));

  if (sources.length < 2) {
    return (
      <p className="text-sm text-slate-400">
        ClickUp Copy needs at least two facilities with a ClickUp list linked. Link them in the ClickUp
        section of the General tab.
      </p>
    );
  }

  const parentId = company.clickup_parent_facility_id;
  const defaultSourceId = sources.some((source) => source.id === parentId) ? parentId : sources[0].id;

  return <Inner companyId={companyId} sources={sources} defaultSourceId={defaultSourceId as string} />;
}
