"use client";

import { useState } from "react";

import { ToolRunFeed } from "@/components/facility/ToolRunFeed";
import { TOOL_TABS } from "@/components/facility/toolRunLabels";
import type { ToolRunSummary } from "@/types/api";

const EMPTY_MESSAGES: Record<string, string> = {
  dedup: "No duplicate checks recorded for this facility yet.",
  unit_group: "No unit group runs recorded for this facility yet.",
  tagger: "No template tagging runs recorded for this facility yet.",
};

/**
 * Onboarding Work tab -- a facility's history of past tool runs, one tab
 * per activity (Duplicate Check, Unit Groups, Template Tagger), each
 * listing its runs newest first. Only the open tab fetches, so a facility
 * with a long history in one tool does not load the others.
 */
export function OnboardingWorkTab({
  companyId,
  facilityId,
}: {
  companyId: string;
  facilityId: string;
}) {
  const [activeTool, setActiveTool] = useState<ToolRunSummary["tool"]>(
    TOOL_TABS[0].tool,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Onboarding Work</h2>

      <div
        role="tablist"
        aria-label="Onboarding work activities"
        className="flex flex-wrap gap-2 border-b border-slate-800"
      >
        {TOOL_TABS.map(({ tool, tabLabel }) => {
          const selected = tool === activeTool;

          return (
            <button
              key={tool}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTool(tool)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-blue-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {/* Keyed by tool so each activity gets its own feed state. */}
        <ToolRunFeed
          key={activeTool}
          companyId={companyId}
          facilityId={facilityId}
          tool={activeTool}
          emptyMessage={EMPTY_MESSAGES[activeTool] ?? "No runs recorded yet."}
        />
      </div>
    </div>
  );
}
