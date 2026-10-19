"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { deleteRoutineAction } from "@/features/routines/actions";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteRoutineButtonProps {
  routineId: string;
  routineName: string;
  onDeleted?: () => void;
}

export function DeleteRoutineButton({
  routineId,
  routineName,
  onDeleted,
}: DeleteRoutineButtonProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await deleteRoutineAction(routineId);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setShowConfirm(false);
      onDeleted?.();
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
        title="Delete Routine"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="rounded-full bg-red-500/10 p-2 border border-red-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100 text-sm">Delete Routine?</h3>
                <p className="text-xs text-zinc-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <span className="font-semibold text-zinc-100">&quot;{routineName}&quot;</span>? Past logged workout sessions using this routine will be preserved.
            </p>

            {error && (
              <p className="text-xs text-red-400 rounded bg-red-500/10 p-2 border border-red-500/20">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
