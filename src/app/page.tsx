import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultWorkspaceAction, getRoutinesAction } from "@/features/routines/actions";
import {
  getUpcomingScheduledWorkoutsAction,
  type ScheduledWorkoutItem,
} from "@/features/scheduling/actions";
import { UpcomingWorkoutsCard } from "@/features/scheduling/components/upcoming-workouts-card";
import { StartSessionCard } from "@/features/sessions/components/start-session-card";
import { Card } from "@/components/ui/card";
import { Dumbbell, Users, History, BookOpen } from "lucide-react";
import Link from "next/link";

async function HomeDashboard({ routineId }: { routineId?: string }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let workspaceId: string | undefined;
  let routineName: string | undefined;
  let routineVersionId: string | undefined;
  let scheduledWorkouts: ScheduledWorkoutItem[] = [];
  let availableRoutines: Array<{ id: string; name: string }> = [];

  if (user) {
    const wsRes = await getOrCreateDefaultWorkspaceAction();
    workspaceId = wsRes.data?.id;

    if (workspaceId) {
      const [routinesRes, schedRes] = await Promise.all([
        getRoutinesAction(workspaceId),
        getUpcomingScheduledWorkoutsAction(workspaceId),
      ]);

      availableRoutines = (routinesRes.data || []).map((r) => ({ id: r.id, name: r.name }));
      scheduledWorkouts = schedRes.data || [];

      if (routineId) {
        const found = routinesRes.data?.find((r) => r.id === routineId);
        if (found) {
          routineName = found.name;
          routineVersionId = found.routine_versions?.[0]?.id;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Status / Welcome banner */}
      <section className="space-y-1">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-zinc-400">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <h1 className="text-4xl font-extrabold leading-none tracking-wide">Train together</h1>
        <p className="text-sm text-zinc-400">Track individually. Review progress together.</p>
      </section>

      {/* Primary Action: Start Session Card */}
      <StartSessionCard
        workspaceId={workspaceId}
        routineId={routineId}
        routineVersionId={routineVersionId}
        routineName={routineName}
      />

      {/* Upcoming Scheduled Workouts */}
      {workspaceId && (
        <UpcomingWorkoutsCard
          workspaceId={workspaceId}
          initialWorkouts={scheduledWorkouts}
          routines={availableRoutines}
        />
      )}

      {/* Quick Access Grid */}
      <section className="grid grid-cols-3 gap-3">
        <Link href="/routines" className="block">
          <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors p-4 space-y-2">
            <Dumbbell className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="font-semibold text-xs sm:text-sm">Routines</p>
              <p className="text-[11px] text-zinc-400">Manage splits</p>
            </div>
          </Card>
        </Link>
        <Link href="/exercises" className="block">
          <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors p-4 space-y-2">
            <BookOpen className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="font-semibold text-xs sm:text-sm">Exercises</p>
              <p className="text-[11px] text-zinc-400">Movement library</p>
            </div>
          </Card>
        </Link>
        <Link href="/group" className="block">
          <Card className="h-full border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors p-4 space-y-2">
            <Users className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="font-semibold text-xs sm:text-sm">Group</p>
              <p className="text-[11px] text-zinc-400">Invite partners</p>
            </div>
          </Card>
        </Link>
      </section>

      {/* Recent Activity / Empty State */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Workouts
          </h2>
          <Link href="/analytics" className="text-xs text-emerald-400 hover:underline">
            View all
          </Link>
        </div>
        <Card className="border-dashed border-zinc-800 bg-transparent text-center p-6">
          <History className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-300">No completed workouts yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            Start a session above to record your weights, reps, and track your workout logs.
          </p>
        </Card>
      </section>
    </div>
  );
}

async function HomeDashboardWrapper({
  searchParams,
}: {
  searchParams: Promise<{ routineId?: string }>;
}) {
  const { routineId } = await searchParams;
  return <HomeDashboard routineId={routineId} />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ routineId?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <p className="text-xs text-zinc-500">Loading workout dashboard...</p>
        </div>
      }
    >
      <HomeDashboardWrapper searchParams={searchParams} />
    </Suspense>
  );
}
