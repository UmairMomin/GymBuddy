"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BodyMetricEntry,
  logBodyMetricAction,
  deleteBodyMetricAction,
} from "@/features/history/body-metrics-actions";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { UserCheck, Plus, Trash2, Loader2, AlertCircle, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { toCanonicalKg, toPreferredWeight } from "@/lib/units";
import { parseLocalDate } from "@/lib/utils";

export function BodyMetricsCard({ initialMetrics, unit }: { initialMetrics: BodyMetricEntry[]; unit: "kg" | "lb" }) {
  const router = useRouter();
  const [metrics, setMetrics] = React.useState<BodyMetricEntry[]>(initialMetrics);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [recordedDate, setRecordedDate] = React.useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [weight, setWeight] = React.useState<string>("");
  const [bodyFat, setBodyFat] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const chartData = React.useMemo(() => {
    return metrics.map((m) => ({
      date: parseLocalDate(m.recorded_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      weight: toPreferredWeight(m.weight_kg, unit),
      bodyFat: m.body_fat_percentage,
      notes: m.notes,
    }));
  }, [metrics, unit]);

  const latest = metrics[metrics.length - 1];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(weight);
    if (!w || isNaN(w)) return;
    setLoading(true);
    setError(null);

    const res = await logBodyMetricAction({
      recordedDate,
      weightKg: toCanonicalKg(w, unit),
      bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : undefined,
      notes: notes.trim() || undefined,
    });

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setDialogOpen(false);
      setWeight("");
      setBodyFat("");
      setNotes("");
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setMetrics((prev) => prev.filter((m) => m.id !== id));
    await deleteBodyMetricAction(id);
    router.refresh();
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 backdrop-blur">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <span>Personal Body Composition</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Private body weight and body fat percentage trend tracking
          </CardDescription>
        </div>

        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold gap-1 text-xs h-8 px-2.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Log Weight
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric Highlight Card */}
        {latest && (
          <div className="flex items-center gap-4 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
            <div>
              <span className="text-[11px] uppercase text-zinc-500 font-semibold">Latest Weight</span>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {toPreferredWeight(latest.weight_kg, unit)} <span className="text-xs text-zinc-400">{unit}</span>
              </p>
            </div>
            {latest.body_fat_percentage && (
              <div className="border-l border-zinc-800 pl-4">
                <span className="text-[11px] uppercase text-zinc-500 font-semibold">Body Fat</span>
                <p className="text-xl font-bold font-mono text-zinc-200">
                  {latest.body_fat_percentage}%
                </p>
              </div>
            )}
            <span className="ml-auto text-xs text-zinc-500 font-mono">
              Recorded on {parseLocalDate(latest.recorded_date).toLocaleDateString("en-US")}
            </span>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 1 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-zinc-800)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-zinc-500)" fontSize={11} tickLine={false} />
                <YAxis
                  domain={["dataMin - 2", "dataMax + 2"]}
                  stroke="var(--color-zinc-500)"
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 shadow-xl text-xs space-y-1">
                          <p className="font-semibold text-zinc-200">{data.date}</p>
                          <p className="font-mono text-emerald-400 font-bold">{data.weight} {unit}</p>
                          {data.bodyFat && (
                            <p className="font-mono text-zinc-300">{data.bodyFat}% Body Fat</p>
                          )}
                          {data.notes && <p className="italic text-zinc-400">{data.notes}</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--accent-text)"
                  strokeWidth={2.5}
                  dot={{ fill: "var(--accent-text)", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : metrics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
            <TrendingDown className="h-7 w-7 text-zinc-600 mx-auto mb-2" />
            <p className="font-medium text-zinc-300">No body metrics logged yet</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Track weight changes over time alongside your lifting PRs.
            </p>
          </div>
        ) : null}

        {/* Recent logs */}
        {metrics.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold uppercase text-zinc-500">Recent Logs</span>
            <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 bg-zinc-950/40">
              {metrics.slice(-4).reverse().map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 font-mono">
                      {parseLocalDate(m.recorded_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="font-bold font-mono text-emerald-400">{toPreferredWeight(m.weight_kg, unit)} {unit}</span>
                    {m.body_fat_percentage && (
                      <span className="text-zinc-400 font-mono">{m.body_fat_percentage}% BF</span>
                    )}
                    {m.notes && <span className="text-zinc-500 italic truncate max-w-xs">{m.notes}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    title="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DIALOG */}
        {dialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  <span>Log Body Metric</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="text-zinc-400 hover:text-zinc-200 text-sm"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400 border border-red-500/20">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Date *</label>
                  <Input
                    type="date"
                    value={recordedDate}
                    onChange={(e) => setRecordedDate(e.target.value)}
                    className="mt-1 bg-zinc-900 border-zinc-800 text-xs h-10 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Body Weight ({unit}) *</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="20"
                      max="500"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 78.5"
                      className="mt-1 bg-zinc-900 border-zinc-800 text-xs font-mono font-bold h-10"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Body Fat % (Optional)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="3"
                      max="60"
                      value={bodyFat}
                      onChange={(e) => setBodyFat(e.target.value)}
                      placeholder="e.g. 14.5"
                      className="mt-1 bg-zinc-900 border-zinc-800 text-xs font-mono h-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300">Notes (Optional)</label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Fasted morning weigh-in"
                    className="mt-1 bg-zinc-900 border-zinc-800 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1 border-zinc-800 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !weight}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-accent-ink font-semibold text-xs gap-1.5"
                  >
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Log
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
