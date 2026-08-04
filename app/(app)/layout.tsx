"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import LeftNav from "@/components/nav/LeftNav";
import { ClientsProvider } from "@/lib/clients";
import { useCurrentUser } from "@/lib/currentUser";

// The signed-in product shell -- everything under this route group gets
// the left nav and the (session-scoped, not-yet-persisted) client
// registry. Auth pages (app/login, app/invites/[token],
// app/onboarding/totp) sit outside this group deliberately, so they
// render with only the root layout's bare CurrentUserProvider and none
// of this chrome.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { user, checked } = useCurrentUser();

  // Everyone must have a confirmed TOTP credential before reaching
  // anything in this shell -- see app/onboarding/totp's own doc comment
  // for why. Checked once here, at the route-group boundary, rather than
  // per-page, so a new page added under this group gets the guard for
  // free. Signed-out visitors are untouched (`user` is null) -- that's
  // proxy.ts's job, not this one's.
  const needsTotpOnboarding = checked && !!user && !user.totp_enrolled;

  useEffect(() => {
    if (needsTotpOnboarding) {
      router.replace("/onboarding/totp");
    }
  }, [needsTotpOnboarding, router]);

  if (needsTotpOnboarding) {
    // Avoid rendering the real shell (and the data fetches its children
    // would kick off) for the instant before the redirect above lands.
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  return (
    <ClientsProvider>
      <LeftNav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </ClientsProvider>
  );
}
