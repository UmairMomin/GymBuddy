"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { idSchema, saveSetSchema, type SaveSetInput } from "@/features/workout/schemas";
import type { PlanExercise } from "@/features/plan/actions";

export type ActionResult<T = unknown> = { data?: T; error?: string; success?: boolean };

export type RoutineSummary = {
  id: string;
  name: string;
  exerciseCount: number;
  /** First few exercise names + set counts for the Today preview. */
  preview: Array<{ name: string; sets: number }>;
};

export type RecentSession = {
  id: string;
  name: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  withName: string | null;
};

export type TodayData = {
  routines: RoutineSummary[];
  /** Index = weekday (0 = Mon); routine id or null for rest. */
  schedule: Array<string | null>;
  activeSession: { id: string; name: string; startedAt: string } | null;
  recent: RecentSession[];
};

export type SetRow = {
  id: string;
  exercise_id: string;
  user_id: string;
  set_order: number;
  set_type: string;
  weight_kg: number;
  reps: number;
  completed: boolean;
  revision_number: number;
};

export type LastTimeSet = { set_order: number; weight_kg: number; reps: number };

export type SessionExerciseView = {
  id: string;
  exercise_id: string;
  name: string;
  category: string;
  position: number;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
  rest_seconds: number | null;
  skipped: boolean;
  sets: SetRow[];
  last: LastTimeSet[];
};

export type WorkoutData = {
  userId: string;
  unit: "kg" | "lb";
  session: {
    id: string;
    name: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    isHost: boolean;
  };
  exercises: SessionExerciseView[];
  catalog: PlanExercise[];
};

const SET_COLUMNS =
  "id, exercise_id, user_id, set_order, set_type, weight_kg, reps, completed, revision_number";

function rpcMessage(error: { message: string; code?: string }): string {
  return error.code === "P0001" ? error.message : "Something went wrong. Please try again.";
}

export async function getTodayAction(): Promise<ActionResult<TodayData>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [routinesRes, scheduleRes, exercisesRes, activeRes, recentRes] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, routine_versions(version_number, structure_json)")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("weekly_schedule").select("weekday, routine_id"),
    supabase.from("exercises").select("id, name"),
    supabase
      .from("session_participants")
      .select("workout_sessions!inner(id, name, status, started_at)")
      .eq("user_id", user.id)
      .eq("status", "joined")
      .eq("workout_sessions.status", "in_progress")
      .limit(1),
    supabase
      .from("session_participants")
      .select("workout_sessions!inner(id, name, status, started_at, ended_at)")
      .eq("user_id", user.id)
      .in("status", ["joined", "left"])
      .neq("workout_sessions.status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (routinesRes.error || scheduleRes.error || exercisesRes.error) {
    return { error: "Couldn't load your week" };
  }

  const nameById = new Map((exercisesRes.data ?? []).map((e) => [e.id, e.name]));
  const routines: RoutineSummary[] = (routinesRes.data ?? []).map((r) => {
    const latest = [...(r.routine_versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
    const items = Array.isArray(latest?.structure_json)
      ? (latest.structure_json as Array<{ exercise_id?: string; target_sets?: number; position?: number }>)
      : [];
    const sorted = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return {
      id: r.id,
      name: r.name,
      exerciseCount: sorted.length,
      preview: sorted.slice(0, 3).map((i) => ({
        name: nameById.get(i.exercise_id ?? "") ?? "Exercise",
        sets: i.target_sets ?? 3,
      })),
    };
  });

  const schedule: Array<string | null> = Array(7).fill(null);
  for (const row of scheduleRes.data ?? []) schedule[row.weekday] = row.routine_id;

  const activeRow = activeRes.data?.[0]?.workout_sessions;
  const active = Array.isArray(activeRow) ? activeRow[0] : activeRow;

  const recentSessions = (recentRes.data ?? [])
    .map((r) => (Array.isArray(r.workout_sessions) ? r.workout_sessions[0] : r.workout_sessions))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  // Who else trained in those sessions? (RLS only reveals buddies I share a session with.)
  const withNames = new Map<string, string>();
  if (recentSessions.length > 0) {
    const { data: others } = await supabase
      .from("session_participants")
      .select("session_id, user_id")
      .in("session_id", recentSessions.map((s) => s.id))
      .neq("user_id", user.id)
      .in("status", ["joined", "left"]);
    const otherIds = [...new Set((others ?? []).map((o) => o.user_id))];
    const people = new Map<string, string>();
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", otherIds);
      for (const p of profiles ?? []) people.set(p.id, p.display_name);
    }
    for (const o of others ?? []) withNames.set(o.session_id, people.get(o.user_id) ?? "Buddy");
  }

  return {
    data: {
      routines,
      schedule,
      activeSession: active ? { id: active.id, name: active.name, startedAt: active.started_at } : null,
      recent: recentSessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        withName: withNames.get(s.id) ?? null,
      })),
    },
  };
}

