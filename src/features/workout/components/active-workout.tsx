"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  addExerciseToWorkoutAction,
  deleteSetAction,
  discardWorkoutAction,
  finishWorkoutAction,
  saveSetAction,
  setExerciseSkippedAction,
  type SessionExerciseView,
  type WorkoutData,
} from "@/features/workout/actions";
import { RestTimerDock, formatClock, useNow, type RestState } from "@/features/workout/components/rest-timer-dock";
import { toCanonicalKg, toPreferredWeight } from "@/lib/units";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  order: number;
  weight: string;
  reps: string;
  completed: boolean;
  /** Last server revision we know about; null until the first save succeeds. */
  saved: boolean;
  error: string | null;
};

type ExerciseState = Omit<SessionExerciseView, "sets"> & { rows: Row[] };

/** Wall-clock time for event handlers (kept outside the component body so render stays pure). */
const nowMs = () => Date.now();

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function toExerciseState(ex: SessionExerciseView, unit: "kg" | "lb"): ExerciseState {
  const { sets, ...rest } = ex;
  const rows: Row[] = sets.map((s) => ({
    id: s.id,
    order: s.set_order,
    weight: s.weight_kg > 0 ? fmt(toPreferredWeight(s.weight_kg, unit)) : "",
    reps: s.reps > 0 ? String(s.reps) : "",
    completed: s.completed,
    saved: true,
    error: null,
  }));
  let order = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) : 0;
  while (rows.length < ex.target_sets) {
    order += 1;
    rows.push({ id: crypto.randomUUID(), order, weight: "", reps: "", completed: false, saved: false, error: null });
  }
  return { ...rest, rows };
}

