import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { AuthHeaderButton } from "@/components/layout/auth-header-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Collaborative workout tracking for groups and workout partners.",
  applicationName: "Gym Tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gym Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-zinc-50 pb-20 selection:bg-zinc-800`}
      >
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pt-4 pb-20 md:pb-8">
          <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-lg font-bold tracking-tight hover:text-emerald-400 transition-colors">
                GYM TRACKER
              </Link>
              {/* Desktop Navigation Links */}
              <nav className="hidden md:flex items-center space-x-4 text-sm font-medium">
                <Link href="/" className="text-zinc-200 hover:text-white transition-colors">Workout</Link>
                <Link href="/routines" className="text-zinc-400 hover:text-white transition-colors">Routines</Link>
                <Link href="/group" className="text-zinc-400 hover:text-white transition-colors">Group</Link>
                <Link href="/analytics" className="text-zinc-400 hover:text-white transition-colors">Analytics</Link>
                <Link href="/settings" className="text-zinc-400 hover:text-white transition-colors">Settings</Link>
              </nav>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <Suspense fallback={<div className="h-7 w-16 animate-pulse rounded bg-zinc-800" />}>
                <AuthHeaderButton />
              </Suspense>
            </div>
          </header>
          <main className="flex-1 py-6">{children}</main>
        </div>
        {/* Mobile Navigation (Hidden on md/desktop screens) */}
        <div className="md:hidden">
          <MobileNavigation />
        </div>
      </body>
    </html>
  );
}
