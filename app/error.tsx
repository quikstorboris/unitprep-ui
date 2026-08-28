"use client";

import { useEffect } from "react";

/**
 * Next.js App Router error boundary for everything under the root
 * layout. Before this existed, a render-time throw anywhere fell
 * straight through to Next's default blank error page with nothing
 * recorded anywhere except a devtools console nobody but that one user
 * has open. See global-error.tsx for the root-layout-itself case this
 * doesn't cover.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `Unhandled render error${error.digest ? ` (${error.digest})` : ""}:`,
      error
    );
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center text-slate-100">
        <h1 className="mb-4 text-3xl font-bold">
          Something went wrong
        </h1>

        <p className="mb-8 text-slate-300">
          An unexpected error occurred.
          {error.digest && (
            <>
              {" "}
              Reference:{" "}
              <span className="font-mono">
                {error.digest}
              </span>
            </>
          )}
        </p>

        <button
          onClick={reset}
          className="rounded bg-blue-600 px-6 py-3"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
