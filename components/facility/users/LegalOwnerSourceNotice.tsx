"use client";

import type { LegalOwnerSource } from "@/lib/clientsDetail";

/**
 * Shown above the roster when this facility has no Merchant Account form
 * with owners of its own, so the Legal Owner checkmarks were worked out
 * from a sister facility's form instead. Says so plainly: a checkmark
 * that quietly came from somewhere else would be misleading. Each
 * facility will eventually have its own form; until then this is the
 * same company's best available answer.
 */
export function LegalOwnerSourceNotice({ source }: { source: LegalOwnerSource | null }) {
  if (!source) return null;

  return (
    <p className="mb-3 rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
      Legal Owner checkmarks come from <strong className="text-slate-300">{source.facility_name}</strong>
      &apos;s Merchant Account form. This facility has no Merchant Account form with owners of its own yet.
    </p>
  );
}
