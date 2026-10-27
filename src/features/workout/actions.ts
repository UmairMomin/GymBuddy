"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { idSchema, saveSetSchema, type SaveSetInput } from "@/features/workout/schemas";
import type { PlanExercise } from "@/features/plan/actions";
import { sendInvitePush } from "@/features/notifications/push";

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
  /** My accepted buddy, if any (drives the "Train with …" toggle). */
  buddy: { id: string; displayName: string } | null;
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
  /** Null when the editor's account was deleted. */
  last_edited_by: string | null;
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
  sets: SetRow[];
  last: LastTimeSet[];
};

export type RosterEntry = {
  userId: string;
  name: string;
  status: string;
  isMe: boolean;
  isHost: boolean;
  completedAt: string | null;
};

export type PendingInvite = { sessionId: string; name: string; hostName: string };

export type WorkoutData = {
  userId: string;
  /** Everyone in the session (me included), with names. */
  roster: RosterEntry[];
  /** Other participants' sets (members can read these under RLS). */
  partnerSets: SetRow[];
  /** My accepted buddy (for "Invite" when they are not in this session yet). */
  buddy: { id: string; displayName: string } | null;
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
  "id, exercise_id, user_id, last_edited_by, set_order, set_type, weight_kg, reps, completed, revision_number";

function rpcMessage(error: { message: string; code?: string }): string {
  return error.code === "P0001" ? error.message : "Something went wrong. Please try again.";
}

export async function getTodayAction(): Promise<ActionResult<TodayData>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [routinesRes, scheduleRes, exercisesRes, activeRes, recentRes, buddyRes] = await Promise.all([
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
      .is("completed_at", null)
      .eq("workout_sessions.status", "in_progress")
      .limit(1),
    supabase
      .from("session_participants")
      .select("completed_at, workout_sessions!inner(id, name, status, started_at, ended_at)")
      .eq("user_id", user.id)
      .in("status", ["joined", "left"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("buddy_links").select("requester_id, addressee_id").eq("status", "accepted").limit(1),
  ]);

  let buddy: TodayData["buddy"] = null;
  const link = buddyRes.data?.[0];
  if (link) {
    const buddyId = link.requester_id === user.id ? link.addressee_id : link.requester_id;
    const { data: bp } = await supabase.from("profiles").select("id, display_name").eq("id", buddyId).maybeSingle();
    if (bp) buddy = { id: bp.id, displayName: bp.display_name };
  }

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

  // Over, or over for me (I finished while my buddy is still training).
  const recentSessions = (recentRes.data ?? [])
    .map((r) => {
      const s = Array.isArray(r.workout_sessions) ? r.workout_sessions[0] : r.workout_sessions;
      return s && (r.completed_at || s.status !== "in_progress") ? s : null;
    })
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
      buddy,
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
export async function startWorkoutAction(
  routineId: string | null,
  withBuddy = false
): Promise<ActionResult<{ id: string }>> {
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
    p_with_buddy: withBuddy,
  });
  if (error) {
    // The one-live-session-per-host index fires when a workout is already running.
    if (error.code === "23505") return { error: "You already have a workout in progress" };
    return { error: rpcMessage(error) };
  }

  if (withBuddy) await notifyInvitedBuddy(supabase, user.id, sessionId, name);

  revalidatePath("/");
  return { data: { id: sessionId } };
}

/** "Last time": my completed sets from the most recent earlier session that included each exercise. */
async function loadLastTime(supabase: Supa, userId: string, sessionId: string, exerciseIds: string[]) {
  const lastByExercise = new Map<string, LastTimeSet[]>();
  if (exerciseIds.length === 0) return lastByExercise;
  const { data: history } = await supabase
    .from("workout_sets")
    .select("exercise_id, session_id, set_order, weight_kg, reps, updated_at")
    .eq("user_id", userId)
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
  return lastByExercise;
}

export async function getWorkoutAction(sessionId: string): Promise<ActionResult<WorkoutData>> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Workout not found" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [sessionRes, listRes, setsRes, profileRes, catalogRes, partnerSetsRes, rosterRes, buddyRes] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, name, status, started_at, ended_at, host_id")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase
      .from("session_exercises")
      .select("id, exercise_id, position, target_sets, rep_min, rep_max, exercises(name, category)")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase.from("workout_sets").select(SET_COLUMNS).eq("session_id", sessionId).eq("user_id", user.id).order("set_order"),
    supabase.from("profiles").select("preferred_unit").eq("id", user.id).maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, category, primary_equipment, notes, is_custom")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase.from("workout_sets").select(SET_COLUMNS).eq("session_id", sessionId).neq("user_id", user.id).order("set_order"),
    supabase.from("session_participants").select("user_id, status, completed_at").eq("session_id", sessionId),
    supabase.from("buddy_links").select("requester_id, addressee_id").eq("status", "accepted").limit(1),
  ]);

  const session = sessionRes.data;
  if (!session) return { error: "Workout not found" };
  if (listRes.error || setsRes.error) return { error: "Couldn't load this workout" };

  let buddy: WorkoutData["buddy"] = null;
  const link = buddyRes.data?.[0];
  if (link) {
    const buddyId = link.requester_id === user.id ? link.addressee_id : link.requester_id;
    const { data: bp } = await supabase.from("profiles").select("id, display_name").eq("id", buddyId).maybeSingle();
    if (bp) buddy = { id: bp.id, displayName: bp.display_name };
  }

  const roster = await buildRoster(supabase, user.id, session.host_id, rosterRes.data ?? []);

  const list = listRes.data ?? [];
  const exerciseIds = list.map((l) => l.exercise_id);

  const lastByExercise = await loadLastTime(supabase, user.id, sessionId, exerciseIds);

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
      sets: sets.filter((s) => s.exercise_id === l.exercise_id),
      last: lastByExercise.get(l.exercise_id) ?? [],
    };
  });

  return {
    data: {
      userId: user.id,
      roster,
      buddy,
      partnerSets: partnerSetsRes.data ?? [],
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
    .insert({ session_id: sessionId, user_id: user.id, exercise_id: exerciseId, position, target_sets: 3 })
    .select("id, position")
    .single();
  if (error || !data) return { error: "Couldn't add that exercise" };
  return { data };
}

/** My own session_exercises row, or null. Never a buddy's. */
async function getMyExerciseRow(supabase: Supa, userId: string, sessionExerciseId: string) {
  const { data } = await supabase
    .from("session_exercises")
    .select("id, session_id, exercise_id")
    .eq("id", sessionExerciseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Delete my sets for one exercise in a session. Sets first, so a failure never leaves sets without their exercise. */
async function deleteMySets(supabase: Supa, userId: string, sessionId: string, exerciseId: string) {
  return supabase.from("workout_sets").delete().eq("session_id", sessionId).eq("user_id", userId).eq("exercise_id", exerciseId);
}

export async function removeExerciseFromWorkoutAction(sessionExerciseId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionExerciseId).success) return { error: "Invalid exercise" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const row = await getMyExerciseRow(supabase, user.id, sessionExerciseId);
  if (!row) return { error: "That exercise no longer exists" };

  // shortcut: two statements, not one transaction; a failure between them leaves an empty exercise, never orphan sets. Upgrade to an RPC if that matters.
  const sets = await deleteMySets(supabase, user.id, row.session_id, row.exercise_id);
  if (sets.error) return { error: "Couldn't remove that exercise" };
  const { error } = await supabase.from("session_exercises").delete().eq("id", row.id).eq("user_id", user.id);
  if (error) return { error: "Couldn't remove that exercise" };
  return { success: true };
}

/** Replace one exercise with another in the same slot (position, target sets and rep range stay). */
export async function swapExerciseInWorkoutAction(
  sessionExerciseId: string,
  newExerciseId: string
): Promise<ActionResult<{ last: LastTimeSet[] }>> {
  if (!idSchema.safeParse(sessionExerciseId).success || !idSchema.safeParse(newExerciseId).success) {
    return { error: "Invalid exercise" };
  }
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const row = await getMyExerciseRow(supabase, user.id, sessionExerciseId);
  if (!row) return { error: "That exercise no longer exists" };
  if (row.exercise_id === newExerciseId) return { error: "Already doing that exercise" };

  const { data: dupe } = await supabase
    .from("session_exercises")
    .select("id")
    .eq("session_id", row.session_id)
    .eq("user_id", user.id)
    .eq("exercise_id", newExerciseId)
    .limit(1);
  if (dupe && dupe.length > 0) return { error: "That exercise is already in this workout" };

  const sets = await deleteMySets(supabase, user.id, row.session_id, row.exercise_id);
  if (sets.error) return { error: "Couldn't swap that exercise" };
  const { error } = await supabase
    .from("session_exercises")
    .update({ exercise_id: newExerciseId })
    .eq("id", row.id)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't swap that exercise" };

  const last = (await loadLastTime(supabase, user.id, row.session_id, [newExerciseId])).get(newExerciseId) ?? [];
  return { data: { last } };
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

type Supa = Awaited<ReturnType<typeof createClient>>;

async function buildRoster(
  supabase: Supa,
  myId: string,
  hostId: string,
  rows: Array<{ user_id: string; status: string; completed_at: string | null }>
): Promise<RosterEntry[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.display_name);
  }
  return rows.map((r) => ({
    userId: r.user_id,
    name: names.get(r.user_id) ?? "Buddy",
    status: r.status,
    isMe: r.user_id === myId,
    isHost: r.user_id === hostId,
    completedAt: r.completed_at,
  }));
}

export type SyncData = {
  status: string;
  endedAt: string | null;
  roster: RosterEntry[];
  mySets: SetRow[];
  partnerSets: SetRow[];
};

/** Authoritative snapshot used to recover after a reconnect (or a missed realtime event). */
export async function getSessionSyncAction(sessionId: string): Promise<ActionResult<SyncData>> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Workout not found" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [sessionRes, setsRes, rosterRes] = await Promise.all([
    supabase.from("workout_sessions").select("status, ended_at, host_id").eq("id", sessionId).maybeSingle(),
    supabase.from("workout_sets").select(SET_COLUMNS).eq("session_id", sessionId).order("set_order"),
    supabase.from("session_participants").select("user_id, status, completed_at").eq("session_id", sessionId),
  ]);
  if (!sessionRes.data || setsRes.error) return { error: "Couldn't refresh this workout" };

  const all = setsRes.data ?? [];
  return {
    data: {
      status: sessionRes.data.status,
      endedAt: sessionRes.data.ended_at,
      roster: await buildRoster(supabase, user.id, sessionRes.data.host_id, rosterRes.data ?? []),
      mySets: all.filter((s) => s.user_id === user.id),
      partnerSets: all.filter((s) => s.user_id !== user.id),
    },
  };
}

