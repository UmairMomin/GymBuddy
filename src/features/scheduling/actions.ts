"use server";

import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { startWorkoutSessionAction } from "@/features/sessions/actions";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

export type ScheduledWorkoutItem = {
  id: string;
  workspace_id: string;
  routine_id: string | null;
  routine_version_id: string | null;
  scheduled_for: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "missed";
  notes: string | null;
  created_by: string;
  creator_name: string;
  routine_name: string;
};

/**
 * Fetch upcoming scheduled workouts for a workspace
 */
export async function getUpcomingScheduledWorkoutsAction(
  workspaceId: string
): Promise<ActionResult<ScheduledWorkoutItem[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_workouts")
    .select(`
      id,
      workspace_id,
      routine_id,
      routine_version_id,
      scheduled_for,
      status,
      notes,
      created_by,
      routines (id, name),
      profiles (id, display_name)
    `)
    .eq("workspace_id", workspaceId)
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_for", { ascending: true });

  if (error) {
    return { error: error.message, data: [] };
  }

  const items: ScheduledWorkoutItem[] = (data || []).map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    routine_id: row.routine_id,
    routine_version_id: row.routine_version_id,
    scheduled_for: row.scheduled_for,
    status: row.status as ScheduledWorkoutItem["status"],
    notes: row.notes,
    created_by: row.created_by,
    creator_name: row.profiles?.display_name || "Trainee",
    routine_name: row.routines?.name || "Freestyle Workout",
  }));

  return { data: items, success: true };
}

/**
 * Schedule a new workout session for a future date/time
 */
export async function scheduleWorkoutAction(input: {
  workspaceId: string;
  routineId?: string;
  scheduledFor: string;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to schedule a workout" };
  }

  let routineVersionId: string | null = null;
  if (input.routineId) {
    const { data: rVersion } = await supabase
      .from("routine_versions")
      .select("id")
      .eq("routine_id", input.routineId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (rVersion) {
      routineVersionId = rVersion.id;
    }
  }

  const { data, error } = await supabase
    .from("scheduled_workouts")
    .insert({
      workspace_id: input.workspaceId,
      routine_id: input.routineId || null,
      routine_version_id: routineVersionId,
      scheduled_for: input.scheduledFor,
      notes: input.notes || null,
      created_by: user.id,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true, data: { id: data.id } };
}

/**
 * Launch an active workout session from a scheduled item
 */
export async function startScheduledWorkoutAction(
  scheduledWorkoutId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) {
    return { error: SIGN_IN_REQUIRED };
  }

  const { data: scheduled, error: fetchError } = await supabase
    .from("scheduled_workouts")
    .select("*, routines (name)")
    .eq("id", scheduledWorkoutId)
    .single();

  if (fetchError || !scheduled) {
    return { error: "Scheduled workout not found" };
  }

  const sessionName = scheduled.routines?.name || "Scheduled Workout";

  // Start the live session
  const startRes = await startWorkoutSessionAction({
    name: sessionName,
    workspace_id: scheduled.workspace_id,
    routine_id: scheduled.routine_id || undefined,
    routine_version_id: scheduled.routine_version_id || undefined,
  });

  if (startRes.error || !startRes.data) {
    return { error: startRes.error || "Failed to start workout session" };
  }

  // Update status to in_progress
  await supabase
    .from("scheduled_workouts")
    .update({ status: "in_progress" })
    .eq("id", scheduledWorkoutId);

  revalidatePath("/");
  return { success: true, data: { sessionId: startRes.data.sessionId } };
}

/**
 * Cancel a scheduled workout
 */
export async function cancelScheduledWorkoutAction(
  scheduledWorkoutId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) {
    return { error: SIGN_IN_REQUIRED };
  }

  const { error } = await supabase
    .from("scheduled_workouts")
    .update({ status: "cancelled" })
    .eq("id", scheduledWorkoutId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}
