"use client";

import { useState } from "react";

import { totpDisable } from "@/lib/auth";
import { useCurrentUser } from "@/lib/currentUser";
import TotpEnrollForm from "@/components/auth/TotpEnrollForm";

const dangerButtonClass =
  "rounded bg-red-900 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

type Mode = "status" | "confirming-disable";

export default function AccountPage() {
  const { user, checked, refresh } = useCurrentUser();

  const [mode, setMode] = useState<Mode>("status");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnrolled() {
    setMode("status");
    await refresh();
  }

  async function handleDisable() {
    setError(null);
    setPending(true);

    const result = await totpDisable();
    setPending(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setMode("status");
    await refresh();
  }

  if (!checked) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  // There's no route gating in front of this page yet (see proxy.ts),
  // so a signed-out visitor can land here directly rather than only via
  // the left nav -- send them to sign in instead of showing a page that
  // has nothing to display.
  if (!user) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-400">
          <a href="/login" className="text-blue-400 hover:underline">
            Sign in
          </a>{" "}
          to manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-start justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-100">Account</h1>
        <p className="mb-6 text-sm text-slate-400">
          Signed in as a <span className="text-slate-300">{user.role}</span>.
        </p>

        <h2 className="mb-2 text-sm font-semibold text-slate-200">
          Authenticator app
        </h2>

        {mode === "status" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-400">
              {user.totp_enrolled
                ? "Set up and required to confirm sensitive actions, like replacing a passkey. It isn't a way to sign in — that's always your passkey."
                : "Required to confirm sensitive actions, like replacing a passkey. It isn't a second way to sign in — that's always your passkey."}
            </p>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            {user.totp_enrolled ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("confirming-disable");
                }}
                className={dangerButtonClass}
              >
                Remove authenticator app
              </button>
            ) : (
              <TotpEnrollForm onEnrolled={handleEnrolled} />
            )}
          </div>
        )}

        {mode === "confirming-disable" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-400">
              Without it, sensitive actions like replacing a passkey won&apos;t
              be available until you set it up again. Continue?
            </p>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={handleDisable}
              className={dangerButtonClass}
            >
              {pending ? "Removing…" : "Yes, remove it"}
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("status");
              }}
              className={linkButtonClass}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
