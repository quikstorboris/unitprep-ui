import type { ToolRunSummary } from "@/types/api";

/**
 * Display names for the tools whose runs appear on Onboarding Work, keyed
 * by `ToolRunSummary.tool`. The tab labels are the activity names; the run
 * labels read as "1st Duplicate Check", "2nd Unit Group Run", and so on.
 */
export const TOOL_TABS: Array<{
  tool: ToolRunSummary["tool"];
  tabLabel: string;
  runLabel: string;
}> = [
  { tool: "dedup", tabLabel: "Duplicate Check", runLabel: "Duplicate Check" },
  { tool: "unit_group", tabLabel: "Unit Groups", runLabel: "Unit Group Run" },
  { tool: "tagger", tabLabel: "Template Tagger", runLabel: "Template Tagging" },
];

export function toolLabel(tool: string): string {
  return TOOL_TABS.find((t) => t.tool === tool)?.runLabel ?? tool;
}

export function ordinal(n: number): string {
  const remainder10 = n % 10;
  const remainder100 = n % 100;
  if (remainder10 === 1 && remainder100 !== 11) return `${n}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${n}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function actorLabel(run: ToolRunSummary): string {
  const name = [run.actor_first_name, run.actor_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || run.actor_email || "Unknown user";
}

/** A fallback download name for a run's stored output, used only if the
 * server sends none. */
export function fallbackOutputName(tool: string): string {
  return `${toolLabel(tool).toLowerCase().replace(/\s+/g, "_")}.csv`;
}
