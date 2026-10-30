"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary for the signed-in pages. Without it a render-time throw in
 * any page fell through to the root `app/error.tsx`, which replaces the
 * whole screen, left nav included, so the user had nothing to click but
 * "Try again". This one sits inside `app/(app)/layout.tsx`, so the nav
 * stays, the failure is confined to the page area, and there is a way back
 * to Clients. Reported to Sentry like the root boundary.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(`Unhandled render error${error.digest ? ` (${error.digest})` : ""}:`, error);
  }, [error]);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-md text-center text-slate-100">
        <h1 className="mb-4 text-2xl font-bold">Something went wrong on this page</h1>

        <p className="mb-6 text-slate-300">
          An unexpected error occurred.
          {error.digest && (
            <>
              {" "}
              Reference: <span className="font-mono">{error.digest}</span>
            </>
          )}
        </p>

        <div className="flex items-center justify-center gap-4">
          <button onClick={reset} className="rounded bg-blue-600 px-5 py-2">
            Try again
          </button>
          <Link href="/clients" className="text-blue-400 hover:underline">
            Back to Clients
          </Link>
        </div>
      </div>
    </main>
  );
}