/** Starts a session from a routine (or freestyle when null) and returns its id. */
export async function startWorkoutAction(routineId: string | null): Promise<ActionResult<{ id: string }>> {
  if (routineId !== null && !idSchema.safeParse(routineId).success) return { error: "Invalid routine" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  let name = "Freestyle workout";
  if (routineId) {
    const { data: routine } = await supabase.from("routines").select("name").eq("id", routineId).maybeSingle();
    if (!routine) return { error: "Routine not found" };
    name = routine.name;
  }

  const sessionId = crypto.randomUUID();
  const { error } = await supabase.rpc("start_workout_session", {
    p_session_id: sessionId,
    p_name: name,
    // The SQL function accepts NULL for a freestyle workout; generated types can't express nullable args.
    p_routine_id: routineId as string,
    p_with_buddy: false,
  });
  if (error) {
    // The one-live-session-per-host index fires when a workout is already running.
    if (error.code === "23505") return { error: "You already have a workout in progress" };
    return { error: rpcMessage(error) };
  }

  revalidatePath("/");
  return { data: { id: sessionId } };
}

export async function startWorkoutAndOpenAction(routineId: string | null): Promise<ActionResult> {
  const res = await startWorkoutAction(routineId);
  if (res.error || !res.data) return { error: res.error ?? "Couldn't start the workout" };
  redirect(`/session/${res.data.id}`);
}

export async function getWorkoutAction(sessionId: string): Promise<ActionResult<WorkoutData>> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Workout not found" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [sessionRes, listRes, setsRes, profileRes, catalogRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, name, status, started_at, ended_at, host_id")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase
      .from("session_exercises")
      .select("id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds, skipped, exercises(name, category)")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase.from("workout_sets").select(SET_COLUMNS).eq("session_id", sessionId).eq("user_id", user.id).order("set_order"),
    supabase.from("profiles").select("preferred_unit").eq("id", user.id).maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, category, primary_equipment, notes, is_custom")
      .order("name", { ascending: true }),
  ]);

  const session = sessionRes.data;
  if (!session) return { error: "Workout not found" };
  if (listRes.error || setsRes.error) return { error: "Couldn't load this workout" };

  const list = listRes.data ?? [];
  const exerciseIds = list.map((l) => l.exercise_id);

  // "Last time": my completed sets from the most recent earlier session that included each exercise.
  const lastByExercise = new Map<string, LastTimeSet[]>();
  if (exerciseIds.length > 0) {
    const { data: history } = await supabase
      .from("workout_sets")
      .select("exercise_id, session_id, set_order, weight_kg, reps, updated_at")
      .eq("user_id", user.id)
      .eq("completed", true)
      .neq("session_id", sessionId)
      .in("exercise_id", exerciseIds)
      .order("updated_at", { ascending: false })
      .limit(400);
    const latestSession = new Map<string, string>();
    for (const h of history ?? []) {
      if (!latestSession.has(h.exercise_id)) latestSession.set(h.exercise_id, h.session_id);
      if (latestSession.get(h.exercise_id) !== h.session_id) continue;
      const arr = lastByExercise.get(h.exercise_id) ?? [];
      arr.push({ set_order: h.set_order, weight_kg: h.weight_kg, reps: h.reps });
      lastByExercise.set(h.exercise_id, arr);
    }
    for (const arr of lastByExercise.values()) arr.sort((a, b) => a.set_order - b.set_order);
  }

  const sets = setsRes.data ?? [];
  const exercises: SessionExerciseView[] = list.map((l) => {
    const ex = Array.isArray(l.exercises) ? l.exercises[0] : l.exercises;
    return {
      id: l.id,
      exercise_id: l.exercise_id,
      name: ex?.name ?? "Exercise",
      category: ex?.category ?? "other",
      position: l.position,
      target_sets: l.target_sets,
      rep_min: l.rep_min,
      rep_max: l.rep_max,
      rest_seconds: l.rest_seconds,
      skipped: l.skipped,
      sets: sets.filter((s) => s.exercise_id === l.exercise_id),
      last: lastByExercise.get(l.exercise_id) ?? [],
    };
  });

  return {
    data: {
      userId: user.id,
      unit: profileRes.data?.preferred_unit === "lb" ? "lb" : "kg",
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        isHost: session.host_id === user.id,
      },
      exercises,
      catalog: catalogRes.data ?? [],
    },
  };
}

