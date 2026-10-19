"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavActive } from "@/components/layout/nav-items";

export function DesktopNavigation() {
  const pathname = usePathname();

  // Signed-out users only see the sign-in page; nothing to navigate to yet.
  if (pathname === "/login") return null;

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 text-sm font-semibold md:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = isNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              isActive ? "bg-emerald-500 text-accent-ink" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
