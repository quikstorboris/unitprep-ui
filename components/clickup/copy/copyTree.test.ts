import { describe, expect, it } from "vitest";

import type { CopyPairRow, CopyTaskInfo } from "@/lib/clickupCopy";
import { buildCopyGroups, descendantKeys } from "./copyTree";

function task(id: string, parentId: string | null = null): CopyTaskInfo {
  return {
    task_id: id,
    name: id,
    parent_id: parentId,
    parent_name: null,
    status: "to do",
    is_finished: false,
    url: "",
    scope: null,
  };
}

function row(id: string, phase: string, parentId: string | null = null): CopyPairRow {
  return { phase, source: task(id, parentId), target: null, alternatives: [] };
}

describe("buildCopyGroups", () => {
  it("lists Set Up before Migration whatever order the rows arrive in", () => {
    const groups = buildCopyGroups([row("m1", "Migration"), row("s1", "Set Up")]);

    expect(groups.map((group) => group.phase)).toEqual(["Set Up", "Migration"]);
  });

  it("treats the two spellings of Set Up as the same position", () => {
    const groups = buildCopyGroups([row("m1", "Migration"), row("s1", "Setup")]);

    expect(groups.map((group) => group.phase)).toEqual(["Setup", "Migration"]);
  });

  it("nests subtasks under their mid-level task, leaving only that task at the top", () => {
    const groups = buildCopyGroups([
      row("mid", "Set Up"),
      row("sub1", "Set Up", "mid"),
      row("sub2", "Set Up", "mid"),
      row("other", "Set Up"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].nodes.map((node) => node.row.source.task_id)).toEqual(["mid", "other"]);
    expect(groups[0].nodes[0].children.map((node) => node.row.source.task_id)).toEqual(["sub1", "sub2"]);
  });

  it("keeps a task at the top when its parent is not one of the rows", () => {
    const groups = buildCopyGroups([row("orphan", "Set Up", "somewhere-else")]);

    expect(groups[0].nodes.map((node) => node.row.source.task_id)).toEqual(["orphan"]);
  });

  it("does not hide a task under a parent in a different phase", () => {
    const groups = buildCopyGroups([row("parent", "Set Up"), row("child", "Migration", "parent")]);

    const migration = groups.find((group) => group.phase === "Migration");
    expect(migration?.nodes.map((node) => node.row.source.task_id)).toEqual(["child"]);
  });

  it("collects every nested row key below a node", () => {
    const [group] = buildCopyGroups([
      row("a", "Set Up"),
      row("b", "Set Up", "a"),
      row("c", "Set Up", "b"),
    ]);

    expect(descendantKeys(group.nodes[0])).toEqual(["b", "c"]);
  });
});
