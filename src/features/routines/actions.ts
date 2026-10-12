"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createExerciseSchema,
  updateExerciseSchema,
  createRoutineSchema,
  type PlannedExerciseItem,
} from "@/features/routines/schemas";
import { revalidatePath } from "next/cache";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

/**
 * Fetch all available exercises:
 * - standard global catalog exercises (workspace_id is null)
 * - plus custom exercises created within the user's workspaces
 */
export async function getExercisesAction(workspaceId?: string) {
  const supabase = await createClient();
  let query = supabase.from("exercises").select("*").order("name", { ascending: true });

  if (workspaceId) {
    query = query.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);
  } else {
    query = query.is("workspace_id", null);
  }

  const { data, error } = await query;
  if (error) {
    return { error: error.message, data: [] };
  }
  return { data, error: undefined };
}

/**
 * Fetch the user's default/first workspace (or create a personal workspace if none exists)
 */
export async function getOrCreateDefaultWorkspaceAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to access workspaces", data: null };
  }

  // 1. Look for existing membership
  const { data: memberships, error: memError } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, description)")
    .eq("user_id", user.id)
    .limit(1);

  if (memError) {
    return { error: memError.message, data: null };
  }

  if (memberships && memberships.length > 0 && memberships[0].workspaces) {
    return { data: memberships[0].workspaces, error: undefined };
  }

  // 2. Otherwise create a default workspace for this user
  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "My";
  const { data: newWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({
      name: `${displayName}'s Training Group`,
      description: "Default workspace for logging and group workouts",
      created_by: user.id,
    })
    .select()
    .single();

  if (createError) {
    return { error: createError.message, data: null };
  }

  // Add user as owner
  await supabase.from("workspace_members").insert({
    workspace_id: newWorkspace.id,
    user_id: user.id,
    role: "owner",
  });

  return { data: newWorkspace, error: undefined };
}

/**
 * Create a custom exercise in a workspace
 */
export async function createCustomExerciseAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: formData.get("name"),
    category: formData.get("category"),
    primary_equipment: formData.get("primary_equipment") || undefined,
    notes: formData.get("notes") || undefined,
    workspace_id: formData.get("workspace_id"),
  };

  const validated = createExerciseSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid exercise data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: validated.data.name,
      category: validated.data.category,
      primary_equipment: validated.data.primary_equipment ?? null,
      notes: validated.data.notes ?? null,
      workspace_id: validated.data.workspace_id,
      is_custom: true,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/routines");
  revalidatePath("/exercises");
  return { success: true, data };
}

/**
 * Update an existing custom exercise
 */
export async function updateCustomExerciseAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    category: formData.get("category"),
    primary_equipment: formData.get("primary_equipment") || undefined,
    notes: formData.get("notes") || undefined,
  };

  const validated = updateExerciseSchema.safeParse(raw);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid exercise data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: validated.data.name,
      category: validated.data.category,
      primary_equipment: validated.data.primary_equipment ?? null,
      notes: validated.data.notes ?? null,
    })
    .eq("id", validated.data.id)
    .eq("is_custom", true)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/routines");
  revalidatePath("/exercises");
  return { success: true, data };
}

/**
 * Delete a custom exercise with safety checks
 */
export async function deleteCustomExerciseAction(exerciseId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // 1. Safety check: Check if any workout_sets reference this exercise
  const { count: setsCount, error: countError } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", exerciseId);

  if (countError) {
    return { error: countError.message };
  }

  if (setsCount && setsCount > 0) {
    return {
      error: `Cannot delete: this movement has been performed in ${setsCount} logged set(s). Keeping it preserves your historical workout records.`,
    };
  }

  // 2. Perform delete
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("is_custom", true);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/routines");
  revalidatePath("/exercises");
  return { success: true };
}

/**
 * Fetch all routines with their latest version for a given workspace
 */
export async function getRoutinesAction(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select(`
      id,
      name,
      description,
      created_at,
      routine_versions (
        id,
        version_number,
        structure_json,
        created_at
      )
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, data: [] };
  }

  return { data, error: undefined };
}

/**
 * Create a new routine and version 1 in a single transaction-like flow
 */
export async function createRoutineAction(input: {
  name: string;
  description?: string;
  workspace_id: string;
  exercises: PlannedExerciseItem[];
}): Promise<ActionResult> {
  const validated = createRoutineSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "Invalid routine data" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create routines" };
  }

  // 1. Create Routine
  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      name: validated.data.name,
      description: validated.data.description || null,
      workspace_id: validated.data.workspace_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (routineError) {
    return { error: routineError.message };
  }

  // 2. Create Initial Version (v1)
  const { error: versionError } = await supabase.from("routine_versions").insert({
    routine_id: routine.id,
    version_number: 1,
    structure_json: validated.data.exercises as unknown as import("@/types/database.types").Json,
  });

  if (versionError) {
    return { error: versionError.message };
  }

  revalidatePath("/routines");
  return { success: true, data: routine };
}
