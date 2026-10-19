"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { cn, getInitials } from "@/lib/utils";

export function ProfileMenu({ user }: { user: { name: string; username: string } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The sign-in page has no account to show.
  if (pathname === "/login") return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex min-h-[40px] items-center rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-emerald-600"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 font-display text-lg font-extrabold uppercase tracking-wide text-accent-ink transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95",
          open && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950"
        )}
      >
        {getInitials(user.name)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
        >
          <div className="border-b border-zinc-800 px-4 py-3">
            <p className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide text-zinc-50">
              {user.name}
            </p>
            <p className="truncate text-xs text-zinc-400">@{user.username}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
            >
              <Settings className="h-4 w-4 text-zinc-400" />
              Settings
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
