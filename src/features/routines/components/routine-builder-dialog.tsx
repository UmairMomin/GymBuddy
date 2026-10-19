"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createRoutineAction } from "@/features/routines/actions";
import { type PlannedExerciseItem } from "@/features/routines/schemas";
import { Plus, Trash2, Loader2, Dumbbell, AlertCircle, Check } from "lucide-react";
import type { Database } from "@/types/database.types";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export function RoutineBuilderDialog({
  workspaceId,
  availableExercises,
  onCreated,
}: {
  workspaceId: string;
  availableExercises: ExerciseRow[];
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dayOfWeek, setDayOfWeek] = React.useState<string>("monday");
  const [selectedExercises, setSelectedExercises] = React.useState<PlannedExerciseItem[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = React.useState(
    availableExercises[0]?.id || ""
  );

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function handleAddExercise() {
    const exercise = availableExercises.find((e) => e.id === selectedExerciseId);
    if (!exercise) return;

    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        target_sets: 3,
        target_reps: "8-12",
        rest_seconds: 90,
      },
    ]);
  }

  function handleRemoveExercise(index: number) {
    setSelectedExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateItem(
    index: number,
    field: keyof PlannedExerciseItem,
    value: string | number
  ) {
    setSelectedExercises((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function handleSaveRoutine(e: React.FormEvent) {
    e.preventDefault();
    if (selectedExercises.length === 0) {
      setError("Please add at least one exercise to the routine");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createRoutineAction({
      name,
      description: description || undefined,
      day_of_week: dayOfWeek ? (dayOfWeek as "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday") : undefined,
      workspace_id: workspaceId,
      exercises: selectedExercises,
    });

    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setName("");
        setDescription("");
        setDayOfWeek("monday");
        setSelectedExercises([]);
        onCreated?.();
      }, 1000);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold"
      >
        <Plus className="h-4 w-4" />
        Create Routine
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
      <Card className="w-full max-w-xl border-zinc-800 bg-zinc-950 p-2 shadow-2xl my-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-400" />
            <span>Create Workout Routine</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Define exercises, target sets, and rep ranges for your training group.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveRoutine} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded bg-red-500/10 p-2.5 text-xs text-red-400 border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded bg-emerald-500/10 p-2.5 text-xs text-emerald-400 border border-emerald-500/20">
                <Check className="h-4 w-4 shrink-0" />
                <span>Routine created successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Routine Name</label>
                <Input
                  placeholder="e.g. Upper Body Push"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Scheduled Day</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Freestyle (No specific day)</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Description (Optional)</label>
              <Input
                placeholder="e.g. Chest, front delts, and triceps focus"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Exercise List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Planned Movements ({selectedExercises.length})
                </h4>
              </div>

              {selectedExercises.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                  No exercises added yet. Select a movement below to add it.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedExercises.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-200 truncate">{item.exercise_name}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                          <label className="flex items-center gap-1">
                            <span>Sets:</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={item.target_sets}
                              onChange={(e) =>
                                handleUpdateItem(idx, "target_sets", parseInt(e.target.value) || 1)
                              }
                              className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center text-zinc-100"
                            />
                          </label>
                          <label className="flex items-center gap-1">
                            <span>Reps:</span>
                            <input
                              type="text"
                              value={item.target_reps}
                              onChange={(e) =>
                                handleUpdateItem(idx, "target_reps", e.target.value)
                              }
                              className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center text-zinc-100"
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(idx)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                        aria-label="Remove exercise"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add exercise control */}
              <div className="flex gap-2 pt-2">
                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {availableExercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.category})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddExercise}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Routine"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
