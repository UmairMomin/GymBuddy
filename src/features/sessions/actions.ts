"use server";

import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { createClient } from "@/lib/supabase/server";
import {
  startSessionSchema,
  logSetSchema,
  updateSetSchema,
  type StartSessionInput,
  type LogSetInput,
  type UpdateSetInput,
} from "@/features/sessions/schemas";
import { revalidatePath } from "next/cache";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

/**
 * Start an active workout session (either freestyle or from a routine)
 */
export async function startWorkoutSessionAction(
  input: StartSessionInput
): Promise<ActionResult<{ sessionId: string }>> {
  const validated = startSessionSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid session input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to start a workout" };
  }

  // 1. Create Workout Session row
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      name: validated.data.name,
      workspace_id: validated.data.workspace_id,
      routine_id: validated.data.routine_id || null,
      routine_version_id: validated.data.routine_version_id || null,
      created_by: user.id,
      status: "in_progress",
    })
    .select()
    .single();

  if (sessionError) {
    return { error: sessionError.message };
  }

  // 2. Add creator as initial participant
  await supabase.from("session_participants").insert({
    session_id: session.id,
    user_id: user.id,
  });

  // 3. If routine provided, pre-populate planned sets for the user
  if (validated.data.routine_version_id) {
    const { data: version } = await supabase
      .from("routine_versions")
      .select("structure_json")
      .eq("id", validated.data.routine_version_id)
      .single();

    if (version && Array.isArray(version.structure_json)) {
      const planned = version.structure_json as Array<{
        exercise_id: string;
        target_sets: number;
        target_reps: string;
      }>;

      const setsToInsert = [];
      for (const item of planned) {
        const count = item.target_sets || 3;
        for (let s = 1; s <= count; s++) {
          setsToInsert.push({
            session_id: session.id,
            exercise_id: item.exercise_id,
            user_id: user.id,
            logged_by: user.id,
            set_order: s,
            set_type: "normal",
            weight_kg: 0,
            reps: 0,
            completed: false,
          });
        }
      }

      if (setsToInsert.length > 0) {
        await supabase.from("workout_sets").insert(setsToInsert);
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/session/${session.id}`);
  return { success: true, data: { sessionId: session.id } };
}

/**
 * Fetch active session and its related data
 */
export async function getActiveSessionAction(sessionId: string) {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      name,
      status,
      started_at,
      ended_at,
      workspace_id,
      routine_id,
      routines:routine_id (id, name, day_of_week),
      session_participants (
        user_id,
        completed_at,
        profiles (id, display_name, email)
      )
    `)
    .eq("id", sessionId)
    .single();

  if (sessionError) {
    return { error: sessionError.message, data: null };
  }

  // Fetch sets ordered
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select(`
      id,
      session_id,
      exercise_id,
      user_id,
      set_order,
      set_type,
      weight_kg,
      reps,
      rpe,
      completed,
      notes,
      revision_number,
      exercises (id, name, category, primary_equipment),
      profiles:user_id (id, display_name)
    `)
    .eq("session_id", sessionId)
    .order("set_order", { ascending: true });

  if (setsError) {
    return { error: setsError.message, data: null };
  }

  return {
    data: {
      session,
      sets: sets || [],
    },
    error: undefined,
  };
}

/**
 * Add a new set to an active workout session
 */
export async function addSetAction(input: LogSetInput): Promise<ActionResult> {
  const validated = logSetSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid set data" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to log sets" };
  }

  const { data, error } = await supabase
    .from("workout_sets")
    .insert({
      session_id: validated.data.session_id,
      exercise_id: validated.data.exercise_id,
      user_id: validated.data.user_id,
      set_order: validated.data.set_order,
      set_type: validated.data.set_type,
      weight_kg: validated.data.weight_kg,
      reps: validated.data.reps,
      rpe: validated.data.rpe ?? null,
      completed: validated.data.completed,
      notes: validated.data.notes ?? null,
      logged_by: user.id,
      revision_number: 1,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Record audit event in session_events
  await supabase.from("session_events").insert({
    session_id: validated.data.session_id,
    user_id: user.id,
    event_type: "SET_LOGGED",
    payload_json: {
      set_id: data.id,
      exercise_id: data.exercise_id,
      weight_kg: data.weight_kg,
      reps: data.reps,
    },
  });

  revalidatePath(`/session/${validated.data.session_id}`);
  return { success: true, data };
}

/**
 * Update an existing set with Optimistic Concurrency Control (OCC)
 */
export async function updateSetAction(input: UpdateSetInput): Promise<ActionResult> {
  const validated = updateSetSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid update data" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to update sets" };
  }

  // OCC: Check current revision_number matches
  const { data: existing, error: fetchError } = await supabase
    .from("workout_sets")
    .select("revision_number, session_id")
    .eq("id", validated.data.id)
    .single();

  if (fetchError || !existing) {
    return { error: "Set not found" };
  }

  if (existing.revision_number !== validated.data.revision_number) {
    return {
      error: "Conflict detected: This set was updated by another user. Please refresh.",
    };
  }

  const { data, error } = await supabase
    .from("workout_sets")
    .update({
      weight_kg: validated.data.weight_kg,
      reps: validated.data.reps,
      rpe: validated.data.rpe,
      set_type: validated.data.set_type,
      completed: validated.data.completed,
      notes: validated.data.notes,
      logged_by: user.id,
      revision_number: existing.revision_number + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.data.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // Record audit event in session_events
  await supabase.from("session_events").insert({
    session_id: existing.session_id,
    user_id: user.id,
    event_type: "SET_UPDATED",
    payload_json: {
      set_id: data.id,
      weight_kg: data.weight_kg,
      reps: data.reps,
      completed: data.completed,
    },
  });

  revalidatePath(`/session/${existing.session_id}`);
  return { success: true, data };
}

/**
 * Delete a set from an active session
 */
export async function deleteSetAction(setId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("workout_sets")
    .select("session_id")
    .eq("id", setId)
    .single();

  const { error } = await supabase.from("workout_sets").delete().eq("id", setId);

  if (error) {
    return { error: error.message };
  }

  if (existing) {
    if (user) {
      await supabase.from("session_events").insert({
        session_id: existing.session_id,
        user_id: user.id,
        event_type: "SET_DELETED",
        payload_json: { set_id: setId },
      });
    }
    revalidatePath(`/session/${existing.session_id}`);
  }
  return { success: true };
}

/**
 * Complete a workout session
 */
export async function finishWorkoutSessionAction(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) {
    return { error: SIGN_IN_REQUIRED };
  }
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/session/${sessionId}`);
  return { success: true };
}

/**
 * Join an active workout session as a co-trainee
 */
export async function joinWorkoutSessionAction(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to join workout" };
  }

  // Check if session exists and is active
  const { data: session, error: sessError } = await supabase
    .from("workout_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .single();

  if (sessError || !session) {
    return { error: "Workout session not found" };
  }

  // Check if already a participant
  const { data: existing } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    const { error: insertError } = await supabase.from("session_participants").insert({
      session_id: sessionId,
      user_id: user.id,
    });

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/session/${sessionId}`);
  return { success: true };
}

