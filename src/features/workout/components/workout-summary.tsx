"use client";

import Link from "next/link";
import { ChevronLeft, Pencil, Target, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatClock } from "@/lib/clock";
import { toPreferredWeight } from "@/lib/units";
import { cn } from "@/lib/utils";
import { SET_TYPE_INFO, setLabels, toSetType } from "@/features/workout/set-types";
import type { WorkoutSummary } from "@/features/workout/actions";

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const DELTA_STYLE = { up: "text-emerald-400", same: "text-zinc-400", down: "text-amber-400" } as const;
const DELTA_ICON = { up: TrendingUp, same: Minus, down: TrendingDown } as const;

/** Read-only recap of a completed workout. Editing happens on the normal workout screen via the Edit button. */
export function WorkoutSummaryView({ data }: { data: WorkoutSummary }) {
  const { session, unit, exercises, previous } = data;
  const seconds = session.endedAt ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000 : null;
  const compared = exercises.filter((e) => e.delta !== null);
  const progressed = compared.filter((e) => e.delta?.status === "up").length;
  const prs = exercises.filter((e) => e.isPr).length;
  const pct = previous?.volumeDeltaPct ?? null;

  const headline = [
    pct !== null ? `Volume ${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%` : null,
    compared.length > 0 ? `${progressed} of ${compared.length} progressed` : null,
    prs > 0 ? `${prs} PR${prs === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-xl pb-8">
      <header className="mb-3.5 flex items-center gap-3 border-b border-zinc-800 pb-3">
        <Link href="/history" aria-label="Back to History" className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-zinc-100">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[28px] font-extrabold uppercase leading-none tracking-wide">{session.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400" suppressHydrationWarning>
            <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-zinc-600" />
            Completed · {day(session.startedAt)}
          </p>
        </div>
        {seconds !== null && (
          <div className="font-display text-3xl font-bold tabular-nums text-emerald-400">{formatClock(seconds)}</div>
        )}
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Exercises" value={String(exercises.length)} />
        <Stat label="Sets" value={String(data.workingSets)} />
        <Stat label="Volume" value={Math.round(toPreferredWeight(data.volumeKg, unit)).toLocaleString("en-US")} unit={unit} />
      </dl>

      {headline.length > 0 && (
        <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-zinc-900 p-3">
          <TrendingUp aria-hidden className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{headline.join(" · ")}</p>
            {previous && (
              <p className="text-xs text-zinc-400" suppressHydrationWarning>
                Volume compared with {previous.name} on {day(previous.startedAt)}
              </p>
            )}
          </div>
        </div>
      )}

      <Link href={`/session/${session.id}?edit=1`} className={cn(buttonVariants({ variant: "secondary" }), "mt-3 w-full")}>
        <Pencil className="h-4 w-4" /> Edit workout
      </Link>

      <ul className="mt-3.5 space-y-2.5">
        {exercises.map((e) => {
          const labels = setLabels(e.sets.map((s) => toSetType(s.set_type)));
          const working = e.sets.filter((s) => toSetType(s.set_type) !== "warmup").length;
          const Icon = e.delta ? DELTA_ICON[e.delta.status] : null;
          return (
            <li key={e.id}>
              <section aria-label={e.name} className="rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="py-1 font-display text-xl font-bold uppercase leading-[1.1] tracking-normal">{e.name}</h2>
                  <span className="mt-1 whitespace-nowrap text-xs font-semibold text-zinc-400">{working} sets</span>
                </div>
                <div className="mb-2.5 mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  {e.delta && Icon ? (
                    <span className={cn("inline-flex items-center gap-1", DELTA_STYLE[e.delta.status])}>
                      <Icon aria-hidden className="h-3.5 w-3.5 stroke-[2.5]" />
                      {e.delta.text} vs last time
                    </span>
                  ) : (
                    <span className="font-semibold text-zinc-400">First time</span>
                  )}
                  {e.isPr && <span className="rounded-md bg-emerald-500 px-1.5 py-px text-[11px] text-accent-ink">PR</span>}
                </div>
                <ol className="space-y-1.5">
                  {e.sets.map((s, i) => {
                    const type = toSetType(s.set_type);
                    return (
                      <li key={s.id} className="grid h-10 grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-xl bg-zinc-950">
                        <span className={cn("text-center font-display text-lg font-bold", SET_TYPE_INFO[type].text || "text-zinc-400")}>{labels[i]}</span>
                        <span className="font-display text-[22px] font-bold tabular-nums">
                          {fmt(toPreferredWeight(s.weight_kg, unit))}
                          <span className="ml-1 font-sans text-xs font-semibold text-zinc-400">{unit}</span>
                        </span>
                        <span className="font-display text-[22px] font-bold tabular-nums">
                          {s.reps}
                          <span className="ml-1 font-sans text-xs font-semibold text-zinc-400">reps</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {e.next && (
                  <p className="mt-2.5 flex items-center gap-2 border-t border-zinc-800 pt-2.5 text-[13px]">
                    <Target aria-hidden className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-zinc-400">Next time</span>
                    <span className="font-bold">
                      {fmt(e.next.weight)} {unit} × {e.next.reps}
                    </span>
                    <span className="min-w-0 truncate text-zinc-500">· {e.next.reason}</span>
                  </p>
                )}
              </section>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-3">
      <dt className="text-[11px] font-semibold uppercase text-zinc-400">{label}</dt>
      <dd className="font-display text-2xl font-extrabold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 font-sans text-xs font-semibold text-zinc-400">{unit}</span>}
      </dd>
    </div>
  );
}
