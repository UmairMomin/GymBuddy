"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type SessionSummary } from "@/features/history/aggregate";
import { toPreferredWeight } from "@/lib/units";
import { TrendingUp, Activity, PieChart as PieIcon } from "lucide-react";

export function HistoryCharts({ sessions, unit }: { sessions: SessionSummary[]; unit: "kg" | "lb" }) {
  // Sort chronologically for charts (oldest to newest)
  const chronologicalSessions = React.useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );
  }, [sessions]);

  // 1. Data for Volume Progression Chart
  const volumeData = React.useMemo(() => {
    return chronologicalSessions.map((s) => ({
      date: new Date(s.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      name: s.name,
      volume: Math.round(toPreferredWeight(s.total_volume_kg, unit)),
    }));
  }, [chronologicalSessions, unit]);

  // 2. All distinct exercise names for strength progression dropdown
  const allExerciseNames = React.useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      s.exercises_summary.forEach((ex) => set.add(ex.name));
    });
    return Array.from(set).sort();
  }, [sessions]);

  const [selectedExercise, setSelectedExercise] = React.useState<string>("");
  const activeExercise =
    selectedExercise && allExerciseNames.includes(selectedExercise)
      ? selectedExercise
      : allExerciseNames[0] || "";

  // Strength data for selected exercise over time
  const strengthData = React.useMemo(() => {
    if (!activeExercise) return [];
    const points: Array<{
      date: string;
      topWeight: number;
      estimated1RM: number;
      reps: number;
    }> = [];

    chronologicalSessions.forEach((s) => {
      const match = s.exercises_summary.find((ex) => ex.name === activeExercise);
      if (match && match.top_weight_kg > 0) {
        points.push({
          date: new Date(s.started_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          topWeight: toPreferredWeight(match.top_weight_kg, unit),
          estimated1RM: toPreferredWeight(match.estimated_1rm, unit),
          reps: match.top_reps,
        });
      }
    });

    return points;
  }, [chronologicalSessions, activeExercise, unit]);

  // 3. Muscle category volume distribution
  const categoryData = React.useMemo(() => {
    const map = new Map<string, { category: string; sets: number; volume: number }>();
    sessions.forEach((s) => {
      s.exercises_summary.forEach((ex) => {
        const cat = ex.category ? ex.category.toUpperCase() : "OTHER";
        const estVol = toPreferredWeight(ex.volume_kg, unit);
        if (!map.has(cat)) {
          map.set(cat, { category: cat, sets: ex.sets_count, volume: estVol });
        } else {
          const item = map.get(cat)!;
          item.sets += ex.sets_count;
          item.volume += estVol;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.sets - a.sets);
  }, [sessions, unit]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Chart 1: Volume Over Time */}
      <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span>Volume Progression ({unit})</span>
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Total lifted tonnage per completed workout
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-text)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent-text)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-zinc-500)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-zinc-700)" }}
                />
                <YAxis
                  stroke="var(--color-zinc-500)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-zinc-700)" }}
                  tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-zinc-200">{data.name}</p>
                          <p className="text-zinc-400 text-[11px]">{data.date}</p>
                          <p className="font-mono font-bold text-emerald-400">
                            {Number(data.volume).toLocaleString()} {unit} volume
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="var(--accent-text)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#volGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: Strength & 1RM Progression */}
      {allExerciseNames.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Strength & 1RM Curve</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Track top weight and estimated 1-Rep Max over time
                </CardDescription>
              </div>

              {/* Exercise Selector */}
              <select
                value={activeExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium"
              >
                {allExerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {strengthData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strengthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--color-zinc-500)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-zinc-700)" }}
                    />
                    <YAxis
                      stroke="var(--color-zinc-500)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-zinc-700)" }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 shadow-xl text-xs space-y-1">
                              <p className="font-semibold text-zinc-200">{activeExercise}</p>
                              <p className="text-zinc-400 text-[11px]">{data.date}</p>
                              <p className="font-mono text-zinc-300">
                                Top: <strong>{data.topWeight} {unit}</strong> × {data.reps} reps
                              </p>
                              <p className="font-mono font-bold text-emerald-400">
                                Est. 1RM: {data.estimated1RM} {unit}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="estimated1RM"
                      name="Est. 1RM"
                      stroke="var(--accent-text)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--accent-text)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="topWeight"
                      name="Top Weight"
                      stroke="var(--color-blue-400)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ fill: "var(--color-blue-400)", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-8 text-center">
                No recorded sets found for {selectedExercise} yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart 3: Muscle Group Balance */}
      {categoryData.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-emerald-400" />
              <span>Muscle Group Set Distribution</span>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Total completed sets aggregated across muscle categories
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-zinc-500)" fontSize={11} tickLine={false} />
                  <YAxis
                    dataKey="category"
                    type="category"
                    stroke="var(--color-zinc-400)"
                    fontSize={11}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 shadow-xl text-xs space-y-1">
                            <p className="font-semibold text-zinc-200">{data.category}</p>
                            <p className="font-mono text-emerald-400 font-bold">
                              {data.sets} completed sets
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="sets" fill="var(--accent-text)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
