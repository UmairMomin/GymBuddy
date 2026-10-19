import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutAction } from "@/features/workout/actions";
import { ActiveWorkout } from "@/features/workout/components/active-workout";

async function WorkoutContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // the proxy redirects signed-out visitors to /login

  const res = await getWorkoutAction(id);
  if (!res.data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-sm flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-zinc-300">{res.error ?? "Workout not found"}</p>
        <Link href="/">
          <Button variant="secondary">Back to Today</Button>
        </Link>
      </div>
    );
  }
  // Keyed by session so navigating between workouts never reuses another workout's local state.
  return <ActiveWorkout key={res.data.session.id} data={res.data} />;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading workout...</p>
        </div>
      }
    >
      <WorkoutContent params={params} />
    </Suspense>
  );
}
