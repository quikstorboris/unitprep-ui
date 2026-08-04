"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";
import TotpEnrollForm from "@/components/auth/TotpEnrollForm";

/**
 * A mandatory step between signing up and reaching the app -- everyone
 * gets an authenticator app enrolled before their account is otherwise
 * usable, so nobody discovers the requirement for the first time only
 * when a sensitive action blocks them mid-task. See the `(app)` layout's
 * own redirect guard, which sends anyone signed in without a confirmed
 * TOTP credential back here regardless of how they arrived.
 *
 * Sits outside the `(app)` route group deliberately -- no left nav, no
 * "Account" link, no way to navigate around this. It's the one page in
 * the app with nothing to skip to.
 */
export default function TotpOnboardingPage() {
  const router = useRouter();
  const { user, checked, refresh } = useCurrentUser();

  useEffect(() => {
    if (!checked) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.totp_enrolled) {
      router.replace("/clients");
    }
  }, [checked, user, router]);

  async function handleEnrolled() {
    await refresh();
    router.replace("/clients");
  }

  if (!checked || !user || user.totp_enrolled) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-100">
          One more thing
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Set up an authenticator app now. This isn&apos;t a way to sign in —
          your passkey is always how you do that — it&apos;s required to
          confirm sensitive actions later, like replacing a passkey.
        </p>

        <TotpEnrollForm onEnrolled={handleEnrolled} autoStart />
      </div>
    </div>
  );
}