/** Invitations waiting for me (live sessions only), plus my id for the realtime filter. */
export async function getPendingInvitesAction(): Promise<ActionResult<{ userId: string; invites: PendingInvite[] }>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data, error } = await supabase
    .from("session_participants")
    .select("session_id, invited_by, workout_sessions!inner(id, name, status)")
    .eq("user_id", user.id)
    .eq("status", "invited")
    .eq("workout_sessions.status", "in_progress");
  if (error) return { error: "Couldn't check invitations" };

  const hostIds = [...new Set((data ?? []).map((d) => d.invited_by).filter((x): x is string => Boolean(x)))];
  const hostNames = new Map<string, string>();
  if (hostIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", hostIds);
    for (const p of profiles ?? []) hostNames.set(p.id, p.display_name);
  }

  const invites: PendingInvite[] = (data ?? []).map((d) => {
    const s = Array.isArray(d.workout_sessions) ? d.workout_sessions[0] : d.workout_sessions;
    return {
      sessionId: d.session_id,
      name: s?.name ?? "Workout",
      hostName: (d.invited_by && hostNames.get(d.invited_by)) || "Your buddy",
    };
  });
  return { data: { userId: user.id, invites } };
}

export type SessionAccess =
  | { state: "invited"; sessionId: string; name: string; hostName: string }
  | { state: "member" }
  | { state: "none" };

