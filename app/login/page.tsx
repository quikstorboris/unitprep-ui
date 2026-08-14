"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { loginBegin, loginFinish, UNSUPPORTED_BROWSER_MESSAGE } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function LoginPage() {
  const router = useRouter();
  const { user, checked, refresh } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Someone already signed in navigating (or being redirected) back to
  // /login has nothing to do here -- send them on rather than show a
  // form that would just fail confusingly ("why can't I sign in?").
  // Gated on `checked` so this doesn't fire on the render before the
  // initial whoAmI() call has resolved.
  useEffect(() => {
    if (checked && user) {
      router.replace("/clients");
    }
  }, [checked, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setPending(true);
    setPendingLabel("Starting sign-in…");

    const begin = await loginBegin(trimmedEmail);

    if (begin.kind !== "ok") {
      setPending(false);
      setError(begin.message);
      return;
    }

    setPendingLabel("Waiting for your passkey…");
    const finish = await loginFinish(begin.data);
    setPending(false);

    if (finish.kind !== "ok") {
      setError(finish.message);
      return;
    }

    await refresh();
    router.replace("/clients");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-100">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          UnitPrep uses a passkey — there&apos;s no password to remember
          or reset.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Email
            <input
              type="email"
              required
              autoFocus
              autoComplete="username webauthn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@quikstor.com"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !email.trim()}
            className={primaryButtonClass}
          >
            {pending ? pendingLabel : "Sign in with passkey"}
          </button>
        </form>

        {error === UNSUPPORTED_BROWSER_MESSAGE && (
          <p className="mt-4 text-xs text-slate-500">
            Passkeys need a current version of Chrome, Edge, or Safari.
          </p>
        )}

        <p className="mt-6 text-xs text-slate-500">
          Lost your passkey? Ask an administrator to send you a new setup
          link — there&apos;s no self-service recovery.
        </p>
      </div>
    </div>
  );
}
