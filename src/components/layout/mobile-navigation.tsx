"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavActive } from "@/components/layout/nav-items";

export function MobileNavigation() {
  const pathname = usePathname();

  // Signed-out users only see the sign-in page; nothing to navigate to yet.
  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 pb-safe backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2 pt-1.5 pb-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = isNavActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95",
                isActive ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-50"
              )}
            >
              {isActive && (
                <span aria-hidden className="absolute -top-1.5 h-0.5 w-8 rounded-full bg-emerald-500" />
              )}
              <Icon className={cn("h-[22px] w-[22px]", isActive ? "stroke-[2.4]" : "stroke-2")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
