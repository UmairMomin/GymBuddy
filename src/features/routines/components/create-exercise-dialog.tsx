"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomExerciseAction } from "@/features/routines/actions";
import { Plus, Loader2, Check, AlertCircle } from "lucide-react";

const CATEGORIES = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "cardio",
  "full_body",
  "other",
] as const;

const EQUIPMENTS = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "other",
] as const;

export function CreateExerciseDialog({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("workspace_id", workspaceId);

    const res = await createCustomExerciseAction(formData);
    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        onCreated?.();
      }, 1000);
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-zinc-700 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        New Exercise
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Create Custom Exercise</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Add a movement specific to your training group.
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
                <span>Exercise created successfully!</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Name</label>
              <Input
                name="name"
                placeholder="e.g. Bulgarian Split Squat"
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Category</label>
                <select
                  name="category"
                  required
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Equipment</label>
                <select
                  name="primary_equipment"
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None / Other</option>
                  {EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq.charAt(0).toUpperCase() + eq.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Notes / Cue (Optional)</label>
              <Input
                name="notes"
                placeholder="e.g. Elevate back foot on 6-inch block"
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
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
                className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Exercise"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
