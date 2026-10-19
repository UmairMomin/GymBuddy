"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setWeekdayRoutineAction, type PlanRoutine } from "@/features/plan/actions";
import { WEEKDAY_LABELS } from "@/features/plan/schemas";
import { cn } from "@/lib/utils";

export function ScheduleTab({
  routines,
  schedule,
}: {
  routines: PlanRoutine[];
  schedule: Array<string | null>;
}) {
  const router = useRouter();
  // Shows the change instantly; snaps back to the server value if the save fails.
  const [local, setLocal] = React.useOptimistic(
    schedule,
    (current, change: { day: number; routineId: string | null }) =>
      current.map((v, i) => (i === change.day ? change.routineId : v))
  );
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const todayIndex = (new Date().getDay() + 6) % 7; // JS: 0 = Sunday → ours: 0 = Monday
  const countById = new Map(routines.map((r) => [r.id, r.items.length]));

  function change(day: number, value: string) {
    const routineId = value === "" ? null : value;
    setError(null);
    startTransition(async () => {
      setLocal({ day, routineId });
      const res = await setWeekdayRoutineAction(day, routineId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Your week repeats. Changing it never alters past workouts, and you can start any routine on any day.
      </p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <ul className="space-y-2">
        {WEEKDAY_LABELS.map((label, day) => {
          const routineId = local[day];
          const isToday = day === todayIndex;
          return (
            <li
              key={label}
              className={cn(
                "flex min-h-[60px] items-center gap-3 rounded-2xl bg-zinc-900 px-3",
                isToday && "ring-1 ring-emerald-500"
              )}
            >
              <span className={cn("w-11 text-sm font-bold", isToday ? "text-emerald-400" : "text-zinc-400")}>{label}</span>
              <div className="min-w-0 flex-1">
                <label htmlFor={`day-${day}`} className="sr-only">Routine for {label}</label>
                <select
                  id={`day-${day}`}
                  value={routineId ?? ""}
                  onChange={(e) => change(day, e.target.value)}
                  className="h-11 w-full rounded-xl border-0 bg-zinc-950 px-3 text-base font-semibold text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:text-sm"
                >
                  <option value="">Rest day</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-zinc-400">
                {routineId ? `${countById.get(routineId) ?? 0} exercises` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
