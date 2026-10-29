"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";

/** Other components (e.g. the live workout) listen for this to re-fetch their own client state. */
export const REFRESH_EVENT = "gb:refresh";

const THRESHOLD = 70;

/** Mobile-style pull-down-to-refresh: re-runs the server data for the page and fires REFRESH_EVENT. */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const pullRef = React.useRef(0);

  React.useEffect(() => {
    let startY: number | null = null;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      const t = e.target as Element | null;
      // Only from the very top of the page, and never from inside a sheet or a text field.
      const blocked = t?.closest('[role="dialog"], input, textarea, select');
      startY = window.scrollY <= 0 && !blocked ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) return set(0);
      set(Math.min(dy * 0.5, THRESHOLD * 1.5));
    };
    const onEnd = () => {
      const reached = pullRef.current >= THRESHOLD;
      startY = null;
      set(0);
      if (!reached) return;
      setRefreshing(true);
      router.refresh();
      window.dispatchEvent(new Event(REFRESH_EVENT));
      setTimeout(() => setRefreshing(false), 1800); // two reps
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const shown = refreshing ? THRESHOLD * 0.6 : pull;
  if (shown <= 0) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      style={{ transform: `translateY(${shown - 30}px)` }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 shadow-lg">
        <Dumbbell
          className={`h-4 w-4 text-emerald-400 ${refreshing ? "gb-rep" : ""}`}
          style={
            refreshing
              ? { animation: "gb-rep 0.9s ease-in-out infinite" }
              : { transform: `scale(${0.6 + Math.min(shown / THRESHOLD, 1) * 0.4})`, opacity: 0.4 + Math.min(shown / THRESHOLD, 1) * 0.6 }
          }
        />
      </span>
    </div>
  );
}
