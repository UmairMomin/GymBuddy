"use server";

import { createClient } from "@/lib/supabase/server";

export type SessionSummary = {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number;
  completed_sets_count: number;
  exercises_count: number;
  exercises_summary: Array<{
    name: string;
    sets_count: number;
    top_weight_kg: number;
    top_reps: number;
    estimated_1rm: number;
  }>;
};

export async function getCompletedSessionsAction(workspaceId: string) {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      name,
      status,
      started_at,
      ended_at,
      workout_sets (
        id,
        exercise_id,
        weight_kg,
        reps,
        completed,
        set_type,
        exercises (id, name, category)
      )
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  if (error) {
    return { error: error.message, data: [] };
  }

  const summaries: SessionSummary[] = (sessions || []).map((s) => {
    const completedSets = s.workout_sets?.filter((set) => set.completed) || [];

    // Group sets by exercise
    const exMap = new Map<
      string,
      {
        name: string;
        sets_count: number;
        top_weight_kg: number;
        top_reps: number;
        estimated_1rm: number;
      }
    >();

    let totalVolume = 0;

    for (const set of completedSets) {
      const weight = Number(set.weight_kg);
      const reps = Number(set.reps);
      totalVolume += weight * reps;

      const exName = set.exercises?.name || "Exercise";
      const exId = set.exercise_id;

      // 1RM estimate via Brzycki formula
      const est1RM = reps === 1 ? weight : reps < 37 ? Math.round(weight * (36 / (37 - reps)) * 10) / 10 : weight;

      if (!exMap.has(exId)) {
        exMap.set(exId, {
          name: exName,
          sets_count: 1,
          top_weight_kg: weight,
          top_reps: reps,
          estimated_1rm: est1RM,
        });
      } else {
        const item = exMap.get(exId)!;
        item.sets_count += 1;
        if (weight > item.top_weight_kg) {
          item.top_weight_kg = weight;
          item.top_reps = reps;
        }
        if (est1RM > item.estimated_1rm) {
          item.estimated_1rm = est1RM;
        }
      }
    }

    return {
      id: s.id,
      name: s.name,
      started_at: s.started_at,
      ended_at: s.ended_at,
      total_volume_kg: totalVolume,
      completed_sets_count: completedSets.length,
      exercises_count: exMap.size,
      exercises_summary: Array.from(exMap.values()),
    };
  });

  return { data: summaries, error: undefined };
}
