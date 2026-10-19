import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExercisesAction, getOrCreateDefaultWorkspaceAction, getRoutinesAction } from "@/features/routines/actions";
import { RoutineBuilderDialog } from "@/features/routines/components/routine-builder-dialog";
import { CreateExerciseDialog } from "@/features/routines/components/create-exercise-dialog";
import { RoutinesList } from "@/features/routines/components/routines-list";
import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export async function RoutinesContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-4">
        <Lock className="h-10 w-10 text-zinc-600 mb-3" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm mb-4">
          Please sign in to view and create workout routines for your training group.
        </p>
        <Link href="/login">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold">
            Sign In to Continue
          </Button>
        </Link>
      </div>
    );
  }

  // Get or initialize workspace
  const workspaceRes = await getOrCreateDefaultWorkspaceAction();
  const workspace = workspaceRes.data;

  if (!workspace) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400">Error loading training group: {workspaceRes.error}</p>
      </div>
    );
  }

  // Fetch exercises and routines
  const [exercisesRes, routinesRes] = await Promise.all([
    getExercisesAction(workspace.id),
    getRoutinesAction(workspace.id),
  ]);

  const exercises = exercisesRes.data || [];
  const routines = routinesRes.data || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workout Routines</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {workspace.name} • Plan reusable workouts with version control
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CreateExerciseDialog workspaceId={workspace.id} />
          <RoutineBuilderDialog
            workspaceId={workspace.id}
            availableExercises={exercises}
          />
        </div>
      </div>

      {/* Routine Cards Grid with Day Filtering and CRUD Actions */}
      <RoutinesList
        routines={routines}
        availableExercises={exercises}
        workspaceId={workspace.id}
      />

      {/* Exercise Catalog Overview */}
      <section className="space-y-3 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Movement Library ({exercises.length} available)
          </h2>
          <Link href="/exercises" className="text-xs text-emerald-400 hover:underline">
            Manage all exercises →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5 text-xs space-y-1"
            >
              <p className="font-medium text-zinc-200 truncate">{ex.name}</p>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="capitalize">{ex.category}</span>
                {ex.primary_equipment && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{ex.primary_equipment}</span>
                  </>
                )}
                {ex.is_custom && (
                  <span className="ml-auto rounded bg-emerald-500/20 px-1 text-emerald-400 font-mono text-[9px]">
                    Custom
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
