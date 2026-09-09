"use client";

import { useState } from "react";

const iconClass = "h-4 w-4";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={iconClass} aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={iconClass} aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M7.4 7.5C4.7 9.1 3 12 3 12s3.5 7 10.5 7c1.9 0 3.5-.5 4.8-1.2M17.2 16.4C20 14.7 21.5 12 21.5 12s-.5-1-1.6-2.4M12 5c.7 0 1.4.06 2 .17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={iconClass} aria-hidden="true">
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M4 16V4a2 2 0 0 1 2-2h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const buttonClass =
  "shrink-0 rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200";

/**
 * A masked, revealable, copyable text field for an integration secret
 * (API key, app secret, refresh token, ...). Shared by every admin
 * Integrations settings page -- Dropbox and Process Street both show
 * real, currently-effective secret values (see `lib/dropboxSettings.ts`/
 * `lib/processStreetSettings.ts`'s own doc comments on why these pages
 * carry real values rather than a "configured: yes/no" flag), so both
 * need the identical masked/reveal/copy affordance rather than
 * reimplementing it per field.
 */
export function SecretField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) --
      // nothing actionable for a convenience button beyond leaving it as
      // "Copy"; no error worth surfacing.
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-slate-300">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
          title={revealed ? "Hide" : "Show"}
          className={buttonClass}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          title="Copy"
          disabled={!value}
          className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <CopyIcon />
        </button>
      </div>
      {copied ? (
        <span className="text-xs text-green-400">Copied.</span>
      ) : hint ? (
        <span className="text-xs text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}
