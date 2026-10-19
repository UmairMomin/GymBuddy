"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCustomExerciseAction } from "@/features/routines/actions";
import { Edit2, Check, AlertCircle } from "lucide-react";
import type { Database } from "@/types/database.types";
import {
  CATEGORIES,
  EQUIPMENTS,
  CABLE_HANDLES,
  BARBELL_HANDLES,
} from "@/features/routines/components/create-exercise-dialog";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

export function EditExerciseDialog({
  exercise,
  onUpdated,
}: {
  exercise: ExerciseRow;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [equipment, setEquipment] = React.useState<string>(
    exercise.primary_equipment || "barbell"
  );
  const [handleType, setHandleType] = React.useState<string>(
    exercise.handle_type || ""
  );
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("id", exercise.id);

    const res = await updateCustomExerciseAction(formData);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        onUpdated?.();
      }, 800);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-zinc-400 hover:text-zinc-50"
        aria-label="Edit exercise"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Edit Exercise</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Update details and cues for &quot;{exercise.name}&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded bg-red-500/10 p-2 text-xs text-red-400 border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded bg-emerald-500/10 p-2 text-xs text-emerald-400 border border-emerald-500/20">
                <Check className="h-4 w-4 shrink-0" />
                <span>Updated successfully!</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Name *</label>
              <Input
                name="name"
                defaultValue={exercise.name}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Category *</label>
                <select
                  name="category"
                  defaultValue={exercise.category}
                  required
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Equipment</label>
                <select
                  name="primary_equipment"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize"
                >
                  <option value="">None / Other</option>
                  {EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Handle / Attachment Type Selection */}
            {equipment === "cable" && (
              <div className="space-y-1 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
                <label className="text-xs font-medium text-emerald-400">Cable Attachment / Handle</label>
                <select
                  name="handle_type"
                  value={handleType}
                  onChange={(e) => setHandleType(e.target.value)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None / Standard</option>
                  {CABLE_HANDLES.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {equipment === "barbell" && (
              <div className="space-y-1 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800">
                <label className="text-xs font-medium text-emerald-400">Barbell Type / Grip</label>
                <select
                  name="handle_type"
                  value={handleType}
                  onChange={(e) => setHandleType(e.target.value)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None / Standard</option>
                  {BARBELL_HANDLES.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Notes / Form Cues</label>
              <Input
                name="notes"
                defaultValue={exercise.notes || ""}
                placeholder="e.g. Pause 1 sec at bottom"
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="border-zinc-800 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
