"use client";

import * as React from "react";
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
      : `Freestyle Workout (${new Date().toLocaleDateString("en-US", {
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

  const primaryLabel = routineId ? `Start ${routineName ?? "routine"}` : "Start empty workout";

  return (
    <section className="overflow-hidden rounded-3xl bg-emerald-500 p-5 text-accent-ink shadow-lg">
      <p className="font-display text-sm font-bold uppercase tracking-widest opacity-75">
        {routineName ? "Planned routine" : "Ready when you are"}
      </p>
      <h2 className="mt-1 font-display text-5xl font-extrabold leading-[0.95] tracking-wide">
        {routineName ?? "Start workout"}
      </h2>
      <p className="mt-2 text-sm font-medium opacity-80">
        {routineName
          ? "Your planned exercises are loaded. Tap start and log as you go."
          : "Begin with an empty session or pick one of your routines."}
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => handleStart(Boolean(routineId))}
          disabled={loading}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-accent-ink px-4 font-display text-xl font-bold uppercase tracking-wider text-white transition-transform active:scale-[0.97] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
          <span className="truncate">{primaryLabel}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push("/routines")}
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-accent-ink/30 px-4 text-sm font-semibold text-accent-ink transition-transform active:scale-[0.97]"
        >
          <PlusCircle className="h-4 w-4" />
          {routineId ? "Choose another routine" : "Start from routine"}
        </button>
      </div>
    </section>
  );
}
