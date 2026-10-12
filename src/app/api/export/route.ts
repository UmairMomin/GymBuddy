import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all completed workouts and sets for user
  const { data: sets, error } = await supabase
    .from("workout_sets")
    .select(`
      id,
      created_at,
      set_order,
      set_type,
      weight_kg,
      reps,
      rpe,
      completed,
      notes,
      exercises (name, category, primary_equipment),
      workout_sessions (name, started_at, ended_at)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flattened = (sets || []).map((s) => ({
    set_id: s.id,
    logged_at: s.created_at,
    session_name: s.workout_sessions?.name || "Workout",
    session_start: s.workout_sessions?.started_at,
    session_end: s.workout_sessions?.ended_at,
    exercise_name: s.exercises?.name,
    category: s.exercises?.category,
    equipment: s.exercises?.primary_equipment,
    set_order: s.set_order,
    set_type: s.set_type,
    weight_kg: s.weight_kg,
    reps: s.reps,
    volume_kg: Number(s.weight_kg) * Number(s.reps),
    rpe: s.rpe,
    completed: s.completed,
    notes: s.notes,
  }));

  if (format === "csv") {
    const headers = [
      "Logged At",
      "Session Name",
      "Exercise",
      "Category",
      "Equipment",
      "Set #",
      "Type",
      "Weight (kg)",
      "Reps",
      "Volume (kg)",
      "RPE",
      "Completed",
      "Notes",
    ];

    const rows = flattened.map((row) => [
      row.logged_at,
      `"${(row.session_name || "").replace(/"/g, '""')}"`,
      `"${(row.exercise_name || "").replace(/"/g, '""')}"`,
      row.category,
      row.equipment || "",
      row.set_order,
      row.set_type,
      row.weight_kg,
      row.reps,
      row.volume_kg,
      row.rpe || "",
      row.completed,
      `"${(row.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gym-tracker-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(flattened, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gym-tracker-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
