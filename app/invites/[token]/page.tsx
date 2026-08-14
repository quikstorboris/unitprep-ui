"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

import { registerPasskey, UNSUPPORTED_BROWSER_MESSAGE } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

/**
 * Doubles as the recovery re-enrollment page -- the backend doesn't
 * distinguish "first invite" from "recovery reissue" at the registration
 * layer, both are just an invite token that resolves to an eligible
 * account (see auth.resolve_invite_registration), so one page correctly
 * serves both cases with no branching needed here.
 */
export default function RedeemInvitePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { user, checked, refresh, signOut } = useCurrentUser();

  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOutAndContinue() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await registerPasskey(token);
    setPending(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    await refresh();
    router.replace("/clients");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-100">
          Set up your account
        </h1>

        {!checked ? (
          <p className="text-sm text-slate-400">Checking your session…</p>
        ) : user ? (
          // A signed-in caller's OWN session wins over this invite token
          // at the backend -- redeeming while signed in as someone else
          // would silently add a passkey to the CURRENT account instead
          // of the invited one, with no error to signal it went wrong.
          // Forcing a sign-out first is what makes the token actually
          // apply to the account it names.
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-400">
              You&apos;re already signed in on this browser. This invite
              is for a different account — sign out first to redeem it
              for the right one.
            </p>

            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOutAndContinue}
              className={primaryButtonClass}
            >
              {signingOut ? "Signing out…" : "Sign out and continue"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-slate-400">
              Create the passkey that will sign you in from now on —
              there&apos;s no password to set.
            </p>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || !token}
              className={primaryButtonClass}
            >
              {pending ? "Waiting for your passkey…" : "Create your passkey"}
            </button>

            {error === UNSUPPORTED_BROWSER_MESSAGE && (
              <p className="text-xs text-slate-500">
                Passkeys need a current version of Chrome, Edge, or
                Safari.
              </p>
            )}

            <a href="/login" className={linkButtonClass}>
              Already set up? Sign in instead
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
