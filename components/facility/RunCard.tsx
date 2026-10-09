"use client";

import { formatDateTime } from "@/lib/format";
import { useState } from "react";

import ClickUpRunUpdatePanel from "@/components/clickup/ClickUpRunUpdatePanel";
import { DedupRunDetails } from "@/components/facility/DedupRunDetails";
import {
  canUpdateClickUp,
  RunClickUpAction,
} from "@/components/facility/RunClickUpAction";
import {
  DeleteRunButton,
  RunOutputAction,
  RunSourceAction,
} from "@/components/facility/RunActions";
import { TaggerRunDetails } from "@/components/facility/TaggerRunDetails";
import { UnitGroupRunDetails } from "@/components/facility/UnitGroupRunDetails";
import {
  actorLabel,
  ordinal,
  toolLabel,
} from "@/components/facility/toolRunLabels";
import { dropboxFolderWebUrl } from "@/lib/dropbox";
import type { ToolRunSummary } from "@/types/api";

/** One recorded run: who ran it and when, its source and output, and the
 * tool-specific results when expanded. */
export function RunCard({
  companyId,
  facilityId,
  run,
  onDeleted,
}: {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
  onDeleted: (runId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clickUpOpen, setClickUpOpen] = useState(false);

  return (
    <div className="rounded border border-slate-800">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="font-semibold text-slate-100">
            {ordinal(run.sequence_number)} {toolLabel(run.tool)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {actorLabel(run)} &middot;{" "}
            {formatDateTime(run.created_at)}
          </div>
        </div>
        <span className="text-xs text-slate-500">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-800 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-slate-500">Source: </span>
              {run.source_dropbox_path ? (
                <a
                  href={dropboxFolderWebUrl(run.source_dropbox_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {run.source_file_name}
                </a>
              ) : (
                <span className="text-slate-300">{run.source_file_name}</span>
              )}
            </div>
            <RunSourceAction
              companyId={companyId}
              facilityId={facilityId}
              run={run}
            />
            <RunOutputAction
              companyId={companyId}
              facilityId={facilityId}
              run={run}
            />
            <RunClickUpAction
              run={run}
              open={clickUpOpen}
              onToggle={() => setClickUpOpen((current) => !current)}
            />
            <div className="ml-auto">
              <DeleteRunButton
                companyId={companyId}
                facilityId={facilityId}
                run={run}
                onDeleted={onDeleted}
              />
            </div>
          </div>

          {clickUpOpen && canUpdateClickUp(run) && (
            <ClickUpRunUpdatePanel
              companyId={companyId}
              facilityId={facilityId}
              sessionId={run.id}
              fileSavedToDropbox={
                run.output_kind === "dropbox" || run.output_kind === "both"
              }
              onDismiss={() => setClickUpOpen(false)}
            />
          )}

          {run.tool === "dedup" && (
            <DedupRunDetails
              companyId={companyId}
              facilityId={facilityId}
              runId={run.id}
              initialReport={run.report_summary}
              canRematchRun={run.can_rematch}
            />
          )}
          {run.tool === "unit_group" && (
            <UnitGroupRunDetails summary={run.report_summary} />
          )}
          {run.tool === "tagger" && (
            <TaggerRunDetails summary={run.report_summary} />
          )}
        </div>
      )}
    </div>
  );
}
