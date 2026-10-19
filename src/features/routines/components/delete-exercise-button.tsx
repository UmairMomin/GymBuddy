"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { deleteCustomExerciseAction } from "@/features/routines/actions";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { Database } from "@/types/database.types";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export function DeleteExerciseButton({
  exercise,
  onDeleted,
}: {
  exercise: ExerciseRow;
  onDeleted?: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const res = await deleteCustomExerciseAction(exercise.id);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setConfirming(false);
      onDeleted?.();
    }
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirming(true)}
        className="h-8 w-8 text-zinc-400 hover:text-red-400"
        aria-label="Delete exercise"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5 text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <h3 className="font-semibold text-base text-zinc-100">Delete Exercise?</h3>
        </div>

        <p className="text-xs text-zinc-300">
          Are you sure you want to delete <span className="font-semibold text-zinc-50">&quot;{exercise.name}&quot;</span>?
          This action cannot be undone.
        </p>

        {error && (
          <div className="rounded bg-red-500/10 p-2 text-xs text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
