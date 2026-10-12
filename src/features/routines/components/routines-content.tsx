import { createClient } from "@/lib/supabase/server";
import { getExercisesAction, getOrCreateDefaultWorkspaceAction, getRoutinesAction } from "@/features/routines/actions";
import { RoutineBuilderDialog } from "@/features/routines/components/routine-builder-dialog";
import { CreateExerciseDialog } from "@/features/routines/components/create-exercise-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Play, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export async function RoutinesContent() {
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
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold">
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

      {/* Routine Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Available Routines ({routines.length})
          </h2>
        </div>

        {routines.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-transparent text-center p-8">
            <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-300">No routines created yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
              Build your first split (Push, Pull, Legs, etc.) to quickly launch synchronized sessions with your gym partners.
            </p>
            <RoutineBuilderDialog
              workspaceId={workspace.id}
              availableExercises={exercises}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {routines.map((routine) => {
              const latestVersion = routine.routine_versions?.[0];
              const plannedExercises = (latestVersion?.structure_json as Array<{
                exercise_name: string;
                target_sets: number;
                target_reps: string;
              }>) || [];

              return (
                <Card
                  key={routine.id}
                  className="border-zinc-800 bg-zinc-900/60 shadow-md flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold">
                        {routine.name}
                      </CardTitle>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                        v{latestVersion?.version_number ?? 1}
                      </span>
                    </div>
                    {routine.description && (
                      <CardDescription className="text-xs text-zinc-400 line-clamp-2">
                        {routine.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1.5 rounded-lg bg-zinc-950/60 p-2.5 text-xs">
                      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                        Planned Movements ({plannedExercises.length})
                      </p>
                      <ul className="space-y-1 text-zinc-300">
                        {plannedExercises.slice(0, 4).map((ex, i) => (
                          <li key={i} className="flex justify-between items-center text-xs">
                            <span className="truncate">{ex.exercise_name}</span>
                            <span className="text-zinc-500 font-mono text-[11px]">
                              {ex.target_sets} × {ex.target_reps}
                            </span>
                          </li>
                        ))}
                        {plannedExercises.length > 4 && (
                          <li className="text-[11px] text-zinc-500 italic">
                            +{plannedExercises.length - 4} more movements
                          </li>
                        )}
                      </ul>
                    </div>

                    <Link href={`/?routineId=${routine.id}`} className="block">
                      <Button className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold h-10">
                        <Play className="h-4 w-4 fill-zinc-950" />
                        Start Session
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Exercise Catalog Overview */}
      <section className="space-y-3 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Movement Library ({exercises.length} available)
          </h2>
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
