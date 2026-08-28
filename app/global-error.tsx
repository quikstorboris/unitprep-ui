"use client";

import { useEffect } from "react";

/**
 * The last-resort boundary -- catches an error in the ROOT layout
 * itself (app/layout.tsx), which error.tsx cannot (that one only covers
 * what renders *inside* the root layout). Must render its own
 * <html>/<body> since triggering this means the root layout itself is
 * gone.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `Unhandled root-layout error${error.digest ? ` (${error.digest})` : ""}:`,
      error
    );
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-slate-900 text-slate-100">
        <div className="mx-auto max-w-md text-center">
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
      </body>
    </html>
  );
}
