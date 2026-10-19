"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ScheduledWorkoutItem,
  scheduleWorkoutAction,
  startScheduledWorkoutAction,
  cancelScheduledWorkoutAction,
} from "@/features/scheduling/actions";
import {
  Calendar,
  Clock,
  Play,
  Plus,
  Loader2,
  Trash2,
  Dumbbell,
  AlertCircle,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

export function UpcomingWorkoutsCard({
  workspaceId,
  initialWorkouts,
  routines,
}: {
  workspaceId: string;
  initialWorkouts: ScheduledWorkoutItem[];
  routines: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [workouts, setWorkouts] = React.useState<ScheduledWorkoutItem[]>(initialWorkouts);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = React.useState<string>(routines[0]?.id || "");
  const [scheduledDateTime, setScheduledDateTime] = React.useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [startingId, setStartingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDateTime) return;
    setLoading(true);
    setError(null);

    const res = await scheduleWorkoutAction({
      workspaceId,
      routineId: selectedRoutineId || undefined,
      scheduledFor: new Date(scheduledDateTime).toISOString(),
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setDialogOpen(false);
      setNotes("");
      router.refresh();
    }
  }

  async function handleStartWorkout(scheduledId: string) {
    setStartingId(scheduledId);
    setError(null);

    const res = await startScheduledWorkoutAction(scheduledId);
    if (res.error || !res.data) {
      setError(res.error || "Failed to start scheduled workout");
      setStartingId(null);
    } else {
      router.push(`/session/${res.data.sessionId}`);
    }
  }

  async function handleCancelWorkout(scheduledId: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== scheduledId));
    await cancelScheduledWorkoutAction(scheduledId);
    router.refresh();
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>Upcoming Scheduled Workouts</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Plan workout splits with gym partners in advance
          </CardDescription>
        </div>

        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold gap-1 text-xs h-8 px-2.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 mb-3 text-xs text-red-400 border border-red-500/20">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {workouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            <Clock className="h-7 w-7 text-zinc-600 mx-auto mb-2" />
            <p className="font-medium text-zinc-300">No scheduled sessions</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Plan your next Push, Pull, or Leg session with your group.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {workouts.map((w) => {
              const dt = new Date(w.scheduled_for);
              const dateStr = dt.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const timeStr = dt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={w.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
                        <Dumbbell className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{w.routine_name}</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {dateStr} at {timeStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-zinc-500" />
                        <span>{w.creator_name}</span>
                      </span>
                      {w.notes && <span className="italic text-zinc-500 truncate max-w-xs">{w.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleCancelWorkout(w.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 transition-colors"
                      title="Cancel scheduled workout"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <Button
                      size="sm"
                      onClick={() => handleStartWorkout(w.id)}
                      disabled={startingId === w.id}
                      className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-bold text-xs h-8 gap-1.5 shadow-md shadow-emerald-500/15"
                    >
                      {startingId === w.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                      Start Workout
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SCHEDULE DIALOG */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  <span>Schedule Future Workout</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200 text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleScheduleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Workout Routine</label>
                  <select
                    value={selectedRoutineId}
                    onChange={(e) => setSelectedRoutineId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Freestyle (No Routine)</option>
                    {routines.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300">Date & Time *</label>
                  <Input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="mt-1 bg-zinc-900 border-zinc-800 text-xs font-mono h-10"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300">Notes (Optional)</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Focus on heavy bench + chest flies"
                    className="mt-1 bg-zinc-900 border-zinc-800 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1 border-zinc-800 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !scheduledDateTime}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs gap-1.5"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Schedule
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
