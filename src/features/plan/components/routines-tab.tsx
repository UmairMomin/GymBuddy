"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  archiveRoutineAction,
  seedStarterPlanAction,
  type PlanExercise,
  type PlanRoutine,
} from "@/features/plan/actions";
import { WEEKDAY_LABELS } from "@/features/plan/schemas";
import { RoutineBuilderSheet } from "@/features/plan/components/routine-builder-sheet";

export function RoutinesTab({
  routines,
  exercises,
  schedule,
}: {
  routines: PlanRoutine[];
  exercises: PlanExercise[];
  schedule: Array<string | null>;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<PlanRoutine | null>(null);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const nameById = new Map(exercises.map((e) => [e.id, e.name]));

  function openBuilder(routine: PlanRoutine | null) {
    setEditing(routine);
    setOpen(true);
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function archive(r: PlanRoutine) {
    if (!confirm(`Delete "${r.name}"? Past workouts keep their history. It will be removed from your schedule.`)) return;
    run(() => archiveRoutineAction(r.id));
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {routines.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-zinc-800 p-5 text-center">
          <p className="text-sm text-zinc-300">You have no routines yet.</p>
          <Button className="w-full" disabled={pending} onClick={() => run(seedStarterPlanAction)}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Start with Push / Pull / Legs / Shoulders + Arms
          </Button>
          <p className="text-xs text-zinc-400">Sets up four routines and a six-day week. Everything stays editable.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {routines.map((r) => (
            <li key={r.id} className="rounded-2xl bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-2xl font-bold uppercase tracking-wide">{r.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {r.items.length} exercises
                    {r.weekdays.length > 0 ? ` · ${r.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}` : " · not scheduled"}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => openBuilder(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} disabled={pending} onClick={() => archive(r)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
              {r.items.length > 0 && (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                  {r.items.map((i) => nameById.get(i.exercise_id) ?? "Exercise").join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" className="w-full border-dashed" onClick={() => openBuilder(null)}>
        <Plus className="h-4 w-4" /> New routine
      </Button>

      <RoutineBuilderSheet
        open={open}
        onClose={() => setOpen(false)}
        routine={editing}
        routines={routines}
        exercises={exercises}
        schedule={schedule}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
