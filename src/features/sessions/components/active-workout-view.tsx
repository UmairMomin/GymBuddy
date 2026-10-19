"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RestTimer } from "@/features/sessions/components/rest-timer";
import {
  addSetAction,
  updateSetAction,
  deleteSetAction,
  deleteExerciseFromSessionAction,
  addExerciseToSessionAction,
  saveSessionExercisesToRoutineAction,
  finishWorkoutSessionAction,
  joinWorkoutSessionAction,
  finishParticipantWorkoutAction,
  getPostWorkoutSummaryAction,
} from "@/features/sessions/actions";
import {
  Check,
  Plus,
  Trash2,
  Clock,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  UserCheck,
  UserPlus,
  Trophy,
  Flame,
  Award,
  Sparkles,
  BookmarkCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

type SetRecord = {
  id: string;
  exercise_id: string;
  user_id: string;
  set_order: number;
  set_type: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  revision_number: number;
  exercises?: {
    id: string;
    name: string;
    category: string;
  } | null;
  profiles?: {
    id: string;
    display_name: string;
  } | null;
};

type ParticipantData = {
  user_id: string;
  completed_at?: string | null;
  profiles?: { id: string; display_name: string; email: string } | null;
};

type SessionData = {
  id: string;
  name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  workspace_id: string;
  routine_id?: string | null;
  routines?: { id: string; name: string; day_of_week?: string | null } | null;
  session_participants?: ParticipantData[];
};

type SummaryPayload = {
  sessionName: string;
  startedAt: string;
  endedAt: string | null;
  personal: {
    volumeKg: number;
    completedSets: number;
    topLift: { exerciseName: string; weightKg: number; reps: number } | null;
  };
  group: {
    totalVolumeKg: number;
    totalCompletedSets: number;
    participants: Array<{
      userId: string;
      displayName: string;
      volumeKg: number;
      completedSets: number;
      completedAt: string | null;
    }>;
  };
};

export function ActiveWorkoutView({
  session,
  initialSets,
  availableExercises,
  currentUserId,
}: {
  session: SessionData;
  initialSets: SetRecord[];
  availableExercises: Array<{ id: string; name: string; category: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [sets, setSets] = React.useState<SetRecord[]>(initialSets);
  const [participants, setParticipants] = React.useState<ParticipantData[]>(
    session.session_participants || []
  );
  const [finishing, setFinishing] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [activePartnerCount, setActivePartnerCount] = React.useState(1);
  const [selectedExerciseId, setSelectedExerciseId] = React.useState(
    availableExercises[0]?.id || ""
  );
  const [addSetsCount, setAddSetsCount] = React.useState(3);
  const [addReps, setAddReps] = React.useState("10");
  const [addingExercise, setAddingExercise] = React.useState(false);
  const [savingRoutine, setSavingRoutine] = React.useState(false);
  const [saveRoutineSuccess, setSaveRoutineSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filter mode: "all" | "mine" | "partners"
  const [filterMode, setFilterMode] = React.useState<"all" | "mine" | "partners">("all");

  // Post-Workout Summary Dialog
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  // True right after "Finish": closing the summary then leaves the finished workout.
  const [leaveOnClose, setLeaveOnClose] = React.useState(false);
  const [summaryTab, setSummaryTab] = React.useState<"personal" | "group">("personal");
  const [summaryData, setSummaryData] = React.useState<SummaryPayload | null>(null);

  // Check if current user is participant
  const isJoined = participants.some((p) => p.user_id === currentUserId);
  const myParticipant = participants.find((p) => p.user_id === currentUserId);
  const hasMyWorkoutCompleted = Boolean(myParticipant?.completed_at);

  // Elapsed workout time: ticks while training, freezes at the moment you finished (or the session ended).
  const [elapsed, setElapsed] = React.useState("00:00");
  const stoppedAt = myParticipant?.completed_at ?? session.ended_at ?? null;
  React.useEffect(() => {
    const startTime = new Date(session.started_at).getTime();
    const endTime = stoppedAt ? new Date(stoppedAt).getTime() : null;
    const updateElapsed = () => {
      const diffSecs = Math.max(0, Math.floor(((endTime ?? Date.now()) - startTime) / 1000));
      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      setElapsed(hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`);
    };
    updateElapsed();
    if (endTime !== null) return;
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session.started_at, stoppedAt]);

  // SUPABASE REALTIME SUBSCRIPTION & PRESENCE
  React.useEffect(() => {
    const supabase = createClient();
    const channelName = `session:${session.id}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    // 1. Listen for set changes in real time (INSERT, UPDATE, DELETE)
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workout_sets",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const newSet = payload.new as SetRecord;
          setSets((prev) => {
            if (prev.some((s) => s.id === newSet.id)) return prev;
            const ex = availableExercises.find((e) => e.id === newSet.exercise_id);
            return [...prev, { ...newSet, exercises: ex || null }];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workout_sets",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as SetRecord;
          setSets((prev) =>
            prev.map((s) => {
              if (s.id !== updated.id) return s;
              return {
                ...s,
                ...updated,
                exercises: s.exercises, // preserve relations
                profiles: s.profiles,
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "workout_sets",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setSets((prev) => prev.filter((s) => s.id !== deletedId));
        }
      )
      // 2. Listen for participant changes (joins, individual finishes)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_participants",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newP = payload.new as ParticipantData;
            setParticipants((prev) => {
              if (prev.some((p) => p.user_id === newP.user_id)) return prev;
              return [...prev, newP];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedP = payload.new as ParticipantData;
            setParticipants((prev) =>
              prev.map((p) => (p.user_id === updatedP.user_id ? { ...p, ...updatedP } : p))
            );
          }
        }
      )
      // 3. Track collaborative presence
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const userCount = Object.keys(presenceState).length;
        setActivePartnerCount(Math.max(1, userCount));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          channel.track({
            online_at: new Date().toISOString(),
            user_id: currentUserId,
          });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, currentUserId, availableExercises]);

  // Filter sets according to tab
  const filteredSets = React.useMemo(() => {
    if (filterMode === "mine") {
      return sets.filter((s) => s.user_id === currentUserId);
    }
    if (filterMode === "partners") {
      return sets.filter((s) => s.user_id !== currentUserId);
    }
    return sets;
  }, [sets, filterMode, currentUserId]);

  // Group sets by exercise
  const exercisesInSession = React.useMemo(() => {
    const map = new Map<string, { exercise: { id: string; name: string }; sets: SetRecord[] }>();
    filteredSets.forEach((s) => {
      const ex = s.exercises || availableExercises.find((e) => e.id === s.exercise_id);
      const name = ex?.name || "Exercise";
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, { exercise: { id: s.exercise_id, name }, sets: [] });
      }
      map.get(s.exercise_id)!.sets.push(s);
    });
    return Array.from(map.values());
  }, [filteredSets, availableExercises]);

  async function handleJoinWorkout() {
    setJoining(true);
    setError(null);
    const res = await joinWorkoutSessionAction(session.id);
    setJoining(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  async function handleAddSet(exerciseId: string) {
    const exSets = sets.filter((s) => s.exercise_id === exerciseId);
    const lastSet = exSets[exSets.length - 1];

    const newOrder = exSets.length + 1;
    const defaultWeight = lastSet ? lastSet.weight_kg : 0;
    const defaultReps = lastSet ? lastSet.reps : 10;

    const res = await addSetAction({
      session_id: session.id,
      exercise_id: exerciseId,
      user_id: currentUserId,
      set_order: newOrder,
      set_type: "normal",
      weight_kg: defaultWeight,
      reps: defaultReps,
      completed: false,
    });

    if (res.data) {
      const created = res.data as SetRecord;
      setSets((prev) => {
        if (prev.some((s) => s.id === created.id)) return prev;
        const ex = availableExercises.find((e) => e.id === created.exercise_id);
        return [...prev, { ...created, exercises: ex || null }];
      });
    }
  }

  async function handleUpdateField(
    setId: string,
    field: "weight_kg" | "reps" | "completed" | "set_type",
    value: number | boolean | string
  ) {
    const current = sets.find((s) => s.id === setId);
    if (!current) return;

    // Optimistic UI update
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
    );

    const res = await updateSetAction({
      id: setId,
      [field]: value,
      revision_number: current.revision_number,
    });

    if (res.error) {
      setError(res.error);
      router.refresh(); // fetch authoritative state on conflict
    } else if (res.data) {
      const updated = res.data as SetRecord;
      setSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, revision_number: updated.revision_number } : s))
      );
    }
  }

  async function handleDeleteSet(setId: string) {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    const res = await deleteSetAction(setId);
    if (res.error) {
      setError(res.error);
      router.refresh();
    }
  }

  async function handleDeleteExercise(exerciseId: string) {
    // Optimistic local state update
    setSets((prev) => prev.filter((s) => s.exercise_id !== exerciseId));
    const res = await deleteExerciseFromSessionAction(session.id, exerciseId);
    if (res?.error) {
      setError(res.error);
      router.refresh();
    }
  }

  async function handleAddExerciseWithSets() {
    if (!selectedExerciseId) return;
    setAddingExercise(true);
    setError(null);
    const res = await addExerciseToSessionAction({
      sessionId: session.id,
      exerciseId: selectedExerciseId,
      targetSets: addSetsCount,
      targetReps: addReps,
    });
    setAddingExercise(false);
    if (res?.error) {
      setError(res.error);
    } else if (res?.data && Array.isArray(res.data)) {
      setSets((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newItems = (res.data as SetRecord[]).filter((s) => !existingIds.has(s.id));
        return [...prev, ...newItems];
      });
    }
  }

  async function handleSaveToRoutine() {
    if (!session.routine_id) return;
    setSavingRoutine(true);
    setError(null);
    const res = await saveSessionExercisesToRoutineAction(session.id, session.routine_id);
    setSavingRoutine(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setSaveRoutineSuccess(true);
      setTimeout(() => setSaveRoutineSuccess(false), 4000);
    }
  }

  async function handleFinishMyWorkout() {
    setFinishing(true);
    setError(null);
    const res = await finishParticipantWorkoutAction(session.id);
    if (res.error) {
      setError(res.error);
      setFinishing(false);
    } else {
      const completedAt = new Date().toISOString();
      setParticipants((prev) =>
        prev.map((p) => (p.user_id === currentUserId ? { ...p, completed_at: completedAt } : p))
      );
      // Fetch dual summary
      const sumRes = await getPostWorkoutSummaryAction(session.id);
      setFinishing(false);
      if (sumRes.data) {
        setSummaryData(sumRes.data);
        setLeaveOnClose(true);
        setSummaryOpen(true);
      } else {
        router.push("/");
      }
    }
  }

  async function handleFinishSessionForAll() {
    setFinishing(true);
    setError(null);
    const res = await finishWorkoutSessionAction(session.id);
    if (res.error) {
      setError(res.error);
      setFinishing(false);
    } else {
      setParticipants((prev) =>
        prev.map((p) => (p.completed_at ? p : { ...p, completed_at: new Date().toISOString() }))
      );
      const sumRes = await getPostWorkoutSummaryAction(session.id);
      setFinishing(false);
      if (sumRes.data) {
        setSummaryData(sumRes.data);
        setLeaveOnClose(true);
        setSummaryOpen(true);
      } else {
        router.push("/analytics");
      }
    }
  }

  function closeSummary() {
    setSummaryOpen(false);
    if (leaveOnClose) {
      setLeaveOnClose(false);
      router.push("/");
      router.refresh();
    }
  }

  async function handleViewSummary() {
    const sumRes = await getPostWorkoutSummaryAction(session.id);
    if (sumRes.data) {
      setSummaryData(sumRes.data);
      setSummaryOpen(true);
    }
  }

  // Summary Metrics
  const completedSetsCount = sets.filter((s) => s.completed).length;
  const totalVolume = sets
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + s.weight_kg * s.reps, 0);

  return (
    <div className="space-y-5 pb-48 md:pb-28">
      {/* Join Workout Banner for Co-Trainees */}
      {!isJoined && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-700/10 border border-emerald-500/30 p-4">
          <div className="flex items-center gap-3">
            <UserPlus className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-sm text-zinc-100">Join This Workout Session</p>
              <p className="text-xs text-zinc-400">
                You are viewing an active group workout. Join to log your own sets alongside your gym buddies.
              </p>
            </div>
          </div>
          <Button
            onClick={handleJoinWorkout}
            disabled={joining}
            className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-bold text-xs h-9 gap-1.5 shrink-0 ml-3"
          >
            {joining && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Join Workout
          </Button>
        </div>
      )}

      {/* Session Header Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Active Workout
                </span>
                {session.routine_id && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20 capitalize">
                    {session.routines?.day_of_week ? `${session.routines.day_of_week} Routine` : "Routine Split"}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <h1 className="min-w-0 truncate text-3xl font-extrabold leading-none tracking-wide text-zinc-50 sm:text-4xl">
                  {session.name}
                </h1>
                <div className="flex shrink-0 items-center gap-1.5 font-display text-3xl font-extrabold leading-none tracking-wide text-emerald-400">
                  <Clock className="h-4 w-4" />
                  <span>{elapsed}</span>
                </div>
              </div>
            </div>

            {/* Badges & Actions: Save Routine, Connection, Presence, Timer */}
            <div className="flex flex-wrap items-center gap-2">
              {session.routine_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToRoutine}
                  disabled={savingRoutine}
                  className="h-9 min-h-0 gap-1.5 rounded-lg border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs text-emerald-400 hover:bg-emerald-500/20"
                  title="Update routine with extra or modified exercises added during this workout"
                >
                  {savingRoutine ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : saveRoutineSuccess ? (
                    <BookmarkCheck className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{saveRoutineSuccess ? "Routine updated!" : "Save to routine"}</span>
                </Button>
              )}
              <div
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium border ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span>Reconnecting</span>
                  </>
                )}
              </div>

              {/* Collaborative Partner Presence */}
              {activePartnerCount > 1 && (
                <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <UserCheck className="h-3 w-3" />
                  <span>{activePartnerCount} active</span>
                </div>
              )}

              {/* Elapsed Duration */}

            </div>
          </div>

          {/* Participant completion indicators */}
          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/80">
              
              {participants.map((p) => {
                const isMe = p.user_id === currentUserId;
                const name = p.profiles?.display_name || "Trainee";
                const isFinished = Boolean(p.completed_at);
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                      isFinished
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                        : "bg-zinc-800/60 text-zinc-300 border-zinc-700/60"
                    }`}
                  >
                    <span>{isMe ? "You" : name}</span>
                    {isFinished && <Check className="h-3 w-3 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
            <div className="flex items-center gap-4">
              <span>
                Sets: <strong className="text-zinc-200">{completedSetsCount}</strong> / {sets.length}
              </span>
              <span>
                Volume: <strong className="text-emerald-400">{totalVolume.toLocaleString()} kg</strong>
              </span>
            </div>

            {hasMyWorkoutCompleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewSummary}
                className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 p-1 px-2"
              >
                <Trophy className="h-3.5 w-3.5" />
                View Summary
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RestTimer />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs: All Sets / My Sets / Partner's Sets */}
      {participants.length > 1 && (
        <div role="tablist" aria-label="Filter sets" className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {(
            [
              ["all", "All", sets.length],
              ["mine", "Mine", sets.filter((s) => s.user_id === currentUserId).length],
              ["partners", "Partners", sets.filter((s) => s.user_id !== currentUserId).length],
            ] as const
          ).map(([mode, label, count]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={filterMode === mode}
              onClick={() => setFilterMode(mode)}
              className={`min-h-[44px] rounded-lg font-display text-base font-bold uppercase tracking-wider transition-colors ${
                filterMode === mode
                  ? "bg-emerald-500 text-accent-ink"
                  : "text-zinc-400 hover:text-zinc-50"
              }`}
            >
              {label} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Exercises & Set Rows */}
      <div className="space-y-6">
        {exercisesInSession.map(({ exercise, sets: exSets }) => (
          <div
            key={exercise.id}
            className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 text-xl font-bold leading-tight text-zinc-50">
                <Dumbbell className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">{exercise.name}</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddSet(exercise.id)}
                  className="h-11 gap-1 px-3 text-xs text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Plus className="h-4 w-4" />
                  Add Set
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteExercise(exercise.id)}
                  className="h-11 w-11 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Remove exercise from workout"
                  aria-label="Remove exercise from workout"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Set Table Header */}
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              <span className="text-center">Set</span>
              <span className="text-center">Kg</span>
              <span className="text-center">Reps</span>
              <span className="sr-only">Done</span>
            </div>

            {/* Set Rows */}
            <div className="space-y-2">
              {exSets.map((s, idx) => {
                const isMySet = s.user_id === currentUserId;
                const traineeName =
                  s.profiles?.display_name ||
                  participants.find((p) => p.user_id === s.user_id)?.profiles?.display_name ||
                  "Trainee";
                const initials = traineeName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-2 transition-colors ${
                      s.completed
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950/60"
                    }`}
                  >
                    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2">
                      {/* Set number + trainee attribution */}
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className="font-display text-2xl font-bold text-zinc-300">{idx + 1}</span>
                        <span
                          className={`mt-1 rounded px-1 text-[10px] font-bold uppercase ${
                            isMySet ? "bg-emerald-500 text-accent-ink" : "bg-zinc-800 text-zinc-300"
                          }`}
                          title={traineeName}
                        >
                          {isMySet ? "You" : initials}
                        </span>
                      </div>

                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        aria-label={`Weight in kg for set ${idx + 1}`}
                        value={s.weight_kg === 0 ? "" : s.weight_kg}
                        placeholder="0"
                        onChange={(e) =>
                          handleUpdateField(s.id, "weight_kg", parseFloat(e.target.value) || 0)
                        }
                        className="h-12 bg-zinc-900 px-1 text-center font-display text-2xl font-bold text-zinc-50"
                      />

                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        aria-label={`Reps for set ${idx + 1}`}
                        value={s.reps === 0 ? "" : s.reps}
                        placeholder="0"
                        onChange={(e) =>
                          handleUpdateField(s.id, "reps", parseInt(e.target.value) || 0)
                        }
                        className="h-12 bg-zinc-900 px-1 text-center font-display text-2xl font-bold text-zinc-50"
                      />

                      <button
                        type="button"
                        onClick={() => handleUpdateField(s.id, "completed", !s.completed)}
                        aria-pressed={s.completed}
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all active:scale-90 ${
                          s.completed
                            ? "border-emerald-500 bg-emerald-500 text-accent-ink"
                            : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-500"
                        }`}
                        aria-label={s.completed ? "Mark set not done" : "Mark set complete"}
                      >
                        <Check className="h-6 w-6 stroke-[3]" />
                      </button>
                    </div>

                    <div className="mt-1 flex items-center justify-between px-1">
                      <select
                        value={s.set_type}
                        onChange={(e) => handleUpdateField(s.id, "set_type", e.target.value)}
                        aria-label={`Set type for set ${idx + 1}`}
                        className="min-h-[36px] bg-transparent text-[11px] font-semibold uppercase tracking-wider text-zinc-400 focus:outline-none"
                      >
                        <option value="normal" className="bg-zinc-900">Normal</option>
                        <option value="warmup" className="bg-zinc-900">Warm-up</option>
                        <option value="drop" className="bg-zinc-900">Drop</option>
                        <option value="failure" className="bg-zinc-900">Failure</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteSet(s.id)}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center text-zinc-600 transition-colors hover:text-red-400"
                        aria-label="Delete set"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Add Another Movement to Active Session */}
        {availableExercises.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-700 p-3 text-center text-sm text-zinc-400">
            No exercises available yet. Add some on the{" "}
            <a href="/exercises" className="font-semibold text-emerald-400 underline underline-offset-4">
              Exercises
            </a>{" "}
            page, then come back to add them here.
          </p>
        )}
        <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-dashed border-zinc-700 p-3 sm:flex-row sm:items-center">
          <select
            value={selectedExerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
            className="h-11 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {availableExercises.map((e) => (
              <option key={e.id} value={e.id}>
                + Add {e.name} ({e.category})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-md text-xs">
              <span className="text-zinc-500 text-[11px]">Sets:</span>
              <input
                type="number"
                min={1}
                max={15}
                value={addSetsCount}
                onChange={(e) => setAddSetsCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-10 bg-transparent text-center font-mono font-semibold text-zinc-100 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-md text-xs">
              <span className="text-zinc-500 text-[11px]">Reps:</span>
              <input
                type="text"
                value={addReps}
                onChange={(e) => setAddReps(e.target.value)}
                className="w-12 bg-transparent text-center font-mono font-semibold text-zinc-100 focus:outline-none"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddExerciseWithSets}
              disabled={addingExercise}
              className="gap-1 whitespace-nowrap bg-emerald-500 px-3 text-xs font-semibold text-accent-ink hover:bg-emerald-600"
            >
              {addingExercise ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Movement
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Action Bar: Finish Options */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="hidden text-xs text-zinc-400 sm:block">
            <span>Completed <strong>{completedSetsCount}</strong> sets</span>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            {!hasMyWorkoutCompleted ? (
              <Button
                onClick={handleFinishMyWorkout}
                disabled={finishing}
                className="h-12 flex-1 gap-2 bg-emerald-500 px-4 text-sm font-bold text-accent-ink hover:bg-emerald-600 sm:flex-none"
              >
                {finishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Finish My Workout
              </Button>
            ) : (
              <Button
                onClick={handleViewSummary}
                className="h-12 flex-1 gap-2 border border-emerald-500/40 bg-emerald-500/20 px-4 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 sm:flex-none"
              >
                <Trophy className="h-4 w-4" />
                Summary
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleFinishSessionForAll}
              disabled={finishing}
              className="h-12 border-zinc-700 px-3 text-xs text-zinc-300 hover:text-zinc-50"
            >
              End for All
            </Button>
          </div>
        </div>
      </div>

      {/* POST-WORKOUT DUAL SUMMARY DIALOG */}
      {summaryOpen && summaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Workout Summary
                </span>
                <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-emerald-400" />
                  <span>{summaryData.sessionName}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSummary}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Dual Tabs: Personal vs Team Combined */}
            <div className="flex border-b border-zinc-800">
              <button
                type="button"
                onClick={() => setSummaryTab("personal")}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  summaryTab === "personal"
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Your Performance
              </button>
              <button
                type="button"
                onClick={() => setSummaryTab("group")}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  summaryTab === "group"
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Team Combined Summary
              </button>
            </div>

            {summaryTab === "personal" ? (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-900/60 p-4 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[11px] uppercase font-semibold">
                      Your Volume
                    </span>
                    <p className="text-2xl font-bold font-mono text-emerald-400">
                      {summaryData.personal.volumeKg.toLocaleString()} <span className="text-xs text-zinc-400">kg</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900/60 p-4 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[11px] uppercase font-semibold">
                      Completed Sets
                    </span>
                    <p className="text-2xl font-bold font-mono text-zinc-100">
                      {summaryData.personal.completedSets}
                    </p>
                  </div>
                </div>

                {summaryData.personal.topLift && (
                  <div className="rounded-xl bg-zinc-900/40 p-4 border border-zinc-800 flex items-center gap-3">
                    <Award className="h-8 w-8 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold uppercase">Top Performance</p>
                      <p className="text-sm font-bold text-zinc-100">
                        {summaryData.personal.topLift.exerciseName} — {summaryData.personal.topLift.weightKg} kg × {summaryData.personal.topLift.reps} reps
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-900/60 p-4 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[11px] uppercase font-semibold">
                      Combined Team Volume
                    </span>
                    <p className="text-2xl font-bold font-mono text-emerald-400">
                      {summaryData.group.totalVolumeKg.toLocaleString()} <span className="text-xs text-zinc-400">kg</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-900/60 p-4 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[11px] uppercase font-semibold">
                      Total Team Sets
                    </span>
                    <p className="text-2xl font-bold font-mono text-zinc-100">
                      {summaryData.group.totalCompletedSets}
                    </p>
                  </div>
                </div>

                {/* Trainee breakdown table */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                    Partner Contributions
                  </span>
                  <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-900/40">
                    {summaryData.group.participants.map((p) => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between p-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-emerald-400" />
                          <span className="font-semibold text-zinc-200">{p.displayName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-zinc-400 font-mono">
                          <span>{p.completedSets} sets</span>
                          <span className="text-emerald-400 font-bold">
                            {p.volumeKg.toLocaleString()} kg
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={closeSummary}
                className="flex-1 border-zinc-800 text-xs"
              >
                Close Summary
              </Button>
              <Button
                onClick={() => router.push("/analytics")}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs"
              >
                View in History
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
