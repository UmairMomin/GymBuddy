"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteExerciseAction, type PlanExercise } from "@/features/plan/actions";
import { EXERCISE_CATEGORIES } from "@/features/plan/schemas";
import { ExerciseFormSheet, labelize } from "@/features/plan/components/exercise-form-sheet";
import { cn } from "@/lib/utils";

export function ExercisesTab({ exercises }: { exercises: PlanExercise[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [editing, setEditing] = React.useState<PlanExercise | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) => (category === "all" || e.category === category) && (q === "" || e.name.toLowerCase().includes(q))
    );
  }, [exercises, query, category]);

  function remove(e: PlanExercise) {
    if (!confirm(`Delete "${e.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteExerciseAction(e.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
        <label htmlFor="ex-search" className="sr-only">Search exercises</label>
        <Input id="ex-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="pl-9" />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by muscle group">
        {["all", ...EXERCISE_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold",
              category === c ? "bg-emerald-500 text-accent-ink" : "bg-zinc-900 text-zinc-300"
            )}
          >
            {labelize(c)}
          </button>
        ))}
      </div>
      <Button variant="outline" className="w-full border-dashed" onClick={() => { setEditing(null); setFormOpen(true); }}>
        <Plus className="h-4 w-4" /> New exercise
      </Button>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <ul className="grid gap-2 md:grid-cols-2">
        {visible.map((e) => (
          <li key={e.id} className="flex min-h-[60px] items-center gap-2 rounded-2xl bg-zinc-900 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-50">{e.name}</p>
              <p className="text-xs text-zinc-400">
                {labelize(e.category)}
                {e.primary_equipment ? ` · ${labelize(e.primary_equipment)}` : ""}
                {e.is_custom ? " · Yours" : ""}
              </p>
            </div>
            {e.is_custom && (
              <>
                <Button variant="ghost" size="icon" aria-label={`Edit ${e.name}`} onClick={() => { setEditing(e); setFormOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${e.name}`} disabled={pending} onClick={() => remove(e)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="p-4 text-center text-sm text-zinc-400">No matching exercises.</p>}

      <ExerciseFormSheet open={formOpen} onClose={() => setFormOpen(false)} exercise={editing} onSaved={() => router.refresh()} />
    </div>
  );
}
