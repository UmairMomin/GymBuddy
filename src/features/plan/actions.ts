"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import {
  exerciseInputSchema,
  saveRoutineSchema,
  type ExerciseInput,
  type SaveRoutineInput,
} from "@/features/plan/schemas";
import type { Database } from "@/types/database.types";

export type ActionResult<T = unknown> = { data?: T; error?: string; success?: boolean };

export type PlanExercise = Pick<
  Database["public"]["Tables"]["exercises"]["Row"],
  "id" | "name" | "category" | "primary_equipment" | "notes" | "is_custom"
>;

export type PlanRoutineItem = {
  exercise_id: string;
  position: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
};

export type PlanRoutine = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  items: PlanRoutineItem[];
  /** 0 = Monday … 6 = Sunday */
  weekdays: number[];
};

export type PlanData = {
  routines: PlanRoutine[];
  /** Index = weekday (0 = Mon). null = rest day / nothing scheduled. */
  schedule: Array<string | null>;
  exercises: PlanExercise[];
};

function rpcMessage(error: { message: string; code?: string }): string {
  return error.code === "P0001" ? error.message : "Something went wrong. Please try again.";
}

function toItems(json: unknown): PlanRoutineItem[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((raw, i): PlanRoutineItem | null => {
      const r = raw as Partial<PlanRoutineItem> | null;
      if (!r || typeof r.exercise_id !== "string") return null;
      return {
        exercise_id: r.exercise_id,
        position: typeof r.position === "number" ? r.position : i,
        target_sets: r.target_sets ?? 3,
        rep_min: r.rep_min ?? 8,
        rep_max: r.rep_max ?? 12,
      };
    })
    .filter((x): x is PlanRoutineItem => x !== null)
    .sort((a, b) => a.position - b.position);
}

export async function getPlanDataAction(): Promise<ActionResult<PlanData>> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [routinesRes, scheduleRes, exercisesRes] = await Promise.all([
    supabase
      .from("routines")
      .select("id, name, description, created_at, routine_versions(version_number, structure_json)")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("weekly_schedule").select("weekday, routine_id"),
    supabase
      .from("exercises")
      .select("id, name, category, primary_equipment, notes, is_custom")
      .order("name", { ascending: true }),
  ]);

  if (routinesRes.error || scheduleRes.error || exercisesRes.error) {
    return { error: "Couldn't load your plan" };
  }

  const schedule: Array<string | null> = Array(7).fill(null);
  for (const row of scheduleRes.data ?? []) schedule[row.weekday] = row.routine_id;

  const routines: PlanRoutine[] = (routinesRes.data ?? []).map((r) => {
    const latest = [...(r.routine_versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      version: latest?.version_number ?? 1,
      items: toItems(latest?.structure_json),
      weekdays: schedule.flatMap((rid, day) => (rid === r.id ? [day] : [])),
    };
  });

  return { data: { routines, schedule, exercises: exercisesRes.data ?? [] } };
}

export async function saveRoutineAction(input: SaveRoutineInput): Promise<ActionResult<{ id: string }>> {
  const parsed = saveRoutineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid routine" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const v = parsed.data;
  const structure = v.items.map((item, position) => ({ ...item, position }));
  const { error } = await supabase.rpc("save_routine", {
    p_routine_id: v.id,
    p_name: v.name,
    p_description: v.description ?? "",
    p_structure: structure,
    p_weekdays: [...new Set(v.weekdays)],
  });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/plan");
  return { data: { id: v.id }, success: true };
}

export async function archiveRoutineAction(routineId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(routineId);
  if (!parsed.success) return { error: "Invalid routine" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("archive_routine", { p_routine_id: parsed.data });
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/plan");
  return { success: true };
}

/** Put a routine on a weekday, or pass null to make it a rest day. */
export async function setWeekdayRoutineAction(weekday: number, routineId: string | null): Promise<ActionResult> {
  const parsed = z
    .object({ weekday: z.number().int().min(0).max(6), routineId: z.string().uuid().nullable() })
    .safeParse({ weekday, routineId });
  if (!parsed.success) return { error: "Invalid schedule change" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.from("weekly_schedule").upsert(
    { user_id: user.id, weekday: parsed.data.weekday, routine_id: parsed.data.routineId },
    { onConflict: "user_id,weekday" }
  );
  if (error) return { error: "Couldn't update the schedule" };

  revalidatePath("/plan");
  return { success: true };
}

export async function seedStarterPlanAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { error } = await supabase.rpc("seed_starter_plan");
  if (error) return { error: rpcMessage(error) };

  revalidatePath("/plan");
  return { success: true };
}

export async function createExerciseAction(input: ExerciseInput): Promise<ActionResult<PlanExercise>> {
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid exercise" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id, name, category, primary_equipment, notes, is_custom")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "You already have an exercise with that name" : "Couldn't create the exercise" };
  }

  revalidatePath("/plan");
  return { data, success: true };
}

export async function updateExerciseAction(id: string, input: ExerciseInput): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(id);
  const parsed = exerciseInputSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { error: parsed.error?.issues[0]?.message ?? "Invalid exercise" };
  }

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data, error } = await supabase
    .from("exercises")
    .update(parsed.data)
    .eq("id", parsedId.data)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    return { error: error.code === "23505" ? "You already have an exercise with that name" : "Couldn't save the exercise" };
  }
  if (!data || data.length === 0) return { error: "Only your own exercises can be edited" };

  revalidatePath("/plan");
  return { success: true };
}

export async function deleteExerciseAction(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid exercise" };

  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const { data, error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", parsed.data)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This exercise is part of your workout history, so it can't be deleted"
          : "Couldn't delete the exercise",
    };
  }
  if (!data || data.length === 0) return { error: "Only your own exercises can be deleted" };

  revalidatePath("/plan");
  return { success: true };
}
