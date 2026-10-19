"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type RestState = { endsAt: number; total: number };

/** Re-renders every `ms` while `active`, returning the current time. */
export function useNow(active: boolean, ms: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function RestTimerDock({
  rest,
  shared = false,
  onAdjust,
  onSkip,
}: {
  rest: RestState;
  /** True when a buddy is in the session and sees the same countdown. */
  shared?: boolean;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
}) {
  const now = useNow(true, 250);
  const remaining = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const done = remaining === 0;
  const buzzed = React.useRef(false);

  React.useEffect(() => {
    if (done && !buzzed.current) {
      buzzed.current = true;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // vibration is optional
      }
    }
    if (!done) buzzed.current = false;
  }, [done]);

  const progress = rest.total > 0 ? Math.min(1, Math.max(0, remaining / rest.total)) : 0;

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl md:bottom-6"
    >
      <div className="h-1 bg-zinc-800" aria-hidden>
        <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex items-center gap-2 p-3 pl-4">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{shared ? "Rest · shared" : "Rest"}</p>
          <p
            className={cn(
              "font-display text-4xl font-extrabold leading-none tabular-nums",
              done ? "text-red-400" : "text-emerald-400"
            )}
          >
            {formatClock(remaining)}
          </p>
        </div>
        <button type="button" onClick={() => onAdjust(-15)} className="h-11 min-w-11 rounded-xl bg-zinc-800 px-3 text-sm font-bold hover:bg-zinc-700">
          −15
        </button>
        <button type="button" onClick={() => onAdjust(15)} className="h-11 min-w-11 rounded-xl bg-zinc-800 px-3 text-sm font-bold hover:bg-zinc-700">
          +15
        </button>
        <button type="button" onClick={onSkip} className="h-11 rounded-xl bg-zinc-50 px-4 text-sm font-bold text-zinc-950 hover:bg-zinc-200">
          {done ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
