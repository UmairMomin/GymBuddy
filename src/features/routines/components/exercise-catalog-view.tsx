"use client";

import * as React from "react";
import { CreateExerciseDialog } from "@/features/routines/components/create-exercise-dialog";
import { EditExerciseDialog } from "@/features/routines/components/edit-exercise-dialog";
import { DeleteExerciseButton } from "@/features/routines/components/delete-exercise-button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Dumbbell, Filter } from "lucide-react";
import type { Database } from "@/types/database.types";
import { useRouter } from "next/navigation";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

const CATEGORIES = [
  "all",
  "chest",
  "back",
  "legs",
  "shoulders",
  "bicep",
  "tricep",
  "core",
  "cardio",
  "full_body",
] as const;

const EQUIPMENTS = [
  "all",
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
] as const;

export function ExerciseCatalogView({
  exercises,
  workspaceId,
}: {
  exercises: ExerciseRow[];
  workspaceId: string;
}) {
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedEquipment, setSelectedEquipment] = React.useState<string>("all");
  const router = useRouter();

  const filteredExercises = React.useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.notes && ex.notes.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory =
        selectedCategory === "all" || ex.category.toLowerCase() === selectedCategory.toLowerCase();

      const matchesEquipment =
        selectedEquipment === "all" ||
        (ex.primary_equipment &&
          ex.primary_equipment.toLowerCase() === selectedEquipment.toLowerCase());

      return matchesSearch && matchesCategory && matchesEquipment;
    });
  }, [exercises, search, selectedCategory, selectedEquipment]);

  const customCount = exercises.filter((e) => e.is_custom).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movement Library</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {exercises.length} total exercises • {customCount} custom for your training group
          </p>
        </div>
        <CreateExerciseDialog workspaceId={workspaceId} onCreated={() => router.refresh()} />
      </div>

      {/* Filters & Search Toolbar */}
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search exercises by name or cues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-950/80 border-zinc-800 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400 mr-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-medium">Category:</span>
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-500 text-accent-ink"
                  : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400 mr-2">
            <span className="font-medium">Equipment:</span>
          </div>
          {EQUIPMENTS.map((eq) => (
            <button
              key={eq}
              type="button"
              onClick={() => setSelectedEquipment(eq)}
              className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                selectedEquipment === eq
                  ? "bg-emerald-500 text-accent-ink"
                  : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <span>Showing {filteredExercises.length} movements</span>
        </div>

        {filteredExercises.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-transparent text-center p-8">
            <Dumbbell className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">No exercises found</p>
            <p className="text-xs text-zinc-500 mt-1">
              Try adjusting your search or category filter.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {exercise.name}
                    </h3>
                    {exercise.is_custom ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 shrink-0">
                        Custom
                      </span>
                    ) : (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                        Standard
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                    <span className="capitalize text-zinc-300">{exercise.category}</span>
                    {exercise.primary_equipment && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{exercise.primary_equipment}</span>
                      </>
                    )}
                    {exercise.handle_type && (
                      <span className="ml-1 inline-flex items-center rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/20 capitalize">
                        {exercise.handle_type.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  {exercise.notes && (
                    <p className="text-xs text-zinc-500 italic line-clamp-2 pt-1 border-t border-zinc-800/60 mt-2">
                      &quot;{exercise.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Edit & Delete actions for custom exercises */}
                {exercise.is_custom && (
                  <div className="flex items-center justify-end gap-1 pt-3 mt-3 border-t border-zinc-800/80">
                    <EditExerciseDialog
                      exercise={exercise}
                      onUpdated={() => router.refresh()}
                    />
                    <DeleteExerciseButton
                      exercise={exercise}
                      onDeleted={() => router.refresh()}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
