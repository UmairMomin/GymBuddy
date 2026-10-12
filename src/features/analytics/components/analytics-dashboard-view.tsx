"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SessionSummary } from "@/features/analytics/actions";
import {
  Calendar,
  Trophy,
  Flame,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function AnalyticsDashboardView({
  sessions,
}: {
  sessions: SessionSummary[];
}) {
  const [expandedSessionId, setExpandedSessionId] = React.useState<string | null>(
    sessions[0]?.id || null
  );

  // Overall lifetime stats
  const totalCompletedWorkouts = sessions.length;
  const lifetimeVolumeKg = sessions.reduce((sum, s) => sum + s.total_volume_kg, 0);
  const totalCompletedSets = sessions.reduce((sum, s) => sum + s.completed_sets_count, 0);

  // Top personal lifts (PR highlights) across all sessions
  const personalRecords = React.useMemo(() => {
    const map = new Map<string, { weight_kg: number; reps: number; session_name: string; date: string }>();
    sessions.forEach((s) => {
      s.exercises_summary.forEach((ex) => {
        const existing = map.get(ex.name);
        if (!existing || ex.top_weight_kg > existing.weight_kg) {
          map.set(ex.name, {
            weight_kg: ex.top_weight_kg,
            reps: ex.top_reps,
            session_name: s.name,
            date: new Date(s.started_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
          });
        }
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].weight_kg - a[1].weight_kg);
  }, [sessions]);

  const toggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History & Analytics</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Review past workout logs, volume trends, and personal records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a href="/api/export?format=csv" download>
            <Button variant="outline" size="sm" className="gap-1.5 border-zinc-700 text-xs h-9">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </a>
          <a href="/api/export?format=json" download>
            <Button variant="outline" size="sm" className="gap-1.5 border-zinc-700 text-xs h-9">
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
          </a>
        </div>
      </div>

      {/* High-Level Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-zinc-800 bg-zinc-900/60 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Flame className="h-4 w-4 text-emerald-400" />
            <span>Workouts</span>
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">{totalCompletedWorkouts}</p>
          <p className="text-[10px] text-zinc-500">Logged to date</p>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <BarChart2 className="h-4 w-4 text-emerald-400" />
            <span>Total Volume</span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400">
            {(lifetimeVolumeKg / 1000).toFixed(1)}k <span className="text-xs font-normal text-zinc-400">kg</span>
          </p>
          <p className="text-[10px] text-zinc-500">Lifted in total</p>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <span>Total Sets</span>
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-100">{totalCompletedSets}</p>
          <p className="text-[10px] text-zinc-500">Finished sets</p>
        </Card>
      </div>

      {/* Top Personal Records Carousel / Grid */}
      {personalRecords.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Personal Records (Top Weights)
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {personalRecords.slice(0, 8).map(([name, record]) => (
              <div
                key={name}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1"
              >
                <p className="font-semibold text-xs text-zinc-200 truncate">{name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {record.weight_kg}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">kg × {record.reps}</span>
                </div>
                <p className="text-[10px] text-zinc-500">{record.date}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Workout History Log */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Workout Log History ({sessions.length})
          </h2>
        </div>

        {sessions.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-transparent text-center p-8">
            <Calendar className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-300">No completed workouts yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
              Finish a workout session from the home screen to build your performance history and progress charts.
            </p>
            <Link href="/">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold text-xs">
                Start a Workout
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isExpanded = expandedSessionId === session.id;
              const startDate = new Date(session.started_at);
              const dateFormatted = startDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const timeFormatted = startDate.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Card
                  key={session.id}
                  className="border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all"
                >
                  <CardHeader
                    onClick={() => toggleExpand(session.id)}
                    className="p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-zinc-100">
                            {session.name}
                          </CardTitle>
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                            Completed
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                            <span>{dateFormatted} at {timeFormatted}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-mono text-sm font-bold text-emerald-400">
                            {session.total_volume_kg.toLocaleString()} kg
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {session.completed_sets_count} sets • {session.exercises_count} movements
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Expandable Exercise Details */}
                  {isExpanded && (
                    <CardContent className="border-t border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Exercise Performance Breakdown
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {session.exercises_summary.map((ex, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-zinc-200">{ex.name}</p>
                              <p className="text-[11px] text-zinc-400">
                                {ex.sets_count} sets completed
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-bold text-zinc-100">
                                {ex.top_weight_kg} kg <span className="text-[10px] text-zinc-500 font-normal">× {ex.top_reps}</span>
                              </p>
                              <p className="text-[10px] font-mono text-emerald-400">
                                Est. 1RM: {ex.estimated_1rm} kg
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
