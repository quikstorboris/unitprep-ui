import type { Metadata } from "next";
import "./globals.css";

import { CurrentUserProvider } from "@/lib/currentUser";

export const metadata: Metadata = {
  title: "UnitPrep",
  description:
    "Storage facility unit-import preparation and validation.",
};

// Deliberately minimal -- CurrentUserProvider is the only thing every
// route needs, including auth pages (login, invite redemption) that
// must NOT get the app shell (LeftNav, ClientsProvider) built for the
// signed-in product experience. That shell now lives in
// app/(app)/layout.tsx, wrapping only the routes that actually need it.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full bg-slate-900 text-slate-100">
        <CurrentUserProvider>{children}</CurrentUserProvider>
      </body>
    </html>
  );
}
