"use client";

import * as React from "react";
import type { PlanData } from "@/features/plan/actions";
import { ScheduleTab } from "@/features/plan/components/schedule-tab";
import { RoutinesTab } from "@/features/plan/components/routines-tab";
import { ExercisesTab } from "@/features/plan/components/exercises-tab";
import { cn } from "@/lib/utils";

export type PlanTab = "schedule" | "routines" | "exercises";

const TABS: Array<{ id: PlanTab; label: string }> = [
  { id: "schedule", label: "Schedule" },
  { id: "routines", label: "Routines" },
  { id: "exercises", label: "Exercises" },
];

export function PlanView({ data, initialTab }: { data: PlanData; initialTab: PlanTab }) {
  const [tab, setTab] = React.useState<PlanTab>(initialTab);

  function select(next: PlanTab) {
    setTab(next);
    // Keep the tab in the URL (shareable, survives refresh) without a navigation.
    window.history.replaceState(null, "", `/plan?tab=${next}`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-6">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide">Plan</h1>

      <div role="tablist" aria-label="Plan sections" className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => select(t.id)}
            className={cn(
              "h-11 rounded-xl text-sm font-bold transition-colors",
              tab === t.id ? "bg-emerald-500 text-accent-ink" : "text-zinc-400 hover:text-zinc-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "schedule" && <ScheduleTab routines={data.routines} schedule={data.schedule} />}
        {tab === "routines" && <RoutinesTab routines={data.routines} exercises={data.exercises} schedule={data.schedule} />}
        {tab === "exercises" && <ExercisesTab exercises={data.exercises} />}
      </div>
    </div>
  );
}
