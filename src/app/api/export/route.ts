import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { csvRow } from "@/lib/csv";

const PAGE = 1000;
const MAX_PAGES = 50;

type Row = {
  id: string;
  created_at: string;
  user_id: string;
  last_edited_by: string | null;
  set_order: number;
  set_type: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  exercises: { name: string; category: string; primary_equipment: string | null } | null;
  workout_sessions: { name: string; started_at: string; ended_at: string | null; status: string } | null;
};

/** Download my own sets (both lanes of shared workouts are mine only when user_id is me). */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("workout_sets")
      .select(
        "id, created_at, user_id, last_edited_by, set_order, set_type, weight_kg, reps, rpe, completed, notes, exercises(name, category, primary_equipment), workout_sessions(name, started_at, ended_at, status)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    const chunk = (data ?? []) as unknown as Row[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }

  const flat = rows.map((s) => ({
    set_id: s.id,
    logged_at: s.created_at,
    session_name: s.workout_sessions?.name ?? "Workout",
    session_status: s.workout_sessions?.status ?? null,
    session_start: s.workout_sessions?.started_at ?? null,
    session_end: s.workout_sessions?.ended_at ?? null,
    exercise_name: s.exercises?.name ?? null,
    category: s.exercises?.category ?? null,
    equipment: s.exercises?.primary_equipment ?? null,
    set_order: s.set_order,
    set_type: s.set_type,
    weight_kg: Number(s.weight_kg),
    reps: s.reps,
    volume_kg: Number(s.weight_kg) * s.reps,
    rpe: s.rpe,
    completed: s.completed,
    edited_by_buddy: s.last_edited_by !== null && s.last_edited_by !== s.user_id,
    notes: s.notes,
  }));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const header = csvRow([
      "Logged At", "Session", "Status", "Exercise", "Category", "Equipment", "Set #", "Type",
      "Weight (kg)", "Reps", "Volume (kg)", "RPE", "Completed", "Edited by buddy", "Notes",
    ]);
    const body = flat.map((r) =>
      csvRow([
        r.logged_at, r.session_name, r.session_status, r.exercise_name, r.category, r.equipment, r.set_order,
        r.set_type, r.weight_kg, r.reps, r.volume_kg, r.rpe, r.completed, r.edited_by_buddy, r.notes,
      ])
    );
    return new Response([header, ...body].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gymbuddy-export-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify(flat, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gymbuddy-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
