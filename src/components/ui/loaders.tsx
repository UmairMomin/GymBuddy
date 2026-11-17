"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The GymBuddy barbell: a long bar with a thicker sleeve at each end, three plates a side (biggest inside,
 * smallest outside) and a collar. Drawn with the theme accent; `mono` takes the surrounding text colour
 * instead (for use inside a button). The same barbell as the pull-to-refresh and startup animations.
 */
export function Barbell({
  width = 200,
  lifting = true,
  mono = false,
  className,
}: {
  width?: number;
  lifting?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 72"
      width={width}
      height={Math.round(width * 0.36)}
      aria-hidden
      className={cn("overflow-visible", mono && "gb-mono", lifting && (width <= 60 ? "gb-barbell-mini" : "gb-barbell"), className)}
    >
      <rect className="gb-bar" x="0" y="34" width="200" height="5" rx="2.5" />
      <rect className="gb-sleeve" x="0" y="31" width="60" height="11" rx="2" />
      <rect className="gb-sleeve" x="140" y="31" width="60" height="11" rx="2" />
      <rect className="gb-p1" x="36" y="6" width="12" height="60" rx="3" />
      <rect className="gb-p2" x="25" y="14" width="10" height="44" rx="3" />
      <rect className="gb-p3" x="16" y="22" width="8" height="28" rx="2" />
      <rect className="gb-collar" x="10" y="28" width="4" height="16" rx="1" />
      <rect className="gb-p1" x="152" y="6" width="12" height="60" rx="3" />
      <rect className="gb-p2" x="165" y="14" width="10" height="44" rx="3" />
      <rect className="gb-p3" x="176" y="22" width="8" height="28" rx="2" />
      <rect className="gb-collar" x="186" y="28" width="4" height="16" rx="1" />
    </svg>
  );
}

/**
 * A full-screen wait that says what is happening: the barbell, a title, optional steps that tick off, and a
 * "taking longer than usual" note if it drags. It covers the whole app, header and nav included, so a
 * hand-off from one of these to the next (Starting → the workout route loading) never flashes the page.
 * `children` sit between the barbell and the title.
 */
export function LoadingScreen({
  title,
  subtitle,
  steps = [],
  children,
}: {
  title: string;
  subtitle?: string;
  steps?: string[];
  children?: React.ReactNode;
}) {
  const [active, setActive] = React.useState(0);
  const [slow, setSlow] = React.useState(false);
  const stepCount = steps.length;

  React.useEffect(() => {
    const advance = stepCount > 1 ? window.setInterval(() => setActive((i) => Math.min(i + 1, stepCount - 1)), 1600) : undefined;
    const late = window.setTimeout(() => setSlow(true), 6000);
    return () => {
      if (advance) window.clearInterval(advance);
      window.clearTimeout(late);
    };
  }, [stepCount]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-zinc-950 px-8 pt-safe text-center"
    >
      <div className="relative flex h-[110px] w-[200px] justify-center">
        <Barbell />
        <div aria-hidden className="gb-shadow absolute inset-x-[50px] bottom-2 h-1.5 rounded-full bg-zinc-800" />
      </div>
      {children && <div className="mt-6 w-full max-w-[300px]">{children}</div>}
      <h1 className="mt-6 font-display text-[34px] font-extrabold uppercase leading-[1.05] tracking-wide">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      {steps.length > 0 && (
        <ol className="mt-7 flex w-full max-w-[260px] flex-col gap-3 text-left text-[15px]">
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-3 transition-opacity", i > active && "opacity-40")}>
              {i < active ? (
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-accent-ink">
                  <Check aria-hidden className="h-3.5 w-3.5 stroke-[4]" />
                </span>
              ) : i === active ? (
                <span aria-hidden className="h-[22px] w-[22px] shrink-0 animate-spin rounded-full border-[3px] border-zinc-800 border-t-emerald-400" />
              ) : (
                <span aria-hidden className="h-[22px] w-[22px] shrink-0 rounded-full border-[3px] border-zinc-800" />
              )}
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={cn("mt-8 max-w-[260px] text-[13px] leading-snug text-zinc-400 transition-opacity duration-500", slow ? "opacity-100" : "opacity-0")}>
        Taking longer than usual. Check your connection; it will keep trying.
      </p>
    </div>
  );
}

/** A route's in-page loading state (header and nav stay): the lifting barbell and what is loading. */
export function PageLoader({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Barbell width={120} />
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

/** Placeholder for an exercise card that is being added. */
export function ExerciseSkeleton({ name }: { name: string }) {
  return (
    <section
      role="status"
      aria-label={`Adding ${name}`}
      className="space-y-2.5 rounded-[18px] border border-emerald-500/50 bg-zinc-900 p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="gb-skel h-[22px] w-40 rounded-md" />
        <div className="gb-skel h-[22px] w-16 rounded-full" />
      </div>
      <div className="gb-skel h-[46px] rounded-xl" />
      <div className="gb-skel h-[46px] rounded-xl" />
    </section>
  );
}
