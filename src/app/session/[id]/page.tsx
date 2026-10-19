import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveSessionAction } from "@/features/sessions/actions";
import { getExercisesAction } from "@/features/routines/actions";
import { ActiveWorkoutView } from "@/features/sessions/components/active-workout-view";
import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

async function SessionContent({ sessionId }: { sessionId: string }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-4">
        <Lock className="h-10 w-10 text-zinc-600 mb-3" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-sm mb-4">
          Please sign in to log workouts with your training group.
        </p>
        <Link href="/login">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold">
            Sign In to Continue
          </Button>
        </Link>
      </div>
    );
  }

  const sessionRes = await getActiveSessionAction(sessionId);

  if (sessionRes.error || !sessionRes.data?.session) {
    return notFound();
  }

  const { session, sets } = sessionRes.data;
  // Built-in exercises plus this group's custom ones.
  const exercisesRes = await getExercisesAction(session.workspace_id);
  const exercises = exercisesRes.data || [];

  return (
    <ActiveWorkoutView
      session={session}
      initialSets={sets}
      availableExercises={exercises}
      currentUserId={user.id}
    />
  );
}

async function SessionContentWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionContent sessionId={id} />;
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading workout session...</p>
        </div>
      }
    >
      <SessionContentWrapper params={params} />
    </Suspense>
  );
}
