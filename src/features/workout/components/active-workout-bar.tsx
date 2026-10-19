"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { getActiveWorkoutAction, type ActiveWorkoutInfo } from "@/features/workout/actions";
import { formatClock, useNow } from "@/lib/clock";

/**
 * "Workout in progress" bar docked above the bottom nav on every page except the workout itself, with a
 * Resume button. It re-checks on each navigation and whenever the app returns to the foreground.
 */
export function ActiveWorkoutBar() {
  const pathname = usePathname();
  const [active, setActive] = React.useState<ActiveWorkoutInfo | null>(null);
  const onLogin = pathname === "/login";
  const inWorkout = active !== null && pathname === `/session/${active.id}`;
  const visible = active !== null && !onLogin && !inWorkout;
  const now = useNow(visible, 1000);

  React.useEffect(() => {
    if (onLogin) return;
    let cancelled = false;
    const load = () =>
      getActiveWorkoutAction()
        .then((info) => !cancelled && setActive(info))
        .catch(() => undefined); // offline: keep what we know
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, onLogin]);

  // Reserve space so the bar never covers the end of a page (the layout reads --wip-bar).
  React.useEffect(() => {
    document.documentElement.style.setProperty("--wip-bar", visible ? "4.5rem" : "0px");
    return () => document.documentElement.style.setProperty("--wip-bar", "0px");
  }, [visible]);

  if (!visible || !active) return null;

  return (
    <div
      role="region"
      aria-label="Workout in progress"
      className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-emerald-500/40 bg-zinc-900 py-2 pl-3.5 pr-2 shadow-2xl md:bottom-6"
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Dumbbell className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Workout in progress</p>
        <p className="truncate text-sm font-semibold text-zinc-50">
          {active.name}
          <span className="ml-2 font-normal tabular-nums text-zinc-400" suppressHydrationWarning>
            {formatClock((now - Date.parse(active.startedAt)) / 1000)}
          </span>
        </p>
      </div>
      <Link
        href={`/session/${active.id}`}
        className="flex h-11 shrink-0 items-center rounded-xl bg-emerald-500 px-5 text-sm font-bold text-accent-ink transition-colors hover:bg-emerald-600"
      >
        Resume
      </Link>
    </div>
  );
}