/** Which screen should /session/[id] show for me? An invitee must confirm before seeing anything. */
export async function getSessionAccessAction(sessionId: string): Promise<ActionResult<SessionAccess>> {
  if (!idSchema.safeParse(sessionId).success) return { data: { state: "none" } };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data: me } = await supabase
    .from("session_participants")
    .select("status, invited_by, workout_sessions!inner(name, status, host_id)")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me) return { data: { state: "none" } };

  if (me.status === "invited") {
    const s = Array.isArray(me.workout_sessions) ? me.workout_sessions[0] : me.workout_sessions;
    if (!s || s.status !== "in_progress") return { data: { state: "none" } };
    let hostName = "Your buddy";
    if (me.invited_by) {
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", me.invited_by).maybeSingle();
      if (p) hostName = p.display_name;
    }
    return { data: { state: "invited", sessionId, name: s.name, hostName } };
  }
  return { data: { state: me.status === "joined" || me.status === "left" ? "member" : "none" } };
}

export async function joinWorkoutAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("join_workout_session", { p_session_id: sessionId });
  if (error) return { error: rpcMessage(error) };
  revalidatePath("/");
  return { success: true };
}

export async function declineWorkoutAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("decline_workout_session", { p_session_id: sessionId });
  if (error) return { error: rpcMessage(error) };
  return { success: true };
}

