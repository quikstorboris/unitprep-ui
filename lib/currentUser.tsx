"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  logout,
  logoutEverywhere,
  whoAmI,
  type WhoAmI,
} from "@/lib/auth-session";
import { onUnauthorized } from "@/lib/sessionExpiry";

// Named around "the signed-in user", not "session" -- this app already
// uses "session" throughout for *tool* sessions (useSessionPost,
// useSessionAction, cancelSession), a completely separate, pre-existing
// concept from the auth session a passkey/TOTP login issues. Reusing
// that word here would make every future "session" reference in this
// codebase ambiguous.
//
// Module-level cache + listener set, exactly like lib/clients.tsx's
// ClientsProvider, and for the same reason: an effect that calls
// `setState` directly triggers this codebase's `react-hooks/
// set-state-in-effect` lint rule ("calling setState synchronously
// within an effect can trigger cascading renders"). Routing the update
// through `commit()` -> `listeners.forEach(listener => listener())`
// instead of a bare `useState` setter is the sanctioned "sync from an
// external system" shape that rule exempts -- confirmed empirically:
// the naive useState+useEffect version failed lint with exactly that
// rule; this version passes.
//
// Unlike ClientsProvider's sessionStorage (a synchronous external
// system), the "external system" here is a network round trip
// (`whoAmI()`), so there is no synchronous `getSnapshot` read to fall
// back on the way `sessionStorage.getItem` provides -- `checked` exists
// specifically to let a consumer distinguish "haven't asked the server
// yet" from "asked, and nobody is signed in", same distinction
// ClientsProvider's own `hydrated` flag makes for its synchronous case.
let cache: WhoAmI | null = null;
let checked = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function commit(user: WhoAmI | null, isChecked: boolean) {
  cache = user;
  checked = isChecked;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getUserSnapshot(): WhoAmI | null {
  return cache;
}

function getCheckedSnapshot(): boolean {
  return checked;
}

function getServerSnapshot(): null {
  return null;
}

function getCheckedServerSnapshot(): boolean {
  return false;
}

/**
 * Asks the server who, if anyone, is signed in, and commits the answer.
 * Exported (not just used internally by the Provider's own mount effect)
 * so a page can force a re-check after an action the Provider has no
 * other way to learn about -- e.g. immediately after a successful login
 * or invite redemption, before any navigation that would remount the
 * Provider.
 */
export async function refreshCurrentUser(): Promise<void> {
  const result = await whoAmI();
  commit(result.kind === "ok" ? result.data : null, true);
}

// Registered once, at module load -- same singleton reasoning as the
// module-level `cache`/`listeners` above (this module only ever loads
// once per page load). Any fetch wrapper anywhere in the app reporting a
// real 401 flips this shared state to "signed out, checked" immediately,
// which `app/(app)/layout.tsx`'s existing `isSignedOut` effect turns
// into an actual `/login` redirect on the very next render -- see
// `lib/sessionExpiry.ts`'s own doc comment for why this listens there
// instead of every fetch wrapper importing this module directly.
onUnauthorized(() => commit(null, true));

interface CurrentUserContextValue {
  user: WhoAmI | null;
  checked: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}

const CurrentUserContext =
  createContext<CurrentUserContextValue | null>(null);

// Mounted exactly once, wrapping everything in app/layout.tsx -- same
// single-mount convention ClientsProvider documents and for the same
// reason: the module-level cache/listeners above are only ever driven
// by one provider. If a second mount ever becomes necessary, this
// module needs a real per-instance store, not just a comment.
export function CurrentUserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const user = useSyncExternalStore(
    subscribe,
    getUserSnapshot,
    getServerSnapshot
  );

  const isChecked = useSyncExternalStore(
    subscribe,
    getCheckedSnapshot,
    getCheckedServerSnapshot
  );

  useEffect(() => {
    refreshCurrentUser();
  }, []);

  const signOut = async () => {
    // Sign-out is idempotent and never fails from the caller's point of
    // view (see auth_logout.rs) -- commit clears the local user
    // regardless of what the network call actually returned.
    await logout();
    commit(null, true);
  };

  const signOutEverywhere = async () => {
    await logoutEverywhere();
    commit(null, true);
  };

  const value: CurrentUserContextValue = {
    user,
    checked: isChecked,
    refresh: refreshCurrentUser,
    signOut,
    signOutEverywhere,
  };

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);

  if (!ctx) {
    throw new Error(
      "useCurrentUser must be used within a CurrentUserProvider"
    );
  }

  return ctx;
}
