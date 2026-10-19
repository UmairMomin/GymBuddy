"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditRoutineDialog } from "@/features/routines/components/edit-routine-dialog";
import { DeleteRoutineButton } from "@/features/routines/components/delete-routine-button";
import { RoutineBuilderDialog } from "@/features/routines/components/routine-builder-dialog";
import type { Database } from "@/types/database.types";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];

interface RoutineItem {
  id: string;
  name: string;
  description: string | null;
  day_of_week: string | null;
  routine_versions?: Array<{
    version_number: number;
    structure_json: unknown;
  }>;
}

const DAYS_FILTER = [
  { key: "all", label: "All Days" },
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
  { key: "freestyle", label: "Freestyle" },
] as const;

const DAY_BADGE_COLORS: Record<string, string> = {
  monday: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  tuesday: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  wednesday: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  thursday: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  friday: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  saturday: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  sunday: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
};

export function RoutinesList({
  routines,
  availableExercises,
  workspaceId,
}: {
  routines: RoutineItem[];
  availableExercises: ExerciseRow[];
  workspaceId: string;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = React.useState<string>("all");

  const filteredRoutines = React.useMemo(() => {
    if (selectedDay === "all") return routines;
    if (selectedDay === "freestyle") {
      return routines.filter((r) => !r.day_of_week);
    }
    return routines.filter((r) => r.day_of_week?.toLowerCase() === selectedDay.toLowerCase());
  }, [routines, selectedDay]);

  // Today's day of the week in lowercase
  const todayName = React.useMemo(() => {
    return new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  }, []);

  return (
    <div className="space-y-4">
      {/* Day Filter Pills */}
      <div className="-mx-4 flex snap-x items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {DAYS_FILTER.map((day) => {
          const isSelected = selectedDay === day.key;
          const isToday = day.key === todayName;
          const count =
            day.key === "all"
              ? routines.length
              : day.key === "freestyle"
              ? routines.filter((r) => !r.day_of_week).length
              : routines.filter((r) => r.day_of_week === day.key).length;

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDay(day.key)}
              className={`flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 rounded-xl border px-4 font-display text-base font-bold uppercase tracking-wide transition-colors ${
                isSelected
                  ? "border-emerald-500 bg-emerald-500 text-accent-ink"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-50"
              }`}
            >
              <span>{day.label}</span>
              {isToday && day.key !== "all" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.2 ${
                  isSelected ? "bg-zinc-950/20 text-accent-ink" : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredRoutines.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-transparent text-center p-8">
          <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-300">
            {selectedDay === "all"
              ? "No routines created yet"
              : `No routine scheduled for ${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}`}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
            Build a split to plan target sets, rep ranges, and auto-populate exercises during sessions.
          </p>
          <div className="flex justify-center">
            <RoutineBuilderDialog
              workspaceId={workspaceId}
              availableExercises={availableExercises}
              onCreated={() => router.refresh()}
            />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredRoutines.map((routine) => {
            const latestVersion = routine.routine_versions?.[0];
            const plannedExercises = (latestVersion?.structure_json as Array<{
              exercise_name: string;
              target_sets: number;
              target_reps: string;
            }>) || [];

            const isTodayRoutine = routine.day_of_week === todayName;

            return (
              <Card
                key={routine.id}
                className={`border-zinc-800 bg-zinc-900/60 shadow-md flex flex-col justify-between transition-all ${
                  isTodayRoutine ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-2xl font-bold text-zinc-50">
                          {routine.name}
                        </CardTitle>
                        {routine.day_of_week ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border capitalize ${
                              DAY_BADGE_COLORS[routine.day_of_week] || "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {routine.day_of_week}
                            {isTodayRoutine ? " (Today)" : ""}
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            Freestyle
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 mr-1">
                        v{latestVersion?.version_number ?? 1}
                      </span>
                      <EditRoutineDialog
                        routine={routine}
                        availableExercises={availableExercises}
                        onUpdated={() => router.refresh()}
                      />
                      <DeleteRoutineButton
                        routineId={routine.id}
                        routineName={routine.name}
                        onDeleted={() => router.refresh()}
                      />
                    </div>
                  </div>

                  {routine.description && (
                    <CardDescription className="text-xs text-zinc-400 line-clamp-2 mt-1">
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
                    <Button className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold h-12 text-base">
                      <Play className="h-4 w-4 fill-current" />
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
  );
}
