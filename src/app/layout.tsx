import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
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
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-4">
          <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight">GYM TRACKER</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-zinc-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Ready</span>
            </div>
          </header>
          <main className="flex-1 py-4">{children}</main>
        </div>
        <MobileNavigation />
      </body>
    </html>
  );
}
