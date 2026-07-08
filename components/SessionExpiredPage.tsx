"use client";

interface SessionExpiredPageProps {
  onHome: () => void;
}

/**
 * Shown whenever a session-scoped request comes back 404 — the backend's
 * single "session not found" signal, which covers both an expired
 * session (10-minute idle timeout) and an invalid/stale id. Rendered in
 * place of whatever page triggered it, so a stale tab never shows a
 * confusing all-zeros result instead of an explanation.
 */
export default function SessionExpiredPage({
  onHome,
}: SessionExpiredPageProps) {
  return (
    <div className="mx-auto max-w-md text-center text-slate-100">
      <h1 className="mb-4 text-3xl font-bold">
        Session Expired
      </h1>

      <p className="mb-8 text-slate-300">
        This session could not be found —
        it may have expired after a period
        of inactivity. Please start over.
      </p>

      <button
        onClick={onHome}
        className="rounded bg-blue-600 px-6 py-3"
      >
        Home
      </button>
    </div>
  );
}
