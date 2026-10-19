import { describe, expect, it } from "vitest";
import { summarize, type SetFact } from "@/features/history/aggregate";

const fact = (over: Partial<SetFact>): SetFact => ({
  session_id: "s1",
  session_name: "Push",
  started_at: "2026-10-10T10:00:00Z",
  ended_at: "2026-10-10T11:00:00Z",
  exercise_id: "bench",
  exercise_name: "Bench Press",
  category: "chest",
  weight_kg: 60,
  reps: 8,
  ...over,
});

describe("summarize", () => {
  it("totals volume and sets per session and per exercise", () => {
    const { sessions } = summarize([fact({}), fact({ weight_kg: 62.5, reps: 6 }), fact({ exercise_id: "fly", exercise_name: "Fly", weight_kg: 20, reps: 12 })]);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.completed_sets_count).toBe(3);
    expect(s.total_volume_kg).toBe(60 * 8 + 62.5 * 6 + 20 * 12);
    expect(s.exercises_count).toBe(2);
    const bench = s.exercises_summary.find((e) => e.name === "Bench Press")!;
    expect(bench.sets_count).toBe(2);
    expect(bench.top_weight_kg).toBe(62.5);
    expect(bench.top_reps).toBe(6);
    expect(bench.volume_kg).toBe(60 * 8 + 62.5 * 6);
  });

  it("orders sessions newest first and ignores empty sets", () => {
    const { sessions } = summarize([
      fact({ session_id: "old", started_at: "2026-10-01T10:00:00Z" }),
      fact({ session_id: "new", started_at: "2026-10-15T10:00:00Z" }),
      fact({ session_id: "new", reps: 0 }),
    ]);
    expect(sessions.map((s) => s.id)).toEqual(["new", "old"]);
    expect(sessions[0].completed_sets_count).toBe(1);
  });

  it("picks the heaviest set as the record, ties broken by reps, earliest session keeps an exact tie", () => {
    const { records } = summarize([
      fact({ session_id: "a", started_at: "2026-10-01T10:00:00Z", weight_kg: 80, reps: 5 }),
      fact({ session_id: "b", started_at: "2026-10-08T10:00:00Z", weight_kg: 80, reps: 5 }),
      fact({ session_id: "c", started_at: "2026-10-15T10:00:00Z", weight_kg: 80, reps: 6 }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].session_id).toBe("c");
    expect(records[0].reps).toBe(6);

    const tie = summarize([
      fact({ session_id: "a", started_at: "2026-10-01T10:00:00Z", weight_kg: 80, reps: 5 }),
      fact({ session_id: "b", started_at: "2026-10-08T10:00:00Z", weight_kg: 80, reps: 5 }),
    ]).records;
    expect(tie[0].session_id).toBe("a");
  });

  it("reflects an edited set after the fact (history is derived, not stored)", () => {
    const before = summarize([fact({ weight_kg: 60, reps: 8 })]);
    const after = summarize([fact({ weight_kg: 65, reps: 8 })]);
    expect(before.sessions[0].total_volume_kg).toBe(480);
    expect(after.sessions[0].total_volume_kg).toBe(520);
    expect(after.records[0].weight_kg).toBe(65);
  });

  it("returns empty results for no sets", () => {
    expect(summarize([])).toEqual({ sessions: [], records: [] });
  });
});
