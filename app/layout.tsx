import type { Metadata } from "next";
import "./globals.css";

import LeftNav from "@/components/nav/LeftNav";
import { ClientsProvider } from "@/lib/clients";

export const metadata: Metadata = {
  title: "UnitPrep",
  description:
    "Storage facility unit-import preparation and validation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full bg-slate-900 text-slate-100">
        <ClientsProvider>
          <LeftNav />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </ClientsProvider>
      </body>
    </html>
  );
}
