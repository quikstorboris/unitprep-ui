"use client";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import type { CopyScope } from "@/lib/clickupCopy";
import BulkDestinations from "./BulkDestinations";
import BulkTaskCard from "./BulkTaskCard";
import BulkTaskPicker from "./BulkTaskPicker";
import CopyJobsList from "./CopyJobsList";
import CopyResults from "./CopyResults";
import { useBulkCopy, type TaskOutcome } from "./useBulkCopy";
import { useCopyJobs } from "./useCopyJobs";

const selectClass = "rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200";

interface Source {
  id: string;
  name: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What happened to one task's copy: how many landed, or that it went to
 * the background, or why the request itself failed. */
function Outcome({ outcome, showName }: { outcome: TaskOutcome; showName: boolean }) {
  const { result } = outcome;
  const name = showName ? <span className="font-medium text-slate-200">{outcome.taskName}: </span> : null;

  if (!result) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {name}
        {outcome.error}
      </p>
    );
  }

  if (result.mode === "job") {
    return (
      <p className="text-sm text-slate-200">
        {name}
        running in the background.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className={`text-sm font-medium ${result.failed === 0 ? "text-green-400" : "text-amber-300"}`}>
        {name}
        {result.failed === 0
          ? `Copied to ${plural(result.copied, "facility", "facilities")}.`
          : `${result.copied} copied, ${result.failed} failed.`}
      </p>
      <CopyResults results={result.results} />
    </div>
  );
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

  const started = copy.outcomes?.some((outcome) => outcome.result?.mode === "job") ?? false;
  const taskCount = copy.plan.entries.length;

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

          <section aria-label="Tasks to copy" className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-200">1. Choose the tasks</h2>
            <p className="text-xs text-slate-500">Tick as many as you like; each keeps its own comment.</p>
            <BulkTaskPicker
              tasks={copy.tasks.tasks}
              selectedIds={copy.selectedIds}
              onToggle={copy.toggleTask}
              onSetMany={copy.setTasksSelected}
            />
          </section>

          {copy.selectedTasks.length > 0 && (
            <section aria-label="Where to copy" className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">2. Choose the facilities</h2>
              <BulkDestinations
                destinations={copy.tasks.destinations}
                ticked={copy.ticked}
                blocked={copy.blocked}
                unlinked={copy.tasks.unlinked}
                onToggle={copy.toggleFacility}
                onSetAll={copy.setAllFacilities}
              />

              <h2 className="pt-2 text-sm font-semibold text-slate-200">
                3. Check the tasks and write the {copy.selectedTasks.length === 1 ? "comment" : "comments"}
              </h2>
              {copy.selectedTasks.map((task) => (
                <BulkTaskCard
                  key={task.task_id}
                  task={task}
                  state={copy.perTask[task.task_id]}
                  ticked={copy.ticked}
                  blocked={copy.blocked}
                  focus={copy.selectedTasks.length === 1}
                  onEditComment={(text) => copy.editComment(task.task_id, text)}
                  onChooseTarget={(facilityId, target) => copy.chooseTarget(task.task_id, facilityId, target)}
                />
              ))}
              <p className="text-xs text-slate-500">
                Plain text, posted under your name on each selected facility&apos;s task.
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

              {copy.plan.skipped > 0 && (
                <p role="status" className="text-xs text-amber-300">
                  {copy.plan.skipped === 1
                    ? "One chosen facility has no task for one of the tasks and will be skipped there."
                    : `${copy.plan.skipped} facility and task combinations have no task chosen and will be skipped.`}
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
                  : taskCount > 1
                    ? `Confirm — copy ${taskCount} tasks to ${plural(copy.plan.facilities, "facility", "facilities")}`
                    : `Confirm — copy to ${plural(copy.plan.facilities, "facility", "facilities")}`}
              </button>

              {started && (
                <p role="status" className="rounded bg-slate-900 p-3 text-sm text-slate-200">
                  This is a big one, so it&apos;s running in the background, paced to ClickUp&apos;s limits.
                  We&apos;ll notify you when copying is complete — you can leave this page.
                </p>
              )}
              {copy.outcomes && copy.outcomes.length > 0 && (
                <div role="status" className="space-y-3">
                  {copy.outcomes
                    .filter((outcome) => outcome.result?.mode !== "job" || copy.outcomes!.length > 1)
                    .map((outcome) => (
                      <Outcome key={outcome.taskId} outcome={outcome} showName={copy.outcomes!.length > 1} />
                    ))}
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
 * The client page's ClickUp Copy tab: copy comments from any number of
 * tasks in one facility's ClickUp list (the parent by default) to their
 * counterparts in the client's other facilities. Choose the tasks, pick
 * the facilities from the dropdown (none is picked to begin with), check
 * each task's counterparts and edit its comment, Confirm. Every copied
 * comment ends with a link to its source task. A copy too big for one
 * request runs in the background and ends with a browser notification.
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
