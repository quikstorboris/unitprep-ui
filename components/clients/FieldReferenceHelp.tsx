"use client";

import { useState } from "react";

import { FIELD_PROVENANCE, type MappingStatus, type PsWorkflow } from "@/lib/fieldProvenance";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800";

const statusBadgeClass = (status: MappingStatus) =>
  status === "mapped"
    ? "rounded bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300"
    : "rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300";

/**
 * "Field Reference" help modal -- searchable table of every OO field
 * sourced from Process Street, which workflow/step/field it comes from,
 * plus what a 2026-09-03 field audit found PS captures that OO doesn't
 * show yet. Same search+filter pattern as the QMS Tag Catalog admin
 * page (`admin/client-ops/qms-tags`) -- a small, fully-in-memory table,
 * filtered live rather than round-tripping an API per keystroke.
 * Data lives in `lib/fieldProvenance.ts`, hand-maintained like
 * `client_ops.qms_tag` -- there's no backend endpoint for this, it's
 * static reference content about the mapping code itself.
 */
export default function FieldReferenceHelp() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<PsWorkflow | "">("");
  const [statusFilter, setStatusFilter] = useState<MappingStatus | "all">("all");

  const sections = Array.from(new Set(FIELD_PROVENANCE.map((e) => e.ooSection))).sort();

  const normalizedQuery = query.trim().toLowerCase();
  const visible = FIELD_PROVENANCE.filter((entry) => {
    const matchesQuery =
      !normalizedQuery ||
      entry.ooField.toLowerCase().includes(normalizedQuery) ||
      entry.ooSection.toLowerCase().includes(normalizedQuery) ||
      entry.psFieldLabel.toLowerCase().includes(normalizedQuery) ||
      (entry.psFieldKey?.toLowerCase().includes(normalizedQuery) ?? false) ||
      entry.psStep.toLowerCase().includes(normalizedQuery);
    const matchesSection = !sectionFilter || entry.ooSection === sectionFilter;
    const matchesWorkflow = !workflowFilter || entry.psWorkflow === workflowFilter;
    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;

    return matchesQuery && matchesSection && matchesWorkflow && matchesStatus;
  });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        Field Reference
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-[95vw] flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 p-6 xl:max-w-7xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Field Reference</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Where every OO field on this page comes from in Process Street -- which workflow, which step,
                  which field. Also lists real Pre-App fields PS captures that OO doesn&apos;t show yet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fields…"
                className="min-w-[200px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All sections</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
              <select
                value={workflowFilter}
                onChange={(e) => setWorkflowFilter(e.target.value as PsWorkflow | "")}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All workflows</option>
                <option value="Intake">Intake</option>
                <option value="New Merchant Account">New Merchant Account</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MappingStatus | "all")}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="all">All statuses</option>
                <option value="mapped">Mapped</option>
                <option value="not_yet_mapped">Not Yet Mapped</option>
              </select>
            </div>

            {visible.length === 0 ? (
              <p className="text-sm text-slate-400">No fields match the current search/filters.</p>
            ) : (
              <div className="overflow-y-auto overflow-x-hidden rounded border border-slate-800">
                {/* `table-fixed` + an explicit width per narrow column
                    (the rest split what's left) forces every cell to wrap
                    within its own column instead of the table growing to
                    fit its widest unbreakable string -- several real PS
                    field keys are one long underscore-joined identifier
                    with no spaces at all, which a plain `auto`-layout
                    table can't wrap and used to force a horizontal
                    scrollbar on the whole modal. */}
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="w-[12%] px-3 py-2 font-medium">OO Section</th>
                      <th className="w-[16%] px-3 py-2 font-medium">OO Field</th>
                      <th className="w-[10%] px-3 py-2 font-medium">PS Workflow</th>
                      <th className="w-[14%] px-3 py-2 font-medium">PS Step</th>
                      <th className="px-3 py-2 font-medium">PS Field</th>
                      <th className="w-24 px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry, index) => (
                      <tr key={index} className="border-t border-slate-800 align-top">
                        <td className="break-words px-3 py-2 text-slate-400">{entry.ooSection}</td>
                        <td className="break-words px-3 py-2 font-medium text-slate-100">{entry.ooField}</td>
                        <td className="break-words px-3 py-2 text-slate-400">{entry.psWorkflow}</td>
                        <td className="break-words px-3 py-2 text-slate-400">{entry.psStep}</td>
                        <td className="px-3 py-2">
                          <div className="break-words text-slate-200">{entry.psFieldLabel}</div>
                          {entry.psFieldKey && (
                            <div className="mt-0.5 break-all font-mono text-xs text-slate-500">
                              {entry.psFieldKey}
                            </div>
                          )}
                          {entry.notes && <div className="mt-1 break-words text-xs text-slate-500">{entry.notes}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={statusBadgeClass(entry.status)}>
                            {entry.status === "mapped" ? "Mapped" : "Not Yet Mapped"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
