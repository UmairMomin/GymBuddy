import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateDefaultWorkspaceAction } from "@/features/routines/actions";
import { getCompletedSessionsAction } from "@/features/analytics/actions";
import { AnalyticsDashboardView } from "@/features/analytics/components/analytics-dashboard-view";
import { Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function AnalyticsContent() {
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
          Please sign in to view your workout logs and training analytics.
        </p>
        <Link href="/login">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold">
            Sign In to Continue
          </Button>
        </Link>
      </div>
    );
  }

  const wsRes = await getOrCreateDefaultWorkspaceAction();
  const workspace = wsRes.data;

  if (!workspace) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400">Error loading training group: {wsRes.error}</p>
      </div>
    );
  }

  const sessionsRes = await getCompletedSessionsAction(workspace.id);
  const sessions = sessionsRes.data || [];

  return <AnalyticsDashboardView sessions={sessions} />;
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-500">Loading workout history & analytics...</p>
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