export type SaveSetResult = ActionResult<SetRow> & {
  /** True when someone else changed this set first; `data` is then the current server row. */
  conflict?: boolean;
};

/**
 * Idempotent set write with optimistic concurrency:
 *  - expected_revision null → insert (a retry of an already-saved set returns the stored row)
 *  - otherwise compare-and-swap on revision_number; a stale write returns `conflict` + current row
 */
export async function saveSetAction(input: SaveSetInput): Promise<SaveSetResult> {
  const parsed = saveSetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid set" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { expected_revision, ...fields } = parsed.data;

  if (expected_revision === null) {
    // last_edited_by is overwritten by a DB trigger with the authenticated user; the column is NOT NULL.
    const { data, error } = await supabase
      .from("workout_sets")
      .insert({ ...fields, last_edited_by: user.id })
      .select(SET_COLUMNS)
      .single();
    if (!error) return { data, success: true };
    if (error.code === "23505") {
      const { data: existing } = await supabase.from("workout_sets").select(SET_COLUMNS).eq("id", fields.id).maybeSingle();
      if (existing) return { data: existing, success: true };
    }
    return { error: "Couldn't save that set" };
  }

  const { id, session_id: _s, exercise_id: _e, user_id: _u, ...changes } = fields;
  void _s; void _e; void _u;
  const { data, error } = await supabase
    .from("workout_sets")
    .update(changes)
    .eq("id", id)
    .eq("revision_number", expected_revision)
    .select(SET_COLUMNS);
  if (error) return { error: "Couldn't save that set" };
  if (data && data.length === 1) return { data: data[0], success: true };

  const { data: current } = await supabase.from("workout_sets").select(SET_COLUMNS).eq("id", id).maybeSingle();
  if (!current) return { error: "That set no longer exists" };
  return { conflict: true, data: current, error: "This set changed elsewhere. Showing the latest values." };
}

export async function deleteSetAction(setId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(setId).success) return { error: "Invalid set" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.from("workout_sets").delete().eq("id", setId);
  if (error) return { error: "Couldn't remove that set" };
  return { success: true };
}

export async function addExerciseToWorkoutAction(
  sessionId: string,
  exerciseId: string
): Promise<ActionResult<{ id: string; position: number }>> {
  if (!idSchema.safeParse(sessionId).success || !idSchema.safeParse(exerciseId).success) {
    return { error: "Invalid exercise" };
  }
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data: last } = await supabase
    .from("session_exercises")
    .select("position")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("session_exercises")
    .insert({ session_id: sessionId, user_id: user.id, exercise_id: exerciseId, position, target_sets: 3, rest_seconds: 90 })
    .select("id, position")
    .single();
  if (error || !data) return { error: "Couldn't add that exercise" };
  return { data };
}

export async function setExerciseSkippedAction(sessionExerciseId: string, skipped: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionExerciseId).success) return { error: "Invalid exercise" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase
    .from("session_exercises")
    .update({ skipped })
    .eq("id", sessionExerciseId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't update that exercise" };
  return { success: true };
}

export async function finishWorkoutAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("finish_workout_session", { p_session_id: sessionId });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/");
  return { success: true };
}

/** Throw the workout away: marks it cancelled (host only), so it never shows in history. */
export async function discardWorkoutAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("host_id", user.id)
    .eq("status", "in_progress")
    .select("id");
  if (error || !data || data.length === 0) return { error: "Couldn't discard this workout" };

  revalidatePath("/");
  return { success: true };
}
