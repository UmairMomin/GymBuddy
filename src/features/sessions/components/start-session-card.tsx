"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startWorkoutSessionAction } from "@/features/sessions/actions";
import { Play, PlusCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function StartSessionCard({
  workspaceId,
  routineId,
  routineVersionId,
  routineName,
}: {
  workspaceId?: string;
  routineId?: string;
  routineVersionId?: string;
  routineName?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleStart(isRoutine: boolean) {
    if (!workspaceId) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const sessionName = isRoutine && routineName
      ? routineName
      : `Freestyle Workout (${new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })})`;

    const res = await startWorkoutSessionAction({
      workspace_id: workspaceId,
      name: sessionName,
      routine_id: isRoutine ? routineId : undefined,
      routine_version_id: isRoutine ? routineVersionId : undefined,
    });

    if (res.data?.sessionId) {
      router.push(`/session/${res.data.sessionId}`);
    } else {
      setLoading(false);
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Play className="h-5 w-5 text-emerald-400 fill-emerald-400" />
          <span>Active Workout</span>
        </CardTitle>
        <CardDescription className="text-zinc-400 text-xs">
          {routineName
            ? `Ready to start planned routine: "${routineName}"`
            : "No active session in progress. Start an empty session or select a routine."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {routineId ? (
          <Button
            onClick={() => handleStart(true)}
            disabled={loading}
            className="w-full justify-center bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold gap-2 h-11"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-zinc-950" />}
            Start &quot;{routineName}&quot;
          </Button>
        ) : (
          <Button
            onClick={() => handleStart(false)}
            disabled={loading}
            className="w-full justify-center bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold gap-2 h-11"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-zinc-950" />}
            Start Empty Workout
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => router.push("/routines")}
          className="w-full justify-center gap-2 border-zinc-700 h-11"
        >
          <PlusCircle className="h-4 w-4" />
          {routineId ? "Choose Another Routine" : "Start From Routine"}
        </Button>
      </CardContent>
    </Card>
  );
}
