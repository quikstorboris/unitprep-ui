import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
