"use client";

import { useState } from "react";

import { formatDateOnly, formatPhone } from "@/lib/format";

/**
 * One Merchant Account party (owner/signer) card -- shared between the
 * Company page's Owner(s) Information section (every facility's owners
 * in one list) and a Facility page's own Elavon tab (just this
 * facility's), so the same formatting/masking fixes apply in both
 * places at once instead of drifting (2026-09-03: phone as
 * xxx-xxx-xxxx, DOB as mm-dd-yyyy with no time, SSN masked behind a
 * Show/Hide toggle -- previously always shown in plaintext).
 */
export interface PartyCardData {
  display_name: string | null;
  title: string | null;
  ownership_percent: number | null;
  email: string | null;
  phone: string | null;
  ssn: string | null;
  dob: string | null;
  home_address_line1: string | null;
  home_city: string | null;
  home_state_or_province: string | null;
  home_postal_code: string | null;
}

function maskSsn(ssn: string): string {
  const digits = ssn.replace(/\D/g, "");
  if (digits.length !== 9) return "•".repeat(ssn.length);
  return `•••-••-${digits.slice(5)}`;
}

export default function PartyCard({ party, badge }: { party: PartyCardData; badge: string }) {
  const [ssnRevealed, setSsnRevealed] = useState(false);

  return (
    <div className="rounded border border-slate-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-100">{party.display_name || "(unnamed)"}</span>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
          {badge}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">Title</dt>
          <dd>{party.title || "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">Ownership %</dt>
          <dd>{party.ownership_percent ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">Email</dt>
          <dd>{party.email || "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">Phone</dt>
          <dd>{party.phone ? formatPhone(party.phone) : "—"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">SSN</dt>
          <dd className="flex items-center gap-2">
            {party.ssn ? (
              <>
                <span>{ssnRevealed ? party.ssn : maskSsn(party.ssn)}</span>
                <button
                  type="button"
                  onClick={() => setSsnRevealed((prev) => !prev)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {ssnRevealed ? "Hide" : "Show"}
                </button>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-slate-400">Date of Birth</dt>
          <dd>{party.dob ? formatDateOnly(party.dob) : "—"}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-slate-400">Home Address</dt>
          <dd>
            {[party.home_address_line1, party.home_city, party.home_state_or_province, party.home_postal_code]
              .filter(Boolean)
              .join(", ") || "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
