type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Fired by every fetch wrapper the instant it sees a real 401 -- "the
 * backend no longer recognizes this session," not a tool-session 404
 * ("this dedup/tagger/etc. run is gone", a different, lower-stakes
 * condition several of those same wrappers also fold into their own
 * "sessionExpired" state). `lib/currentUser.tsx`'s `CurrentUserProvider`
 * is the one subscriber, flipping the shared signed-in state to null so
 * `app/(app)/layout.tsx`'s existing redirect-to-`/login` effect fires on
 * the very next render, wherever the user happens to be -- see that
 * file's own comments for why nothing did this before.
 *
 * Deliberately has no imports of its own. `lib/auth-shared.ts` (which
 * `lib/auth-session.ts` -- imported by `lib/currentUser.tsx` -- itself
 * depends on) needs to call this too; importing `currentUser.tsx`
 * directly from there would be a real cycle
 * (currentUser -> auth-session -> auth-shared -> currentUser). Every
 * other fetch wrapper (dropbox, clientOps, useSessionAction,
 * useSessionPost, useFileUploadAction) calls this same function for the
 * same reason: none of them should need to know how the signed-in state
 * is actually stored.
 */
export function notifyUnauthorized(): void {
  listeners.forEach((listener) => listener());
}

/** Registered once by `CurrentUserProvider` -- see this module's own doc
 * comment above. */
export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
