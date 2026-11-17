import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { LoadingScreen } from "@/components/ui/loaders";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getSessionAccessAction, getWorkoutAction, getWorkoutSummaryAction } from "@/features/workout/actions";
import { InviteCard } from "@/features/workout/components/invite-card";
import { ActiveWorkout } from "@/features/workout/components/active-workout";
import { WorkoutSummaryView } from "@/features/workout/components/workout-summary";

async function WorkoutContent({ params, edit }: { params: Promise<{ id: string }>; edit: boolean }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // the proxy redirects signed-out visitors to /login

  // An invited buddy must confirm before seeing anything about the workout.
  const access = await getSessionAccessAction(id);
  if (access.data?.state === "invited") {
    return <InviteCard sessionId={access.data.sessionId} name={access.data.name} hostName={access.data.hostName} />;
  }

  // A completed workout opens as a read-only recap; "Edit workout" adds ?edit=1 to get the full screen.
  if (!edit) {
    const summary = await getWorkoutSummaryAction(id);
    if (summary.data) return <WorkoutSummaryView data={summary.data} />;
  }

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
  return <ActiveWorkout key={res.data.session.id} data={res.data} editing={edit && res.data.session.status === "completed"} />;
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const edit = (await searchParams).edit === "1";
  return (
    <Suspense
      fallback={<LoadingScreen title="Loading workout" subtitle="Getting your exercises ready" />}
    >
      <WorkoutContent params={params} edit={edit} />
    </Suspense>
  );
}
