"use client";

import { useState, type FormEvent } from "react";

import { totpStepUp } from "@/lib/auth-session";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

interface StepUpPromptProps {
  /** Called once the code is accepted and the session is cleared for use. */
  onVerified: () => void | Promise<void>;
  /** Lets the person leave instead of entering a code (e.g. no authenticator to hand). */
  onSignOut: () => void | Promise<void>;
}

/**
 * The prompt for a session that signed in from a browser AND network the
 * account has not used before. The backend lets that sign-in happen but
 * refuses every request except `whoami` and `/auth/totp/step-up` until a
 * current authenticator code proves it is really them (see
 * `unitprep-api`'s `auth_login::assess_login_risk` and
 * `AuthenticatedUser`'s step-up gate). Without this prompt that state
 * looked like an app where everything failed with a 403 and nowhere to
 * type the code.
 *
 * Shown by the signed-in shell in place of the app (not as a route), so
 * nothing underneath fires requests that are guaranteed to be refused.
 */
export default function StepUpPrompt({ onVerified, onSignOut }: StepUpPromptProps) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = code.trim();
    if (!trimmed) return;

    setPending(true);
    const result = await totpStepUp(trimmed);

    if (result.kind !== "ok") {
      setPending(false);
      setError(result.message);
      return;
    }

    await onVerified();
    setPending(false);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-100">Confirm it&apos;s you</h1>
          <p className="text-sm text-slate-400">
            You signed in from a browser and network we haven&apos;t seen for this
            account. Enter the 6-digit code from your authenticator app to
            continue.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          6-digit code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClass}
            placeholder="123456"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button type="submit" disabled={pending || !code.trim()} className={primaryButtonClass}>
            {pending ? "Checking…" : "Continue"}
          </button>
          <button type="button" onClick={() => void onSignOut()} className={linkButtonClass}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
