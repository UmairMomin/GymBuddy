"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  createExerciseAction,
  updateExerciseAction,
  type PlanExercise,
} from "@/features/plan/actions";
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT } from "@/features/plan/schemas";

const selectClass =
  "h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:text-sm";

export const labelize = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type Props = {
  open: boolean;
  onClose: () => void;
  /** When set, edits this exercise; otherwise creates a new one. */
  exercise?: PlanExercise | null;
  onSaved: (exercise?: PlanExercise) => void;
};

/** Mounts the form only while open, so its state starts fresh from `exercise` every time. */
export function ExerciseFormSheet(props: Props) {
  if (!props.open) return null;
  return <ExerciseForm key={props.exercise?.id ?? "new"} {...props} />;
}

function ExerciseForm({ open, onClose, exercise, onSaved }: Props) {
  const [name, setName] = React.useState(exercise?.name ?? "");
  const [category, setCategory] = React.useState<(typeof EXERCISE_CATEGORIES)[number]>(
    (exercise?.category as (typeof EXERCISE_CATEGORIES)[number]) ?? "chest"
  );
  const [equipment, setEquipment] = React.useState<string>(exercise?.primary_equipment ?? "");
  const [notes, setNotes] = React.useState(exercise?.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = {
      name,
      category,
      primary_equipment: (equipment || null) as (typeof EXERCISE_EQUIPMENT)[number] | null,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      if (exercise) {
        const res = await updateExerciseAction(exercise.id, input);
        if (res.error) return setError(res.error);
        onSaved();
      } else {
        const res = await createExerciseAction(input);
        if (res.error || !res.data) return setError(res.error ?? "Couldn't create the exercise");
        onSaved(res.data);
      }
      onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={exercise ? "Edit exercise" : "New exercise"}>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor="ex-name" className="text-xs font-semibold text-zinc-400">Name</label>
          <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ex-cat" className="text-xs font-semibold text-zinc-400">Muscle group</label>
            <select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={selectClass}>
              {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ex-eq" className="text-xs font-semibold text-zinc-400">Equipment</label>
            <select id="ex-eq" value={equipment} onChange={(e) => setEquipment(e.target.value)} className={selectClass}>
              <option value="">Not set</option>
              {EXERCISE_EQUIPMENT.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ex-notes" className="text-xs font-semibold text-zinc-400">Notes / cues (optional)</label>
          <Input id="ex-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending || name.trim().length < 2}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {exercise ? "Save changes" : "Create exercise"}
        </Button>
      </form>
    </Sheet>
  );
}
