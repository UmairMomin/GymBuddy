import { calculateEstimated1RM } from "@/features/history/calculations";

/** One completed set of mine, joined with its exercise and session. */
export type SetFact = {
  session_id: string;
  session_name: string;
  /** Started without a routine (the only sessions that can be renamed). */
  is_freestyle?: boolean;
  started_at: string;
  ended_at: string | null;
  exercise_id: string;
  exercise_name: string;
  category: string;
  weight_kg: number;
  reps: number;
};

export type ExerciseSummary = {
  name: string;
  category: string;
  sets_count: number;
  top_weight_kg: number;
  top_reps: number;
  estimated_1rm: number;
  volume_kg: number;
};

export type SessionSummary = {
  id: string;
  name: string;
  is_freestyle: boolean;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number;
  completed_sets_count: number;
  exercises_count: number;
  exercises_summary: ExerciseSummary[];
  /** Name of the buddy who trained in this session, if any. */
  with_name?: string | null;
};

export type PersonalRecord = {
  exercise: string;
  category: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  session_id: string;
  session_name: string;
  date: string;
};

/**
 * Roll my completed sets up into per-session summaries (newest first) and one record per exercise.
 * Always derived from the live sets, so edits made after a workout (by me or my buddy) are reflected
 * the next time History loads.
 */
export function summarize(facts: readonly SetFact[]): { sessions: SessionSummary[]; records: PersonalRecord[] } {
  const bySession = new Map<string, { head: SessionSummary; exercises: Map<string, ExerciseSummary> }>();

  for (const f of facts) {
    if (f.reps <= 0) continue;
    let entry = bySession.get(f.session_id);
    if (!entry) {
      entry = {
        head: {
          id: f.session_id,
          name: f.session_name,
          is_freestyle: f.is_freestyle ?? false,
          started_at: f.started_at,
          ended_at: f.ended_at,
          total_volume_kg: 0,
          completed_sets_count: 0,
          exercises_count: 0,
          exercises_summary: [],
        },
        exercises: new Map(),
      };
      bySession.set(f.session_id, entry);
    }

    const volume = f.weight_kg * f.reps;
    const e1rm = calculateEstimated1RM(f.weight_kg, f.reps);
    entry.head.total_volume_kg += volume;
    entry.head.completed_sets_count += 1;

    const ex = entry.exercises.get(f.exercise_id);
    if (!ex) {
      entry.exercises.set(f.exercise_id, {
        name: f.exercise_name,
        category: f.category,
        sets_count: 1,
        top_weight_kg: f.weight_kg,
        top_reps: f.reps,
        estimated_1rm: e1rm,
        volume_kg: volume,
      });
    } else {
      ex.sets_count += 1;
      ex.volume_kg += volume;
      if (f.weight_kg > ex.top_weight_kg || (f.weight_kg === ex.top_weight_kg && f.reps > ex.top_reps)) {
        ex.top_weight_kg = f.weight_kg;
        ex.top_reps = f.reps;
      }
      if (e1rm > ex.estimated_1rm) ex.estimated_1rm = e1rm;
    }
  }

  const sessions = [...bySession.values()]
    .map(({ head, exercises }) => {
      const list = [...exercises.values()];
      return { ...head, exercises_count: list.length, exercises_summary: list };
    })
    .sort((a, b) => b.started_at.localeCompare(a.started_at));

  // One record per exercise: heaviest weight (ties: more reps, then the earlier session keeps it).
  const best = new Map<string, PersonalRecord>();
  for (const s of [...sessions].reverse()) {
    for (const ex of s.exercises_summary) {
      const cur = best.get(ex.name);
      if (!cur || ex.top_weight_kg > cur.weight_kg || (ex.top_weight_kg === cur.weight_kg && ex.top_reps > cur.reps)) {
        best.set(ex.name, {
          exercise: ex.name,
          category: ex.category,
          weight_kg: ex.top_weight_kg,
          reps: ex.top_reps,
          estimated_1rm: ex.estimated_1rm,
          session_id: s.id,
          session_name: s.name,
          date: s.started_at,
        });
      }
    }
  }
  const records = [...best.values()].sort((a, b) => b.estimated_1rm - a.estimated_1rm);

  return { sessions, records };
}
