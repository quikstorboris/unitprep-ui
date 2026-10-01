"use client";

import { useState } from "react";

import type { DedupFileRequirementsResponse } from "@/types/api";

interface DedupRequirementsPanelProps {
  requirements: DedupFileRequirementsResponse | null;
  loading: boolean;
  error: string | null;
  /** PMS the folder scan detected -- the vendor shown until the user picks one. */
  detectedPms: string | null;
}

/**
 * "Files required for deduplication" -- informational, always visible
 * (including before any folder is chosen, which is its main job): per
 * PMS vendor, which reports to export and how.
 */
export function DedupRequirementsPanel({
  requirements,
  loading,
  error,
  detectedPms,
}: DedupRequirementsPanelProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [lastDetected, setLastDetected] = useState(detectedPms);

  // A new scan's detected PMS replaces an earlier manual pick.
  if (detectedPms !== lastDetected) {
    setLastDetected(detectedPms);
    setPicked(null);
  }

  const vendors = requirements?.vendors ?? [];
  const has = (pms: string | null) => !!pms && vendors.some((v) => v.pms === pms);
  const selectedPms = has(picked) ? picked : has(detectedPms) ? detectedPms : vendors[0]?.pms;
  const vendor = vendors.find((v) => v.pms === selectedPms);

  return (
    <section
      aria-labelledby="dedup-requirements-heading"
      className="rounded border border-slate-700 p-6"
    >
      <h2 id="dedup-requirements-heading" className="mb-4 text-xl font-semibold">
        Files required for deduplication
      </h2>

      {loading && <div className="text-sm text-slate-400">Loading requirements…</div>}

      {error && <div className="text-sm text-amber-400">{error}</div>}

      {vendor && (
        <>
          <label htmlFor="dedup-requirements-vendor" className="mb-1 block text-xs text-slate-400">
            Management software
          </label>
          <select
            id="dedup-requirements-vendor"
            value={vendor.pms}
            onChange={(e) => setPicked(e.target.value)}
            className="mb-4 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {vendors.map((v) => (
              <option key={v.pms} value={v.pms}>
                {v.pms}
              </option>
            ))}
          </select>

          <ul className="space-y-4">
            {vendor.formats.map((format) => (
              <li key={format.name}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-200">{format.report_name}</span>
                  <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                    {format.role === "primary" ? "Primary" : "Supporting"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-400">{format.guidance}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && !error && vendors.length === 0 && (
        <div className="text-sm text-slate-400">No requirements available.</div>
      )}
    </section>
  );
}
