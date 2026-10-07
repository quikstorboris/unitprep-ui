import type { CopyPairRow } from "@/lib/clickupCopy";

/** One row of the dialog with the rows nested under it. */
export interface CopyNode {
  row: CopyPairRow;
  children: CopyNode[];
}

/** A phase's rows as a tree. */
export interface CopyGroup {
  phase: string;
  nodes: CopyNode[];
}

/** Phases are shown in the order the template lists them, not alphabetical
 * (Migration would otherwise precede Set Up). Compared by letters and
 * digits only, so "Set Up" and "Setup" are the same phase. Anything else
 * sorts after. */
const PHASE_ORDER = ["setup", "migration"];

function phaseRank(phase: string): number {
  const rank = PHASE_ORDER.indexOf(phase.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return rank === -1 ? PHASE_ORDER.length : rank;
}

/**
 * Groups the rows by phase and nests each task under its parent task when
 * the parent is itself a row. A task whose parent is not a row (a
 * top-level task, or one whose parent is outside Set Up/Migration) sits at
 * the top of its group.
 *
 * The dialog shows only those top-level ("mid-level") tasks, collapsed;
 * their subtasks appear when expanded -- so a long list stays readable.
 */
export function buildCopyGroups(rows: CopyPairRow[]): CopyGroup[] {
  const nodeById = new Map<string, CopyNode>();
  for (const row of rows) nodeById.set(row.source.task_id, { row, children: [] });

  const groups = new Map<string, CopyGroup>();
  for (const row of rows) {
    const node = nodeById.get(row.source.task_id)!;
    const parent = row.source.parent_id ? nodeById.get(row.source.parent_id) : undefined;

    // A parent in a different phase would hide the child under the wrong
    // heading, so only same-phase parents adopt.
    if (parent && parent.row.phase === row.phase) {
      parent.children.push(node);
      continue;
    }

    const group = groups.get(row.phase) ?? { phase: row.phase, nodes: [] };
    group.nodes.push(node);
    groups.set(row.phase, group);
  }

  return [...groups.values()].sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase));
}

/** Every row key at or below `node`. */
export function descendantKeys(node: CopyNode): string[] {
  return node.children.flatMap((child) => [child.row.source.task_id, ...descendantKeys(child)]);
}
