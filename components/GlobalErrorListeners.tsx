"use client";

import { useEffect } from "react";

/**
 * Safety net for whatever doesn't go through this app's established
 * non-throwing Result pattern (lib/api.ts's {kind, message} shape) --
 * a bug in a fire-and-forget async callback, or a throw outside React's
 * render tree that error.tsx/global-error.tsx can't catch. Renders
 * nothing; just makes sure a bug like that leaves a trace instead of
 * vanishing the moment devtools aren't open.
 */
export default function GlobalErrorListeners() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      console.error("Uncaught error:", event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener(
        "unhandledrejection",
        onUnhandledRejection
      );
    };
  }, []);

  return null;
}