/** A non-host marks their own part done; the session keeps running for the host. */
export async function finishMyWorkoutAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("finish_my_workout", { p_session_id: sessionId });
  if (error) return { error: rpcMessage(error) };
  revalidatePath("/");
  return { success: true };
}

/** Invite my buddy into a workout I already started. */
export async function inviteBuddyAction(sessionId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(sessionId).success) return { error: "Invalid workout" };
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("invite_buddy_to_session", { p_session_id: sessionId });
  if (error) return { error: rpcMessage(error) };

  const { data: session } = await supabase.from("workout_sessions").select("name").eq("id", sessionId).maybeSingle();
  await notifyInvitedBuddy(supabase, user.id, sessionId, session?.name ?? "a workout");
  return { success: true };
}

/** Push the invite to the buddy's devices (best effort; the in-app banner and share link still work). */
async function notifyInvitedBuddy(supabase: Supa, hostId: string, sessionId: string, sessionName: string) {
  const { data: me } = await supabase.from("profiles").select("display_name").eq("id", hostId).maybeSingle();
  await sendInvitePush(supabase, sessionId, me?.display_name ?? "Your buddy", sessionName);
}

export type ActiveWorkoutInfo = { id: string; name: string; startedAt: string };

/** My live workout, if any (host or joined participant). Cheap enough to call on every navigation. */
export async function getActiveWorkoutAction(): Promise<ActiveWorkoutInfo | null> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return null;

  const { data } = await supabase
    .from("session_participants")
    .select("workout_sessions!inner(id, name, status, started_at)")
    .eq("user_id", user.id)
    .eq("status", "joined")
    .is("completed_at", null)
    .eq("workout_sessions.status", "in_progress")
    .limit(1);
  const row = data?.[0]?.workout_sessions;
  const s = Array.isArray(row) ? row[0] : row;
  return s ? { id: s.id, name: s.name, startedAt: s.started_at } : null;
}
