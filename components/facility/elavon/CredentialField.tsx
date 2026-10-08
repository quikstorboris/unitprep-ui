"use client";

import { useState } from "react";

/** Fixed-width placeholder for a masked credential -- deliberately not
 * shaped to the real value's length (unlike `PartyCard`'s SSN mask,
 * which has one fixed real-world shape), so the masked state never
 * hints at how long the underlying PIN/Password actually is. */
const MASKED_CREDENTIAL = "••••••••••••";

/**
 * One QMS/pinpad credential row, with the same "revealable on demand"
 * Show/Hide toggle `PartyCard`'s own SSN field uses -- for the two
 * genuine secrets (PIN/Password, QSS API Pin). `revealable={false}`
 * (Account ID, User ID, Pinpad User ID) skips the toggle entirely and
 * just shows the value plainly, same as any other `DetailSection` field.
 */
export function CredentialField({
  label,
  value,
  revealable = true,
}: {
  label: string;
  value: string | null;
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className="flex items-center gap-2 break-all">
        {!value ? (
          "—"
        ) : !revealable ? (
          <span>{value}</span>
        ) : (
          <>
            <span>{revealed ? value : MASKED_CREDENTIAL}</span>
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              className="shrink-0 text-xs text-blue-400 hover:underline"
            >
              {revealed ? "Hide" : "Show"}
            </button>
          </>
        )}
      </dd>
    </div>
  );
}
