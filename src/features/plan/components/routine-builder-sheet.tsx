"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, Link2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { saveRoutineAction, type PlanExercise, type PlanRoutine } from "@/features/plan/actions";
import { EXERCISE_CATEGORIES, WEEKDAY_LABELS } from "@/features/plan/schemas";
import { ExerciseFormSheet, labelize } from "@/features/plan/components/exercise-form-sheet";
import { clearLoneGroups, groupBySuperset, memberTag, pairItems, unpairGroup } from "@/features/workout/supersets";
import { randomUUID } from "@/lib/uuid";
import { cn } from "@/lib/utils";

type Item = { exercise_id: string; target_sets: number; rep_min: number; rep_max: number; superset_group: string | null };

const numberInput =
  "h-11 w-full rounded-xl border-0 bg-zinc-950 text-center text-base font-bold text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** null = creating a new routine */
  routine: PlanRoutine | null;
  routines: PlanRoutine[];
  exercises: PlanExercise[];
  schedule: Array<string | null>;
  onSaved: () => void;
};

/** Mounts the builder only while open, so its state starts fresh from `routine` every time. */
export function RoutineBuilderSheet(props: Props) {
  if (!props.open) return null;
  return <RoutineBuilder key={props.routine?.id ?? "new"} {...props} />;
}

