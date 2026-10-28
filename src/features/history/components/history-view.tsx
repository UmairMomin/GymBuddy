"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Download, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HistoryData } from "@/features/history/actions";
import { HistoryCharts } from "@/features/history/components/history-charts";
import { BodyMetricsCard } from "@/features/history/components/body-metrics-card";
import { RenameSession } from "@/features/workout/components/rename-session";
import { toPreferredWeight } from "@/lib/units";
import { cn } from "@/lib/utils";

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function HistoryView({ data }: { data: HistoryData }) {
  const { unit, sessions, records, bodyMetrics } = data;
  const [openId, setOpenId] = React.useState<string | null>(sessions[0]?.id ?? null);

  const totalVolume = sessions.reduce((s, x) => s + x.total_volume_kg, 0);
  const totalSets = sessions.reduce((s, x) => s + x.completed_sets_count, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">History</h1>
          <p className="text-sm text-zinc-400">Everything you&rsquo;ve logged, solo and with your buddy.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?format=csv" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> CSV</Button>
          </a>
          <a href="/api/export?format=json" download>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /> JSON</Button>
          </a>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-sm text-zinc-300">No finished workouts yet. Your history, records and charts appear here.</p>
          <Link href="/">
            <Button>Go to Today</Button>
          </Link>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-zinc-900 p-3">
              <dt className="text-[11px] font-semibold uppercase text-zinc-400">Workouts</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">{sessions.length}</dd>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-3">
              <dt className="text-[11px] font-semibold uppercase text-zinc-400">Sets</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">{totalSets}</dd>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-3">
              <dt className="text-[11px] font-semibold uppercase text-zinc-400">Volume ({unit})</dt>
              <dd className="font-display text-3xl font-extrabold tabular-nums">
                {Math.round(toPreferredWeight(totalVolume, unit)).toLocaleString("en-US")}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="pr-heading" className="space-y-2">
            <h2 id="pr-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Trophy className="h-4 w-4 text-emerald-400" /> Personal records
            </h2>
            <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl bg-zinc-900">
              {records.slice(0, 12).map((r) => (
                <li key={r.exercise} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.exercise}</p>
                    <p className="text-xs text-zinc-400" suppressHydrationWarning>{day(r.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-xl font-extrabold tabular-nums text-emerald-400">
                      {fmt(toPreferredWeight(r.weight_kg, unit))} {unit} × {r.reps}
                    </p>
                    <p className="text-xs text-zinc-400">est. 1RM {fmt(toPreferredWeight(r.estimated_1rm, unit))} {unit}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <HistoryCharts sessions={sessions} unit={unit} />

          <section aria-labelledby="sessions-heading" className="space-y-2">
            <h2 id="sessions-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Flame className="h-4 w-4 text-emerald-400" /> Workouts
            </h2>
            <ul className="space-y-2">
              {sessions.map((s) => {
                const open = openId === s.id;
                const minutes = s.ended_at ? Math.max(1, Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000)) : null;
                return (
                  <li key={s.id} className="overflow-hidden rounded-2xl bg-zinc-900">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : s.id)}
                      className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.name}</p>
                        <p className="text-xs text-zinc-400" suppressHydrationWarning>
                          {day(s.started_at)} · {s.with_name ? `with ${s.with_name}` : "solo"}
                          {minutes ? ` · ${minutes} min` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-zinc-300">
                          {Math.round(toPreferredWeight(s.total_volume_kg, unit)).toLocaleString("en-US")} {unit}
                        </span>
                        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                      </div>
                    </button>
                    {open && (
                      <div className="space-y-2 border-t border-zinc-800 px-4 py-3">
                        <ul className="space-y-1.5">
                          {s.exercises_summary.map((e) => (
                            <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate">{e.name}</span>
                              <span className={cn("shrink-0 text-xs tabular-nums text-zinc-400")}>
                                {e.sets_count} sets · top {fmt(toPreferredWeight(e.top_weight_kg, unit))} {unit} × {e.top_reps}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/session/${s.id}`} className="inline-block text-xs font-semibold text-emerald-400 underline-offset-4 hover:underline">
                            View or correct sets
                          </Link>
                          {s.is_freestyle && <RenameSession sessionId={s.id} name={s.name} />}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <BodyMetricsCard initialMetrics={bodyMetrics} unit={unit} />
    </div>
  );
}
