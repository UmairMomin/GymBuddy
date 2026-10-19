import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { DesktopNavigation } from "@/components/layout/desktop-navigation";
import { UserMenu } from "@/components/layout/user-menu";
import { ServiceWorkerRegister } from "@/features/notifications/components/service-worker-register";
import { InviteBanner } from "@/features/workout/components/invite-banner";
import { NetworkStatusIndicator } from "@/components/layout/network-status-indicator";
import { ThemeScript, ThemeSync } from "@/components/layout/theme-script";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Track your training week and log workouts live with a friend.",
  applicationName: "Gym Tracker",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gym Tracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="dark" data-accent="lime" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} min-h-screen bg-zinc-950 text-zinc-50 antialiased selection:bg-emerald-500 selection:text-accent-ink`}
      >
        <ThemeSync />
        <ServiceWorkerRegister />
        <NetworkStatusIndicator />
        <Suspense fallback={null}>
          <InviteBanner />
        </Suspense>
        <div className="pt-safe">
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pt-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
            <header className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="font-display text-2xl font-extrabold uppercase leading-none tracking-wide transition-colors hover:text-emerald-400"
                >
                  Gym<span className="text-emerald-400">Tracker</span>
                </Link>
                <Suspense fallback={null}>
                  <DesktopNavigation />
                </Suspense>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Suspense fallback={<div className="h-11 w-11 animate-pulse rounded-full bg-zinc-800" />}>
                  <UserMenu />
                </Suspense>
              </div>
            </header>
            <main className="flex-1 py-5 md:py-6">{children}</main>
          </div>
        </div>
        {/* Mobile Navigation (hidden on md/desktop) */}
        <div className="md:hidden">
          <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-zinc-800 bg-zinc-950" />}>
            <MobileNavigation />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