function RoutineBuilder({ open, onClose, routine, routines, exercises, schedule, onSaved }: Props) {
  // Client-generated id: saving twice (double tap, retry) hits the same routine instead of duplicating it.
  const [routineId] = React.useState(() => routine?.id ?? randomUUID());
  const [name, setName] = React.useState(routine?.name ?? "");
  const [items, setItems] = React.useState<Item[]>(() =>
    (routine?.items ?? []).map((i) => ({
      exercise_id: i.exercise_id,
      target_sets: i.target_sets,
      rep_min: i.rep_min,
      rep_max: i.rep_max,
      superset_group: i.superset_group,
    }))
  );
  const [weekdays, setWeekdays] = React.useState<number[]>(routine?.weekdays ?? []);
  const [extra, setExtra] = React.useState<PlanExercise[]>([]);
  const [picking, setPicking] = React.useState(false);
  /** Exercise being paired into a superset, and the partner picked so far. */
  const [linkFrom, setLinkFrom] = React.useState<string | null>(null);
  const [linkPick, setLinkPick] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();


  const all = React.useMemo(() => [...exercises, ...extra], [exercises, extra]);
  const byId = React.useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);

  const pickable = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const used = new Set(items.map((i) => i.exercise_id));
    return all.filter(
      (e) =>
        !used.has(e.id) &&
        (category === "all" || e.category === category) &&
        (q === "" || e.name.toLowerCase().includes(q))
    );
  }, [all, items, query, category]);

  const routineNameById = React.useMemo(() => new Map(routines.map((r) => [r.id, r.name])), [routines]);

  function addExercise(id: string) {
    setItems((prev) => [...prev, { exercise_id: id, target_sets: 3, rep_min: 8, rep_max: 12, superset_group: null }]);
  }
  function patch(index: number, change: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...change } : it)));
  }
  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function applyLink() {
    if (!linkFrom || !linkPick) return;
    // Any exercise can be paired; one not in the routine yet is added with the usual defaults.
    setItems((prev) => {
      const withPartner = prev.some((i) => i.exercise_id === linkPick)
        ? prev
        : [...prev, { exercise_id: linkPick, target_sets: 3, rep_min: 8, rep_max: 12, superset_group: null }];
      return pairItems(withPartner, linkFrom, linkPick, randomUUID());
    });
    setLinkFrom(null);
    setLinkPick(null);
    setQuery("");
  }
  function toggleDay(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveRoutineAction({
        id: routineId,
        name,
        description: routine?.description ?? null,
        weekdays,
        items,
      });
      if (res.error) return setError(res.error);
      onSaved();
      onClose();
    });
  }

  const renderItem = (it: Item, tag?: string) => {
    const index = items.findIndex((x) => x.exercise_id === it.exercise_id);
    const ex = byId.get(it.exercise_id);
    return (
        <li key={it.exercise_id} className="rounded-2xl bg-zinc-900 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-50">{tag && <span className="mr-1.5 text-emerald-400">{tag}</span>}{ex?.name ?? "Unknown exercise"}</p>
              <p className="text-xs text-zinc-400">{ex ? labelize(ex.category) : ""}</p>
            </div>
            <div className="flex shrink-0">
              <button type="button" aria-label={`Link ${ex?.name ?? "exercise"} as superset`} onClick={() => { setQuery(""); setLinkPick(null); setLinkFrom(it.exercise_id); }} className={cn("flex h-11 w-11 items-center justify-center rounded-lg hover:bg-zinc-800", it.superset_group ? "text-emerald-400" : "text-zinc-400")}>
                <Link2 className="h-[18px] w-[18px]" />
              </button>
              <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Remove ${ex?.name ?? "exercise"}`} onClick={() => setItems((p) => clearLoneGroups(p.filter((_, i) => i !== index)))} className="flex h-11 w-11 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-zinc-400">
            <label className="space-y-1">
              <span>Sets</span>
              <input inputMode="numeric" className={numberInput} value={it.target_sets} onChange={(e) => patch(index, { target_sets: clampInt(e.target.value, 1, 20, it.target_sets) })} />
            </label>
            <label className="space-y-1">
              <span>Reps min</span>
              <input inputMode="numeric" className={numberInput} value={it.rep_min} onChange={(e) => patch(index, { rep_min: clampInt(e.target.value, 1, 100, it.rep_min) })} />
            </label>
            <label className="space-y-1">
              <span>Reps max</span>
              <input inputMode="numeric" className={numberInput} value={it.rep_max} onChange={(e) => patch(index, { rep_max: clampInt(e.target.value, 1, 100, it.rep_max) })} />
            </label>
          </div>
        </li>
    );
  };

  const footer = linkFrom ? (
    <div className="space-y-2">
      <Button className="w-full" disabled={!linkPick} onClick={applyLink}>
        Link as superset
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => setLinkFrom(null)}>
        Cancel
      </Button>
    </div>
  ) : picking ? (
    <Button variant="secondary" className="w-full" onClick={() => setPicking(false)}>
      Done adding
    </Button>
  ) : (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <Button className="w-full" onClick={save} disabled={pending || name.trim() === "" || items.length === 0}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {routine ? "Save routine" : "Create routine"}
      </Button>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={linkFrom ? "Superset with" : picking ? "Add exercises" : routine ? "Edit routine" : "New routine"}
        footer={footer}
      >
        {linkFrom ? (
          <div className="space-y-3 pt-2">
            <p className="text-[13px] leading-snug text-zinc-400">
              Pick any exercise to pair with {byId.get(linkFrom)?.name ?? "this exercise"}. One not in this routine yet is added. An exercise is in one superset at a time, so picking one that is already paired moves it here.
            </p>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
              <label htmlFor="link-search" className="sr-only">Search exercises</label>
              <Input id="link-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="pl-9" />
            </div>
            <ul className="space-y-1.5">
              {all
                .filter((e) => e.id !== linkFrom && (query.trim() === "" || e.name.toLowerCase().includes(query.trim().toLowerCase())))
                .map((e) => {
                  const inRoutine = items.find((i) => i.exercise_id === e.id);
                  const from = items.find((i) => i.exercise_id === linkFrom);
                  const note = !inRoutine ? "Will be added" : inRoutine.superset_group && inRoutine.superset_group !== from?.superset_group ? "Already paired" : "In routine";
                  const picked = linkPick === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        aria-pressed={picked}
                        onClick={() => setLinkPick(e.id)}
                        className={cn(
                          "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 text-left",
                          picked ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                        )}
                      >
                        <span aria-hidden className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full", picked ? "bg-emerald-500 text-accent-ink" : "border-2 border-zinc-600")}>
                          {picked && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-50">{e.name}</span>
                          <span className="text-xs text-zinc-400">
                            {labelize(e.category)}
                            {e.primary_equipment ? ` · ${labelize(e.primary_equipment)}` : ""}
                          </span>
                        </span>
                        <span className={cn("text-[11px] font-semibold", note === "Will be added" ? "text-emerald-400" : "text-zinc-400")}>{note}</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : picking ? (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
              <label htmlFor="pick-search" className="sr-only">Search exercises</label>
              <Input id="pick-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="pl-9" />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by muscle group">
              {["all", ...EXERCISE_CATEGORIES].map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold",
                    category === c ? "bg-emerald-500 text-accent-ink" : "bg-zinc-900 text-zinc-300"
                  )}
                >
                  {labelize(c)}
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New exercise
            </Button>
            <ul className="space-y-1.5">
              {pickable.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => addExercise(e.id)}
                    className="flex min-h-[52px] w-full items-center justify-between rounded-xl bg-zinc-900 px-3 text-left hover:bg-zinc-800"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-zinc-50">{e.name}</span>
                      <span className="text-xs text-zinc-400">
                        {labelize(e.category)}
                        {e.primary_equipment ? ` · ${labelize(e.primary_equipment)}` : ""}
                      </span>
                    </span>
                    <Plus className="h-5 w-5 text-emerald-400" aria-hidden />
                  </button>
                </li>
              ))}
              {pickable.length === 0 && <li className="p-4 text-center text-sm text-zinc-400">No matching exercises.</li>}
            </ul>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="routine-name" className="text-xs font-semibold text-zinc-400">Name</label>
              <Input id="routine-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Push" />
            </div>

            <div className="space-y-1.5">
              <p id="days-label" className="text-xs font-semibold text-zinc-400">Runs on</p>
              <div role="group" aria-labelledby="days-label" className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={weekdays.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-11 rounded-xl text-xs font-bold",
                      weekdays.includes(day) ? "bg-emerald-500 text-accent-ink" : "bg-zinc-900 text-zinc-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {weekdays
                .filter((d) => schedule[d] && schedule[d] !== routineId)
                .map((d) => (
                  <p key={d} className="text-xs text-amber-400">
                    {WEEKDAY_LABELS[d]} is currently {routineNameById.get(schedule[d]!) ?? "another routine"}; saving replaces it.
                  </p>
                ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400">Exercises</p>
              {items.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-400">
                  No exercises yet.
                </p>
              )}
              <ol className="space-y-2">
                {groupBySuperset(items.map((it) => ({ ...it, id: it.exercise_id }))).map((b) =>
                  b.group === null ? (
                    renderItem(b.members[0])
                  ) : (
                    <li key={b.group} className="list-none">
                      <div role="group" aria-label={`Superset ${b.letter}`} className="space-y-2 rounded-[22px] border border-emerald-500/60 p-2">
                        <div className="flex h-7 items-center gap-2 px-1.5">
                          <Link2 aria-hidden className="h-4 w-4 text-emerald-400" />
                          <span className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-emerald-400">Superset {b.letter}</span>
                          <button type="button" onClick={() => setItems((p) => unpairGroup(p, b.group as string))} className="ml-auto px-1.5 text-xs font-semibold text-red-400">
                            Remove
                          </button>
                        </div>
                        <ol className="space-y-2">{b.members.map((m, n) => renderItem(m, memberTag(b.letter ?? "A", n)))}</ol>
                      </div>
                    </li>
                  )
                )}
              </ol>
              <Button variant="outline" className="w-full border-dashed border-emerald-500/60 text-emerald-400" onClick={() => setPicking(true)}>
                <Plus className="h-4 w-4" /> Add exercise
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <ExerciseFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(created) => {
          if (created) {
            setExtra((p) => [...p, created]);
            addExercise(created.id);
          }
        }}
      />
    </>
  );
}
