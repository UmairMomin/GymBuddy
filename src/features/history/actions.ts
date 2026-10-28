"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser, SIGN_IN_REQUIRED } from "@/lib/supabase/require-user";
import { summarize, type PersonalRecord, type SessionSummary, type SetFact } from "@/features/history/aggregate";
import type { BodyMetricEntry } from "@/features/history/body-metrics-actions";

export type { PersonalRecord, SessionSummary } from "@/features/history/aggregate";

export type HistoryData = {
  unit: "kg" | "lb";
  sessions: SessionSummary[];
  records: PersonalRecord[];
  bodyMetrics: BodyMetricEntry[];
};

const PAGE = 1000;
const MAX_PAGES = 20; // 20k sets: far beyond a real training log; bounds the work per request

type Supa = Awaited<ReturnType<typeof createClient>>;

/** All of my completed sets in completed sessions, newest first, paged past PostgREST's row cap. */
export async function fetchMySetFacts(supabase: Supa, userId: string): Promise<SetFact[] | null> {
  const facts: SetFact[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("workout_sets")
      .select(
        "weight_kg, reps, exercise_id, exercises!inner(name, category), workout_sessions!inner(id, name, routine_id, started_at, ended_at, status)"
      )
      .eq("user_id", userId)
      .eq("completed", true)
      .eq("workout_sessions.status", "completed")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return null;
    for (const r of data ?? []) {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises;
      const s = Array.isArray(r.workout_sessions) ? r.workout_sessions[0] : r.workout_sessions;
      if (!ex || !s) continue;
      facts.push({
        session_id: s.id,
        session_name: s.name,
        is_freestyle: s.routine_id === null,
        started_at: s.started_at,
        ended_at: s.ended_at,
        exercise_id: r.exercise_id,
        exercise_name: ex.name,
        category: ex.category,
        weight_kg: Number(r.weight_kg),
        reps: r.reps,
      });
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  return facts;
}

export async function getHistoryAction(): Promise<{ data?: HistoryData; error?: string }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);
  if (!user) return { error: SIGN_IN_REQUIRED };

  const [facts, profileRes, metricsRes] = await Promise.all([
    fetchMySetFacts(supabase, user.id),
    supabase.from("profiles").select("preferred_unit").eq("id", user.id).maybeSingle(),
    supabase
      .from("body_metrics")
      .select("id, recorded_date, weight_kg, body_fat_percentage, notes, created_at")
      .order("recorded_date", { ascending: true }),
  ]);
  if (!facts) return { error: "Couldn't load your history" };

  const { sessions, records } = summarize(facts);

  // Who trained with me? Only sessions I can see, and only buddies RLS lets me read.
  const recentIds = sessions.slice(0, 50).map((s) => s.id);
  if (recentIds.length > 0) {
    const { data: others } = await supabase
      .from("session_participants")
      .select("session_id, user_id")
      .in("session_id", recentIds)
      .neq("user_id", user.id)
      .in("status", ["joined", "left"]);
    const ids = [...new Set((others ?? []).map((o) => o.user_id))];
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      for (const p of profiles ?? []) names.set(p.id, p.display_name);
    }
    const withBySession = new Map((others ?? []).map((o) => [o.session_id, names.get(o.user_id) ?? "Buddy"]));
    for (const s of sessions) s.with_name = withBySession.get(s.id) ?? null;
  }

  const bodyMetrics: BodyMetricEntry[] = (metricsRes.data ?? []).map((m) => ({
    id: m.id,
    recorded_date: m.recorded_date,
    weight_kg: Number(m.weight_kg),
    body_fat_percentage: m.body_fat_percentage != null ? Number(m.body_fat_percentage) : null,
    notes: m.notes,
    created_at: m.created_at,
  }));

  return {
    data: {
      unit: profileRes.data?.preferred_unit === "lb" ? "lb" : "kg",
      sessions,
      records,
      bodyMetrics,
    },
  };
}
