"use client";

import { useState } from "react";

import { useCurrentUser } from "@/lib/currentUser";
import { passkeyReverify } from "@/lib/auth";
import TotpEnrollForm from "@/components/auth/TotpEnrollForm";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

type Mode = "status" | "updating";

export default function AccountPage() {
  const { user, checked, refresh } = useCurrentUser();

  const [mode, setMode] = useState<Mode>("status");
  const [reverifying, setReverifying] = useState(false);
  const [reverifyError, setReverifyError] = useState<string | null>(null);

  async function handleEnrolled() {
    setMode("status");
    await refresh();
  }

  // Replacing TOTP requires proving the *other* factor first -- a
  // passkey assertion -- the same way replacing a passkey already
  // requires a TOTP code. Only gates re-enrolment (an account that
  // already has a confirmed factor); first-time setup below has nothing
  // yet for this to protect.
  async function handleUpdateAuthenticatorClick() {
    setReverifying(true);
    setReverifyError(null);

    const result = await passkeyReverify();

    setReverifying(false);

    if (result.kind !== "ok" || !result.data.verified) {
      setReverifyError(
        result.kind === "ok"
          ? "Passkey verification did not complete."
          : result.message
      );
      return;
    }

    setMode("updating");
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
          Signed in as{" "}
          <span className="text-slate-300">{user.roles.join(", ")}</span>.
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

            {user.totp_enrolled ? (
              // No "remove" option -- TOTP is step-up-only, never a login
              // factor, so there's no security upside to an account
              // having zero step-up factor, only a self-inflicted-lockout
              // risk (stuck until you re-enrol before any step-up-gated
              // action, like adding a passkey, is available again). Update
              // replaces the factor; it never removes one with nothing to
              // replace it. The existing authenticator keeps working for
              // the entire re-enrolment process -- it's only replaced once
              // the new one is confirmed.
              <button
                type="button"
                onClick={handleUpdateAuthenticatorClick}
                disabled={reverifying}
                className={primaryButtonClass}
              >
                {reverifying
                  ? "Verify your passkey…"
                  : "Update authenticator app"}
              </button>
            ) : (
              <TotpEnrollForm onEnrolled={handleEnrolled} />
            )}

            {reverifyError && (
              <p className="text-sm text-red-400">{reverifyError}</p>
            )}
          </div>
        )}

        {mode === "updating" && (
          <TotpEnrollForm
            onEnrolled={handleEnrolled}
            onCancel={() => setMode("status")}
          />
        )}
      </div>
    </div>
  );
}