/**
 * Mark individual participant workout as finished (leaving session active for co-trainees)
 */
export async function finishParticipantWorkoutAction(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { error } = await supabase
    .from("session_participants")
    .update({
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  // When the last trainee finishes, the shared session itself ends.
  const { count: stillTraining } = await supabase
    .from("session_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .is("completed_at", null);

  if (stillTraining === 0) {
    await supabase
      .from("workout_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active");
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Get post-workout dual summary (personal performance & team combined summary)
 */
export async function getPostWorkoutSummaryAction(sessionId: string): Promise<
  ActionResult<{
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
  }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("name, started_at, ended_at")
    .eq("id", sessionId)
    .single();

  const { data: participants } = await supabase
    .from("session_participants")
    .select("user_id, completed_at, profiles (id, display_name)")
    .eq("session_id", sessionId);

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("user_id, weight_kg, reps, completed, exercises (name)")
    .eq("session_id", sessionId)
    .eq("completed", true);

  const completedSets = sets || [];

  // 1. Personal breakdown
  const mySets = completedSets.filter((s) => s.user_id === user.id);
  const myVolume = mySets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0);

  let topLift: { exerciseName: string; weightKg: number; reps: number } | null = null;
  for (const s of mySets) {
    if (!topLift || s.weight_kg > topLift.weightKg) {
      topLift = {
        exerciseName: s.exercises?.name || "Exercise",
        weightKg: s.weight_kg,
        reps: s.reps,
      };
    }
  }

  // 2. Group breakdown
  const groupVolume = completedSets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0);

  const participantSummaries = (participants || []).map((p) => {
    const userSets = completedSets.filter((s) => s.user_id === p.user_id);
    const userVol = userSets.reduce((acc, s) => acc + s.weight_kg * s.reps, 0);
    return {
      userId: p.user_id,
      displayName: p.profiles?.display_name || "Trainee",
      volumeKg: Math.round(userVol),
      completedSets: userSets.length,
      completedAt: p.completed_at,
    };
  });

  return {
    success: true,
    data: {
      sessionName: session?.name || "Workout Session",
      startedAt: session?.started_at || new Date().toISOString(),
      endedAt: session?.ended_at || null,
      personal: {
        volumeKg: Math.round(myVolume),
        completedSets: mySets.length,
        topLift,
      },
      group: {
        totalVolumeKg: Math.round(groupVolume),
        totalCompletedSets: completedSets.length,
        participants: participantSummaries,
      },
    },
  };
}

/**
 * Remove an entire exercise (and its sets) from the active session
 */
export async function deleteExerciseFromSessionAction(
  sessionId: string,
  exerciseId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  if (error) {
    return { error: error.message };
  }

  await supabase.from("session_events").insert({
    session_id: sessionId,
    user_id: user.id,
    event_type: "EXERCISE_REMOVED",
    payload_json: { exercise_id: exerciseId },
  });

  revalidatePath(`/session/${sessionId}`);
  return { success: true };
}

/**
 * Add an exercise with multiple planned sets into the active session
 */
export async function addExerciseToSessionAction(input: {
  sessionId: string;
  exerciseId: string;
  targetSets: number;
  targetReps?: string;
  defaultWeight?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const count = Math.max(1, Math.min(input.targetSets || 3, 15));
  const defaultWeight = input.defaultWeight || 0;
  const defaultReps = parseInt(input.targetReps || "10") || 10;

  // Find max set_order for this exercise or user
  const { data: existingSets } = await supabase
    .from("workout_sets")
    .select("set_order")
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId)
    .order("set_order", { ascending: false });

  const startOrder = (existingSets?.[0]?.set_order || 0) + 1;

  const setsToInsert = [];
  for (let i = 0; i < count; i++) {
    setsToInsert.push({
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      user_id: user.id,
      logged_by: user.id,
      set_order: startOrder + i,
      set_type: "normal",
      weight_kg: defaultWeight,
      reps: defaultReps,
      completed: false,
    });
  }

  const { data, error } = await supabase
    .from("workout_sets")
    .insert(setsToInsert)
    .select(`
      id,
      session_id,
      exercise_id,
      user_id,
      set_order,
      set_type,
      weight_kg,
      reps,
      rpe,
      completed,
      notes,
      revision_number,
      exercises (id, name, category, primary_equipment),
      profiles:user_id (id, display_name)
    `);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/session/${input.sessionId}`);
  return { success: true, data };
}

/**
 * Save current session movements back to the linked routine (or create/update routine split)
 */
export async function saveSessionExercisesToRoutineAction(
  sessionId: string,
  routineId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  // 1. Fetch current routine
  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .select("id, name, description, day_of_week, workspace_id")
    .eq("id", routineId)
    .single();

  if (routineError || !routine) {
    return { error: "Routine not found" };
  }

  // 2. Fetch session sets with exercise info
  const { data: sets, error: setsError } = await supabase
    .from("workout_sets")
    .select(`
      exercise_id,
      set_order,
      reps,
      exercises (id, name, category)
    `)
    .eq("session_id", sessionId)
    .order("set_order", { ascending: true });

  if (setsError || !sets || sets.length === 0) {
    return { error: "No exercises found in this session" };
  }

  // Group unique exercises in order of appearance
  const exerciseMap = new Map<
    string,
    { exercise_id: string; exercise_name: string; count: number; repSamples: number[] }
  >();

  for (const s of sets) {
    const exId = s.exercise_id;
    const exName = (s.exercises as unknown as { name?: string })?.name || "Exercise";
    if (!exerciseMap.has(exId)) {
      exerciseMap.set(exId, {
        exercise_id: exId,
        exercise_name: exName,
        count: 0,
        repSamples: [],
      });
    }
    const item = exerciseMap.get(exId)!;
    item.count += 1;
    if (s.reps > 0) item.repSamples.push(s.reps);
  }

  const plannedExercises = Array.from(exerciseMap.values()).map((item) => {
    // Average reps or fallback
    const avgReps =
      item.repSamples.length > 0
        ? Math.round(item.repSamples.reduce((a, b) => a + b, 0) / item.repSamples.length)
        : 10;
    return {
      exercise_id: item.exercise_id,
      exercise_name: item.exercise_name,
      target_sets: Math.max(1, item.count),
      target_reps: `${avgReps}`,
      rest_seconds: 90,
    };
  });

  // 3. Find latest version number
  const { data: latestVersion } = await supabase
    .from("routine_versions")
    .select("version_number")
    .eq("routine_id", routineId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

  // 4. Insert new routine version
  const { error: versionError } = await supabase.from("routine_versions").insert({
    routine_id: routineId,
    version_number: nextVersionNumber,
    structure_json: plannedExercises,
  });

  if (versionError) {
    return { error: versionError.message };
  }

  // Update routine timestamp
  await supabase
    .from("routines")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", routineId);

  revalidatePath("/routines");
  revalidatePath(`/session/${sessionId}`);
  return { success: true };
}