function parseWeight(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function parseReps(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ActiveWorkout({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { unit, session, userId } = data;
  const live = session.status === "in_progress";

  const [exercises, setExercises] = React.useState<ExerciseState[]>(() =>
    data.exercises.map((e) => toExerciseState(e, unit))
  );
  const [current, setCurrent] = React.useState(() => {
    const i = data.exercises.findIndex(
      (e) => !e.skipped && e.sets.filter((s) => s.completed).length < e.target_sets
    );
    return i === -1 ? 0 : i;
  });
  const [rest, setRest] = React.useState<RestState | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [banner, setBanner] = React.useState<string | null>(null);
  const [busy, startTransition] = React.useTransition();

  // Per-set write queue + latest known revision, so rapid taps never race or go stale.
  const queues = React.useRef(new Map<string, Promise<unknown>>());
  const revisions = React.useRef(
    new Map<string, number | null>(data.exercises.flatMap((e) => e.sets.map((s) => [s.id, s.revision_number] as const)))
  );

  const now = useNow(live, 1000);
  const endMs = session.endedAt ? Date.parse(session.endedAt) : now;
  const elapsed = Math.max(0, (endMs - Date.parse(session.startedAt)) / 1000);

  const ex = exercises[current] as ExerciseState | undefined;

  function patchRow(exId: string, rowId: string, change: Partial<Row>) {
    setExercises((prev) =>
      prev.map((e) => (e.id === exId ? { ...e, rows: e.rows.map((r) => (r.id === rowId ? { ...r, ...change } : r)) } : e))
    );
  }

  function placeholderFor(e: ExerciseState, index: number): { weight: string; reps: string } {
    const l = e.last[index] ?? e.last[e.last.length - 1];
    if (l) return { weight: l.weight_kg > 0 ? fmt(toPreferredWeight(l.weight_kg, unit)) : "", reps: l.reps > 0 ? String(l.reps) : "" };
    const prev = e.rows[index - 1];
    return { weight: prev?.weight ?? "", reps: prev?.reps ?? "" };
  }

  /** Queue a write for one set; applies the server's answer (revision, or the winning values on conflict). */
  function persist(e: ExerciseState, row: Row, values: { weight: number; reps: number; completed: boolean }) {
    const run = async () => {
      const res = await saveSetAction({
        id: row.id,
        session_id: session.id,
        exercise_id: e.exercise_id,
        user_id: userId,
        set_order: row.order,
        set_type: "normal",
        weight_kg: toCanonicalKg(values.weight, unit),
        reps: values.reps,
        completed: values.completed,
        expected_revision: revisions.current.get(row.id) ?? null,
      });
      if (res.data) {
        revisions.current.set(row.id, res.data.revision_number);
        if (res.conflict) {
          patchRow(e.id, row.id, {
            weight: res.data.weight_kg > 0 ? fmt(toPreferredWeight(res.data.weight_kg, unit)) : "",
            reps: res.data.reps > 0 ? String(res.data.reps) : "",
            completed: res.data.completed,
            saved: true,
            error: res.error ?? null,
          });
        } else {
          patchRow(e.id, row.id, { saved: true, error: null });
        }
      } else {
        patchRow(e.id, row.id, { error: res.error ?? "Couldn't save", completed: row.saved ? row.completed : false });
      }
    };
    const prior = queues.current.get(row.id) ?? Promise.resolve();
    queues.current.set(row.id, prior.then(run, run));
  }

  function toggleComplete(e: ExerciseState, index: number) {
    const row = e.rows[index];
    if (row.completed) {
      patchRow(e.id, row.id, { completed: false, error: null });
      persist(e, row, { weight: parseWeight(row.weight) ?? 0, reps: parseReps(row.reps) ?? 0, completed: false });
      return;
    }
    // A confirm tap accepts the grey placeholder values when nothing was typed.
    const ph = placeholderFor(e, index);
    const weight = parseWeight(row.weight || ph.weight);
    const reps = parseReps(row.reps || ph.reps);
    if (weight === null || reps === null || reps === 0) {
      patchRow(e.id, row.id, { error: "Enter weight and reps" });
      return;
    }
    const filled = { ...row, weight: row.weight || ph.weight, reps: row.reps || ph.reps, completed: true, error: null };
    patchRow(e.id, row.id, filled);
    persist(e, filled, { weight, reps, completed: true });
    if (live) {
      const seconds = e.rest_seconds ?? 90;
      setRest({ endsAt: nowMs() + seconds * 1000, total: seconds });
    }
  }

  function commitEdit(e: ExerciseState, row: Row) {
    // Only already-logged sets are saved on edit; unlogged rows are saved when confirmed.
    if (!row.saved && !row.completed) return;
    const weight = parseWeight(row.weight);
    const reps = parseReps(row.reps);
    if (weight === null || reps === null) return;
    persist(e, row, { weight, reps, completed: row.completed });
  }

  function addSet(e: ExerciseState) {
    const order = Math.max(0, ...e.rows.map((r) => r.order)) + 1;
    setExercises((prev) =>
      prev.map((x) =>
        x.id === e.id
          ? { ...x, rows: [...x.rows, { id: crypto.randomUUID(), order, weight: "", reps: "", completed: false, saved: false, error: null }] }
          : x
      )
    );
  }

  function removeLastSet(e: ExerciseState) {
    const last = e.rows[e.rows.length - 1];
    if (!last || e.rows.length <= 1) return;
    setExercises((prev) => prev.map((x) => (x.id === e.id ? { ...x, rows: x.rows.slice(0, -1) } : x)));
    if (last.saved) {
      void deleteSetAction(last.id).then((r) => r.error && setBanner(r.error));
    }
    setMenuOpen(false);
  }

  function toggleSkip(e: ExerciseState) {
    const skipped = !e.skipped;
    setExercises((prev) => prev.map((x) => (x.id === e.id ? { ...x, skipped } : x)));
    setMenuOpen(false);
    void setExerciseSkippedAction(e.id, skipped).then((r) => r.error && setBanner(r.error));
  }

  function addExercise(exerciseId: string) {
    startTransition(async () => {
      const res = await addExerciseToWorkoutAction(session.id, exerciseId);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't add that exercise");
        return;
      }
      const meta = data.catalog.find((c) => c.id === exerciseId);
      const view: SessionExerciseView = {
        id: res.data.id,
        exercise_id: exerciseId,
        name: meta?.name ?? "Exercise",
        category: meta?.category ?? "other",
        position: res.data.position,
        target_sets: 3,
        rep_min: null,
        rep_max: null,
        rest_seconds: 90,
        skipped: false,
        sets: [],
        last: [],
      };
      setExercises((prev) => {
        setCurrent(prev.length);
        return [...prev, toExerciseState(view, unit)];
      });
      setAddOpen(false);
      setQuery("");
    });
  }

  function finish() {
    startTransition(async () => {
      const res = await finishWorkoutAction(session.id);
      if (res.error) {
        setBanner(res.error);
        setFinishOpen(false);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  function discard() {
    if (!confirm("Discard this workout? Nothing from it will be kept.")) return;
    startTransition(async () => {
      const res = await discardWorkoutAction(session.id);
      if (res.error) {
        setBanner(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  const completedSets = exercises.reduce((n, e) => n + e.rows.filter((r) => r.completed).length, 0);
  const volumeKg = exercises.reduce(
    (sum, e) =>
      sum +
      e.rows.reduce((s, r) => {
        if (!r.completed) return s;
        const w = parseWeight(r.weight);
        const reps = parseReps(r.reps);
        return w !== null && reps !== null ? s + toCanonicalKg(w, unit) * reps : s;
      }, 0),
    0
  );

  const pickable = React.useMemo(() => {
    const used = new Set(exercises.map((e) => e.exercise_id));
    const q = query.trim().toLowerCase();
    return data.catalog.filter((c) => !used.has(c.id) && (q === "" || c.name.toLowerCase().includes(q)));
  }, [data.catalog, exercises, query]);

  const unitLabel = unit.toUpperCase();

  return (
    <div className="mx-auto w-full max-w-xl pb-44">
      {/* header */}
      <header className="flex items-center gap-3 pb-3">
        <Link
          href="/"
          aria-label="Back to Today"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold uppercase leading-tight tracking-wide">{session.name}</h1>
          <p className="text-xs tabular-nums text-zinc-400" suppressHydrationWarning>
            {live ? formatClock(elapsed) : `${session.status === "completed" ? "Completed" : "Discarded"} · ${formatClock(elapsed)}`}
          </p>
        </div>
        {live && (
          <Button className="h-11 rounded-2xl px-5" onClick={() => setFinishOpen(true)}>
            Finish
          </Button>
        )}
      </header>

      {banner && (
        <p role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {banner}
        </p>
      )}

      {exercises.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-zinc-800 p-6 text-center">
          <p className="text-sm text-zinc-300">No exercises yet. Add the first one to start logging.</p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add exercise
          </Button>
        </div>
      ) : (
        <>
          {/* progress strip: tap a segment to jump */}
          <nav aria-label="Exercises" className="mb-3 flex gap-1.5">
            {exercises.map((e, i) => {
              const done = !e.skipped && e.rows.length > 0 && e.rows.every((r) => r.completed);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`${e.name}${done ? ", done" : e.skipped ? ", skipped" : ""}`}
                  aria-current={i === current}
                  className="flex h-6 flex-1 items-center"
                >
                  <span
                    className={cn(
                      "h-1.5 w-full rounded-full",
                      done ? "bg-emerald-500" : e.skipped ? "bg-zinc-800" : "bg-zinc-700",
                      i === current && !done && "bg-emerald-500/40"
                    )}
                  />
                </button>
              );
            })}
          </nav>

          {ex && (
            <section aria-label={ex.name} className="space-y-3 rounded-3xl bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Exercise {current + 1} of {exercises.length}
                  </p>
                  <h2 className="font-display text-3xl font-extrabold uppercase leading-tight tracking-wide">{ex.name}</h2>
                  {ex.last.length > 0 ? (
                    <p className="text-xs text-zinc-400">
                      Last time:{" "}
                      {ex.last.map((l) => `${fmt(toPreferredWeight(l.weight_kg, unit))}×${l.reps}`).join(", ")} {unit}
                    </p>
                  ) : (
                    ex.rep_min != null && (
                      <p className="text-xs text-zinc-400">
                        Target: {ex.target_sets} × {ex.rep_min}
                        {ex.rep_max && ex.rep_max !== ex.rep_min ? `–${ex.rep_max}` : ""}
                      </p>
                    )
                  )}
                </div>
                <Button variant="ghost" size="icon" aria-label="Exercise options" onClick={() => setMenuOpen(true)}>
                  <MoreHorizontal className="h-5 w-5 text-zinc-400" />
                </Button>
              </div>

              {ex.skipped ? (
                <div className="space-y-2 rounded-2xl border border-dashed border-zinc-700 p-4 text-center">
                  <p className="text-sm text-zinc-400">Skipped for today.</p>
                  <Button variant="secondary" onClick={() => toggleSkip(ex)}>Restore exercise</Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] gap-2.5 px-0.5 text-[11px] font-semibold text-zinc-400">
                    <span>SET</span>
                    <span className="text-center">{unitLabel}</span>
                    <span className="text-center">REPS</span>
                    <span />
                  </div>
                  <ol className="space-y-2.5">
                    {ex.rows.map((row, i) => {
                      const ph = placeholderFor(ex, i);
                      const isNext = !row.completed && ex.rows.slice(0, i).every((r) => r.completed);
                      return (
                        <li key={row.id}>
                          <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] items-center gap-2.5">
                            <span className={cn("text-center text-sm font-bold", row.completed ? "text-emerald-400" : "text-zinc-300")}>
                              {i + 1}
                            </span>
                            {(["weight", "reps"] as const).map((field) => (
                              <input
                                key={field}
                                inputMode={field === "weight" ? "decimal" : "numeric"}
                                aria-label={`Set ${i + 1} ${field === "weight" ? `weight (${unit})` : "reps"}`}
                                value={row[field]}
                                placeholder={field === "weight" ? ph.weight : ph.reps}
                                onChange={(e) => patchRow(ex.id, row.id, { [field]: e.target.value, error: null })}
                                onBlur={() => commitEdit(ex, row)}
                                className={cn(
                                  "h-[52px] w-full min-w-0 rounded-2xl border-2 text-center text-xl font-bold tabular-nums placeholder:font-semibold placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                                  row.completed
                                    ? "border-transparent bg-emerald-500/15 text-zinc-50"
                                    : isNext
                                      ? "border-emerald-500 bg-zinc-950 text-zinc-50"
                                      : "border-transparent bg-zinc-800/70 text-zinc-50"
                                )}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => toggleComplete(ex, i)}
                              aria-label={row.completed ? `Set ${i + 1} logged, tap to undo` : `Log set ${i + 1}`}
                              aria-pressed={row.completed}
                              className={cn(
                                "flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-2 transition-transform active:scale-95",
                                row.completed
                                  ? "border-emerald-500 bg-emerald-500 text-accent-ink"
                                  : isNext
                                    ? "border-emerald-500 text-emerald-400"
                                    : "border-transparent bg-zinc-800/70 text-zinc-400"
                              )}
                            >
                              <Check className="h-6 w-6 stroke-[3]" />
                            </button>
                          </div>
                          {row.error && (
                            <p role="alert" className="mt-1 pl-9 text-xs text-red-400">{row.error}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <Button variant="outline" className="h-12 w-full border-dashed text-zinc-400" onClick={() => addSet(ex)}>
                    <Plus className="h-4 w-4" /> Add set
                  </Button>
                </>
              )}
            </section>
          )}

          {/* prev / next */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Exercise
            </Button>
            <Button variant="ghost" disabled={current >= exercises.length - 1} onClick={() => setCurrent((c) => Math.min(exercises.length - 1, c + 1))}>
              {exercises[current + 1] ? <span className="max-w-[7rem] truncate">{exercises[current + 1].name}</span> : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {live && rest && (
        <RestTimerDock
          rest={rest}
          onAdjust={(d) =>
            setRest((r) => (r ? { endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) } : r))
          }
          onSkip={() => setRest(null)}
        />
      )}

      {/* exercise menu */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={ex?.name ?? "Exercise"}>
        {ex && (
          <div className="space-y-2 pt-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => toggleSkip(ex)}>
              {ex.skipped ? "Restore exercise" : "Skip this exercise"}
            </Button>
            <Button variant="secondary" className="w-full justify-start" disabled={ex.rows.length <= 1} onClick={() => removeLastSet(ex)}>
              Remove last set
            </Button>
          </div>
        )}
      </Sheet>

      {/* add exercise */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add exercise">
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
            <label htmlFor="add-search" className="sr-only">Search exercises</label>
            <Input id="add-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="pl-9" />
          </div>
          <ul className="space-y-1.5">
            {pickable.slice(0, 60).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addExercise(c.id)}
                  className="flex min-h-[52px] w-full items-center justify-between rounded-xl bg-zinc-900 px-3 text-left hover:bg-zinc-800"
                >
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-xs capitalize text-zinc-400">{c.category.replace("_", " ")}</span>
                </button>
              </li>
            ))}
            {pickable.length === 0 && <li className="p-4 text-center text-sm text-zinc-400">No matching exercises.</li>}
          </ul>
        </div>
      </Sheet>

      {/* finish */}
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout?"
        footer={
          <div className="space-y-2">
            <Button className="w-full" disabled={busy} onClick={finish}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Finish workout
            </Button>
            <Button variant="ghost" className="w-full text-red-400" disabled={busy} onClick={discard}>
              Discard workout
            </Button>
          </div>
        }
      >
        <dl className="grid grid-cols-3 gap-2 pt-2 text-center">
          <div className="rounded-2xl bg-zinc-900 p-3">
            <dt className="text-[11px] font-semibold uppercase text-zinc-400">Time</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">{formatClock(elapsed)}</dd>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-3">
            <dt className="text-[11px] font-semibold uppercase text-zinc-400">Sets</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">{completedSets}</dd>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-3">
            <dt className="text-[11px] font-semibold uppercase text-zinc-400">Volume</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums">
              {Math.round(toPreferredWeight(volumeKg, unit)).toLocaleString("en-US")}
              <span className="ml-0.5 text-xs font-semibold text-zinc-400">{unit}</span>
            </dd>
          </div>
        </dl>
        {exercises.some((e) => !e.skipped && e.rows.some((r) => !r.completed)) && (
          <p className="mt-3 text-sm text-amber-400">Some sets aren&rsquo;t logged yet. They won&rsquo;t be saved.</p>
        )}
      </Sheet>
    </div>
  );
}
