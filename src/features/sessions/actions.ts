"use server";

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
      session_participants (
        user_id,
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

  revalidatePath(`/session/${existing.session_id}`);
  return { success: true, data };
}

/**
 * Delete a set from an active session
 */
export async function deleteSetAction(setId: string): Promise<ActionResult> {
  const supabase = await createClient();
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
    revalidatePath(`/session/${existing.session_id}`);
  }
  return { success: true };
}

/**
 * Complete a workout session
 */
export async function finishWorkoutSessionAction(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
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
