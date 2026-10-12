"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestTimer } from "@/features/sessions/components/rest-timer";
import {
  addSetAction,
  updateSetAction,
  deleteSetAction,
  finishWorkoutSessionAction,
} from "@/features/sessions/actions";
import {
  Check,
  Plus,
  Trash2,
  Clock,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";

type SetRecord = {
  id: string;
  exercise_id: string;
  set_order: number;
  set_type: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  revision_number: number;
  exercises?: {
    id: string;
    name: string;
    category: string;
  } | null;
  profiles?: {
    id: string;
    display_name: string;
  } | null;
};

type SessionData = {
  id: string;
  name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  workspace_id: string;
};

export function ActiveWorkoutView({
  session,
  initialSets,
  availableExercises,
  currentUserId,
}: {
  session: SessionData;
  initialSets: SetRecord[];
  availableExercises: Array<{ id: string; name: string; category: string }>;
  currentUserId: string;
}) {
  const [sets, setSets] = React.useState<SetRecord[]>(initialSets);
  const [finishing, setFinishing] = React.useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = React.useState(
    availableExercises[0]?.id || ""
  );
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  // Elapsed workout time ticker
  const [elapsed, setElapsed] = React.useState("00:00");
  React.useEffect(() => {
    const startTime = new Date(session.started_at).getTime();
    const updateElapsed = () => {
      const diffSecs = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      setElapsed(`${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.started_at]);

  // Group sets by exercise
  const exercisesInSession = React.useMemo(() => {
    const map = new Map<string, { exercise: { id: string; name: string }; sets: SetRecord[] }>();
    sets.forEach((s) => {
      const ex = s.exercises || availableExercises.find((e) => e.id === s.exercise_id);
      const name = ex?.name || "Exercise";
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, { exercise: { id: s.exercise_id, name }, sets: [] });
      }
      map.get(s.exercise_id)!.sets.push(s);
    });
    return Array.from(map.values());
  }, [sets, availableExercises]);

  async function handleAddSet(exerciseId: string) {
    const exSets = sets.filter((s) => s.exercise_id === exerciseId);
    const lastSet = exSets[exSets.length - 1];

    const newOrder = exSets.length + 1;
    const defaultWeight = lastSet ? lastSet.weight_kg : 0;
    const defaultReps = lastSet ? lastSet.reps : 10;

    const res = await addSetAction({
      session_id: session.id,
      exercise_id: exerciseId,
      user_id: currentUserId,
      set_order: newOrder,
      set_type: "normal",
      weight_kg: defaultWeight,
      reps: defaultReps,
      completed: false,
    });

    if (res.data) {
      const created = res.data as SetRecord;
      setSets((prev) => [...prev, created]);
      router.refresh();
    }
  }

  async function handleUpdateField(
    setId: string,
    field: "weight_kg" | "reps" | "completed" | "set_type",
    value: number | boolean | string
  ) {
    const current = sets.find((s) => s.id === setId);
    if (!current) return;

    // Optimistic update
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
    );

    const res = await updateSetAction({
      id: setId,
      [field]: value,
      revision_number: current.revision_number,
    });

    if (res.error) {
      setError(res.error);
      router.refresh(); // reconcile state
    } else if (res.data) {
      const updated = res.data as SetRecord;
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, revision_number: updated.revision_number } : s))
      );
    }
  }

  async function handleDeleteSet(setId: string) {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    await deleteSetAction(setId);
    router.refresh();
  }

  async function handleFinish() {
    if (!confirm("Are you sure you want to finish and log this workout?")) return;
    setFinishing(true);
    await finishWorkoutSessionAction(session.id);
    router.push("/");
  }

  const completedSetsCount = sets.filter((s) => s.completed).length;
  const totalVolume = sets
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + Number(s.weight_kg) * Number(s.reps), 0);

  return (
    <div className="space-y-6 pb-24">
      {/* Session Top Card */}
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <CardTitle className="text-xl font-bold">{session.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-md border border-zinc-800">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              <span>{elapsed}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
            <span>
              Sets: <strong className="text-zinc-200">{completedSetsCount}</strong> / {sets.length}
            </span>
            <span>
              Volume: <strong className="text-emerald-400">{totalVolume.toLocaleString()} kg</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RestTimer />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Exercises & Set Rows */}
      <div className="space-y-6">
        {exercisesInSession.map(({ exercise, sets: exSets }) => (
          <div
            key={exercise.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-emerald-400" />
                <span>{exercise.name}</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddSet(exercise.id)}
                className="h-8 gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Set
              </Button>
            </div>

            {/* Set Table Header */}
            <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase text-zinc-500 px-1">
              <span className="col-span-2 text-center">Set</span>
              <span className="col-span-4 text-center">Weight (kg)</span>
              <span className="col-span-3 text-center">Reps</span>
              <span className="col-span-2 text-center">Done</span>
              <span className="col-span-1" />
            </div>

            {/* Set Rows */}
            <div className="space-y-2">
              {exSets.map((s, idx) => (
                <div
                  key={s.id}
                  className={`grid grid-cols-12 gap-2 items-center rounded-lg p-2 transition-colors ${
                    s.completed
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-zinc-950/60 border border-zinc-800/60"
                  }`}
                >
                  {/* Set Order & Type */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <span className="font-mono text-xs font-bold text-zinc-300">
                      #{idx + 1}
                    </span>
                    <select
                      value={s.set_type}
                      onChange={(e) => handleUpdateField(s.id, "set_type", e.target.value)}
                      className="bg-transparent text-[9px] uppercase tracking-wider text-zinc-400 text-center focus:outline-none"
                    >
                      <option value="normal" className="bg-zinc-900">Normal</option>
                      <option value="warmup" className="bg-zinc-900">Warm</option>
                      <option value="drop" className="bg-zinc-900">Drop</option>
                      <option value="failure" className="bg-zinc-900">Fail</option>
                    </select>
                  </div>

                  {/* Weight Input */}
                  <div className="col-span-4">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={s.weight_kg === 0 ? "" : s.weight_kg}
                      placeholder="0"
                      onChange={(e) =>
                        handleUpdateField(s.id, "weight_kg", parseFloat(e.target.value) || 0)
                      }
                      className="h-10 text-center font-mono font-semibold text-zinc-100 bg-zinc-900/80 border-zinc-700"
                    />
                  </div>

                  {/* Reps Input */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      value={s.reps === 0 ? "" : s.reps}
                      placeholder="0"
                      onChange={(e) =>
                        handleUpdateField(s.id, "reps", parseInt(e.target.value) || 0)
                      }
                      className="h-10 text-center font-mono font-semibold text-zinc-100 bg-zinc-900/80 border-zinc-700"
                    />
                  </div>

                  {/* Complete Checkbox Button */}
                  <div className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleUpdateField(s.id, "completed", !s.completed)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all ${
                        s.completed
                          ? "bg-emerald-500 border-emerald-400 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20"
                          : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                      }`}
                      aria-label="Mark set complete"
                    >
                      <Check className="h-5 w-5 stroke-[3]" />
                    </button>
                  </div>

                  {/* Delete Set */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteSet(s.id)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      aria-label="Delete set"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add Another Movement to Active Session */}
        <div className="flex gap-2 rounded-xl border border-dashed border-zinc-800 p-3 bg-zinc-950/40">
          <select
            value={selectedExerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
            className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availableExercises.map((e) => (
              <option key={e.id} value={e.id}>
                + Add {e.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            onClick={() => handleAddSet(selectedExerciseId)}
            className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Exercise
          </Button>
        </div>
      </div>

      {/* Floating Action Bar: Finish Session */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            <span>Completed <strong>{completedSetsCount}</strong> sets</span>
          </div>
          <Button
            onClick={handleFinish}
            disabled={finishing}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-6 h-11 gap-2 shadow-lg shadow-emerald-500/20"
          >
            {finishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Finish Workout
          </Button>
        </div>
      </div>
    </div>
  );
}
