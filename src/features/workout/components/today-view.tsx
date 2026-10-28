"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { startWorkoutAction, type TodayData } from "@/features/workout/actions";
import { doneToday } from "@/features/workout/done-today";
import { toPreferredWeight } from "@/lib/units";
import { WEEKDAY_LABELS } from "@/features/plan/schemas";
import { InstallPrompt } from "@/features/notifications/components/install-prompt";
import { cn } from "@/lib/utils";

/** Today's weekday (0 = Monday) from the device clock. -1 on the server so hydration matches. */
function useTodayIndex(): number {
  return React.useSyncExternalStore(
    () => () => {},
    () => (new Date().getDay() + 6) % 7,
    () => -1
  );
}

const shortName = (name: string) => (name.length <= 5 ? name : name.replace(/shoulders\s*\+\s*arms/i, "S+A").slice(0, 5));

export function TodayView({ data }: { data: TodayData }) {
  const router = useRouter();
  const today = useTodayIndex();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [withBuddy, setWithBuddy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const byId = new Map(data.routines.map((r) => [r.id, r]));
  const scheduledId = today >= 0 ? data.schedule[today] : null;
  const scheduled = scheduledId ? byId.get(scheduledId) ?? null : null;
  const hasRoutines = data.routines.length > 0;
  // Anything finished today, routine or not, replaces the plan: the day's training is already done.
  const done = today < 0 ? [] : doneToday(data.recent, new Date());
  const fmt = (kg: number) => String(Math.round(toPreferredWeight(kg, data.unit) * 10) / 10);

  function start(routineId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await startWorkoutAction(routineId, Boolean(data.buddy) && withBuddy);
      if (res.error || !res.data) {
        setError(res.error ?? "Couldn't start the workout");
        return;
      }
      router.push(`/session/${res.data.id}`);
    });
  }


  const buddyToggle = data.buddy ? (
    <div className="flex items-center gap-3 rounded-2xl bg-[#a8cbff]/15 px-3.5 py-3">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a8cbff] font-bold text-[#1e1e22]">
        {data.buddy.displayName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p id="buddy-toggle-label" className="truncate text-sm font-semibold">Train with {data.buddy.displayName}</p>
        <p className="text-xs text-zinc-400">They get an invite when you start</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={withBuddy}
        aria-labelledby="buddy-toggle-label"
        onClick={() => setWithBuddy((v) => !v)}
        className={cn(
          "flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8cbff]",
          withBuddy ? "justify-end bg-[#a8cbff]" : "justify-start bg-zinc-700"
        )}
      >
        <span className={cn("h-6 w-6 rounded-full", withBuddy ? "bg-[#1e1e22]" : "bg-zinc-300")} />
      </button>
    </div>
  ) : null;

  const dateLabel =
    today < 0
      ? " "
      : new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400" suppressHydrationWarning>
          {dateLabel}
        </p>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">Today</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {data.activeSession ? (
        <section aria-label="Workout in progress" className="space-y-3 rounded-3xl bg-zinc-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">In progress</p>
          <p className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">
            {data.activeSession.name}
          </p>
          <Link href={`/session/${data.activeSession.id}`} className="block">
            <Button size="lg" className="h-14 w-full font-display text-xl uppercase tracking-wider">
              <Play className="h-5 w-5" /> Resume workout
            </Button>
          </Link>
        </section>
      ) : today < 0 ? (
        // Server render / pre-hydration: the device's weekday isn't known yet, so show a neutral placeholder.
        <section aria-busy="true" aria-label="Loading today's workout" className="h-72 animate-pulse rounded-3xl bg-zinc-900" />
      ) : done.length > 0 ? (
        <section aria-label="Today's summary" className="space-y-3">
          {done.map((s) => {
            const minutes = s.endedAt ? Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)) : null;
            return (
              <div key={s.id} className="space-y-3 rounded-3xl bg-zinc-900 p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Check className="h-4 w-4" /> Done today
                </p>
                <Link href={`/session/${s.id}`} className="block">
                  <p className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">{s.name}</p>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    {s.sets} sets · {Math.round(toPreferredWeight(s.volumeKg, data.unit)).toLocaleString("en-US")} {data.unit}
                    {minutes ? ` · ${minutes} min` : ""}
                    {s.withName ? ` · with ${s.withName}` : ""}
                  </p>
                </Link>
                <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                  {s.exercises.map((e) => (
                    <li key={e.name} className="flex justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{e.name}</span>
                      <span className="shrink-0 tabular-nums text-zinc-400">
                        {e.sets} sets · top {fmt(e.topWeightKg)} {data.unit} × {e.topReps}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <Button variant="secondary" className="w-full" onClick={() => setPickerOpen(true)}>
            Start another workout
          </Button>
        </section>
      ) : (
        <section aria-label="Today's workout" className="space-y-4 rounded-3xl bg-zinc-900 p-5">
          {!hasRoutines ? (
            <>
              <p className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">No routines yet</p>
              <p className="text-sm text-zinc-400">Set up your week in Plan, or just start logging.</p>
              <div className="flex gap-2">
                <Link href="/plan?tab=routines" className="flex-1">
                  <Button className="w-full">Set up plan</Button>
                </Link>
                <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => start(null)}>
                  Freestyle
                </Button>
              </div>
            </>
          ) : scheduled ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Scheduled</p>
                  <p className="font-display text-5xl font-extrabold uppercase leading-none tracking-wide">
                    {scheduled.name}
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-400">{scheduled.exerciseCount} exercises</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  Change
                </Button>
              </div>
              <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
                {scheduled.preview.map((p) => (
                  <li key={p.name} className="flex justify-between py-2.5 text-sm">
                    <span>{p.name}</span>
                    <span className="text-zinc-400">{p.sets} sets</span>
                  </li>
                ))}
                {scheduled.exerciseCount > scheduled.preview.length && (
                  <li className="py-2.5 text-sm text-zinc-400">+ {scheduled.exerciseCount - scheduled.preview.length} more</li>
                )}
              </ul>
              {buddyToggle}
              <Button
                size="lg"
                className="h-14 w-full font-display text-xl uppercase tracking-wider"
                disabled={pending}
                onClick={() => start(scheduled.id)}
              >
                {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Start workout
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {today < 0 ? " " : WEEKDAY_LABELS[today]}
              </p>
              <p className="font-display text-5xl font-extrabold uppercase leading-none tracking-wide">Rest day</p>
              <p className="text-sm text-zinc-400">Nothing scheduled. Recover, or train anyway.</p>
              {buddyToggle}
              <Button variant="secondary" className="w-full" onClick={() => setPickerOpen(true)}>
                Start a workout anyway
              </Button>
            </>
          )}
        </section>
      )}

      {hasRoutines && (
        <section aria-label="This week">
          <ol className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => {
              const r = data.schedule[day] ? byId.get(data.schedule[day]!) : undefined;
              const isToday = day === today;
              return (
                <li
                  key={label}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "rounded-xl px-0.5 py-2 text-center",
                    isToday ? "bg-emerald-500 text-accent-ink" : r ? "bg-zinc-900" : "border border-dashed border-zinc-800"
                  )}
                >
                  <p className={cn("text-[11px] font-semibold", !isToday && "text-zinc-400")}>{label.toUpperCase()}</p>
                  <p className="mt-0.5 font-display text-base font-extrabold uppercase leading-tight">
                    {r ? shortName(r.name) : <span className="text-xs font-medium normal-case text-zinc-500">Rest</span>}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {data.recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-2">
          <h2 id="recent-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recent</h2>
          {data.recent.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 p-3.5 transition-colors hover:bg-zinc-800"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-zinc-400" suppressHydrationWarning>
                  {new Date(s.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {" · "}
                  {s.withName ? `with ${s.withName}` : "solo"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-zinc-400">
                {s.status === "cancelled"
                  ? "Discarded"
                  : s.endedAt
                    ? `${Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000))} min`
                    : ""}
              </span>
            </Link>
          ))}
        </section>
      )}

      <InstallPrompt />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Start a workout">
        <ul className="space-y-2 pt-2">
          {data.routines.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPickerOpen(false);
                  start(r.id);
                }}
                className="flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-zinc-900 px-4 text-left hover:bg-zinc-800"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-xs text-zinc-400">{r.exerciseCount} exercises</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPickerOpen(false);
                start(null);
              }}
              className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-dashed border-zinc-700 px-4 text-left hover:bg-zinc-900"
            >
              <span className="font-semibold">Freestyle</span>
              <span className="text-xs text-zinc-400">Add exercises as you go</span>
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}
