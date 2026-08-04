import { describe, expect, it } from "vitest";

import { stashDedupReport, takeDedupReport } from "./dedupReportCache";

function dedupReport() {
  return {
    total_rows: 10,
    unique_tenants: 8,
    multi_unit_tenants: 2,
    flagged_groups: [],
    typo_variant_candidates: [],
    related_tenant_candidates: [],
  };
}

describe("dedupReportCache", () => {
  it("returns the stashed report for a matching sessionId", () => {
    const report = dedupReport();
    stashDedupReport("s1", report);

    expect(takeDedupReport("s1")).toEqual(report);
  });

  it("is a miss for a sessionId that was never stashed", () => {
    expect(takeDedupReport("never-stashed")).toBeUndefined();
  });

  it("is a miss when the stashed report belongs to a different sessionId", () => {
    stashDedupReport("s1", dedupReport());

    expect(takeDedupReport("s2")).toBeUndefined();
  });

  it("is single-use -- a second read of the same sessionId misses", () => {
    const report = dedupReport();
    stashDedupReport("s1", report);

    expect(takeDedupReport("s1")).toEqual(report);
    expect(takeDedupReport("s1")).toBeUndefined();
  });
});
