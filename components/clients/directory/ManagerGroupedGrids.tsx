"use client";

import type { ReactNode } from "react";

import type { ManagerGroup } from "@/lib/groupCompaniesByManager";

/** One titled grid per implementation manager ("Unassigned" last). */
export default function ManagerGroupedGrids({
  groups,
  renderGrid,
  className = "",
}: {
  groups: ManagerGroup[];
  renderGrid: (companies: ManagerGroup["companies"]) => ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} flex flex-col gap-8`.trim()}>
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-3 text-lg font-semibold text-slate-200">
            {group.label === "Unassigned" ? "Unassigned" : `Implementation Manager: ${group.label}`}
          </h3>
          {renderGrid(group.companies)}
        </section>
      ))}
    </div>
  );
}
