"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = unknown> = {
  data?: T;
  error?: string;
  success?: boolean;
};

const bodyMetricSchema = z.object({
  recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  weightKg: z.number().gt(0, "Enter your body weight").max(500, "Please enter a realistic body weight"),
  bodyFatPercentage: z.number().min(0).max(100, "Body fat must be between 0 and 100").optional(),
  notes: z.string().max(500).optional(),
});

export type BodyMetricEntry = {
  id: string;
  recorded_date: string;
  weight_kg: number;
  body_fat_percentage: number | null;
  notes: string | null;
  created_at: string;
};

/**
 * Fetch all body metric logs for the authenticated user
 */
export async function getBodyMetricsAction(): Promise<ActionResult<BodyMetricEntry[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in to view body metrics", data: [] };
  }

  const { data, error } = await supabase
    .from("body_metrics")
    .select("id, recorded_date, weight_kg, body_fat_percentage, notes, created_at")
    .eq("user_id", user.id)
    .order("recorded_date", { ascending: true });

  if (error) {
    return { error: error.message, data: [] };
  }

  const metrics: BodyMetricEntry[] = (data || []).map((row) => ({
    id: row.id,
    recorded_date: row.recorded_date,
    weight_kg: Number(row.weight_kg),
    body_fat_percentage: row.body_fat_percentage ? Number(row.body_fat_percentage) : null,
    notes: row.notes,
    created_at: row.created_at,
  }));

  return { data: metrics, success: true };
}

/**
 * Log a new body metric measurement
 */
export async function logBodyMetricAction(input: {
  recordedDate: string;
  weightKg: number;
  bodyFatPercentage?: number;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const parsed = bodyMetricSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid measurement" };

  const { data, error } = await supabase
    .from("body_metrics")
    .insert({
      user_id: user.id,
      recorded_date: parsed.data.recordedDate,
      weight_kg: parsed.data.weightKg,
      body_fat_percentage: parsed.data.bodyFatPercentage ?? null,
      notes: parsed.data.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  return { success: true, data: { id: data.id } };
}

/**
 * Delete a body metric record
 */
export async function deleteBodyMetricAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Must be signed in" };
  }

  const { error } = await supabase
    .from("body_metrics")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/history");
  return { success: true };
}
