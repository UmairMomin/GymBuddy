"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronUp, Link2, Loader2, MoreHorizontal, Plus, Search, Share2, TrendingUp, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { ExerciseSkeleton } from "@/components/ui/loaders";
import { REFRESH_EVENT } from "@/components/layout/pull-to-refresh";
import {
  addExerciseToWorkoutAction,
  addSessionRoutineAction,
  getRoutineOfferAction,
  deleteSetAction,
  discardWorkoutAction,
  finishMyWorkoutAction,
  finishWorkoutAction,
  getSessionSyncAction,
  inviteBuddyAction,
  linkSupersetAction,
  unlinkSupersetAction,
  saveSetAction,
  removeExerciseFromWorkoutAction,
  swapExerciseInWorkoutAction,
  type RosterEntry,
  type SaveSetResult,
  type SessionExerciseView,
  type SetRow,
  type WorkoutData,
} from "@/features/workout/actions";
import { formatClock, useNow } from "@/lib/clock";
import {
  matchEntryToRow,
  nextStamp,
  outboxKey,
  readOutbox,
  removeEntryIfStamp,
  upsertEntry,
  writeOutbox,
  type OutboxEntry,
} from "@/features/workout/outbox";
import { SET_TYPE_INFO, isWarmup, setLabels, toSetType, workingIndex, type SetType } from "@/features/workout/set-types";
import { groupBySuperset, memberTag, nextUp, roundOf } from "@/features/workout/supersets";
import { overloadHint, type OverloadHint } from "@/features/workout/overload";
import { SET_TYPES } from "@/features/workout/schemas";
import { RenameSession } from "@/features/workout/components/rename-session";
import { reconcile, shouldAdopt } from "@/features/workout/sync";
import { useSessionRealtime, type SetChange } from "@/features/workout/use-session-realtime";
import { toCanonicalKg, toPreferredWeight } from "@/lib/units";
import { randomUUID } from "@/lib/uuid";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  /** Whose set this is (me or my buddy). Either of us may edit either lane. */
  owner: string;
  order: number;
  weight: string;
  reps: string;
  completed: boolean;
  set_type: SetType;
  /** Has been written to the server at least once. */
  saved: boolean;
  error: string | null;
  /** Name of someone other than the owner who last edited this set, if any. */
  editedBy: string | null;
  /** Couldn't reach the server; the latest values are kept on this device and will sync. */
  queued: boolean;
};

type ExerciseState = Omit<SessionExerciseView, "sets"> & { rows: Row[]; partnerRows: Row[] };
type Lane = "me" | "partner";
type SetTarget = Lane | "both";

/** Wall-clock time for event handlers (kept outside the component body so render stays pure). */
const nowMs = () => Date.now();

/** localStorage can be missing or throw (private mode, blocked site data). */
function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** "12 Sep", with the year added when it isn't this year. */
function formatLastDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

function emptyRow(owner: string, order: number): Row {
  return { id: randomUUID(), owner, order, set_type: "normal", weight: "", reps: "", completed: false, saved: false, error: null, editedBy: null, queued: false };
}

function rowFromSet(set: SetRow, unit: "kg" | "lb", me: string, nameOf: (id: string) => string): Row {
  return {
    id: set.id,
    owner: set.user_id,
    order: set.set_order,
    set_type: toSetType(set.set_type),
    weight: set.weight_kg > 0 ? fmt(toPreferredWeight(set.weight_kg, unit)) : "",
    reps: set.reps > 0 ? String(set.reps) : "",
    completed: set.completed,
    saved: true,
    error: null,
    editedBy:
      set.last_edited_by && set.last_edited_by !== set.user_id ? (set.last_edited_by === me ? "you" : nameOf(set.last_edited_by)) : null,
    queued: false,
  };
}

function padLane(rows: Row[], owner: string, count: number): Row[] {
  const out = [...rows];
  let order = out.length > 0 ? Math.max(...out.map((r) => r.order)) : 0;
  while (out.length < count) {
    order += 1;
    out.push(emptyRow(owner, order));
  }
  return out;
}

function parseWeight(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function parseReps(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function SetRowView({
  row,
  label,
  setType,
  onPickType,
  number,
  tone,
  unit,
  placeholder,
  isNext,
  who,
  onField,
  onBlur,
  onToggle,
}: {
  row: Row;
  /** What the set badge shows. */
  label: string;
  setType: SetType;
  onPickType: () => void;
  /** The set's number, for assistive tech and tests. */
  number: number;
  tone: Lane;
  unit: "kg" | "lb";
  placeholder: { weight: string; reps: string };
  isNext: boolean;
  who: string;
  onField: (field: "weight" | "reps", value: string) => void;
  onBlur: () => void;
  onToggle: () => void;
}) {
  const partner = tone === "partner";
  // Accent per person: your theme accent, or the sky blue used for your buddy.
  const accent = partner
    ? { text: "text-sky-300", border: "border-[#a8cbff]", fill: "border-[#a8cbff] bg-[#a8cbff] text-[#1e1e22]", ring: "focus-visible:ring-[#a8cbff]" }
    : { text: "text-emerald-400", border: "border-emerald-500", fill: "border-emerald-500 bg-emerald-500 text-accent-ink", ring: "focus-visible:ring-emerald-400" };

  return (
    <div>
      <div className="grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-2">
        <button
          type="button"
          onClick={onPickType}
          aria-label={`${who} set ${number}, ${SET_TYPE_INFO[setType].name}. Change set type`}
          className={cn(
            "h-[46px] text-center font-display text-lg font-bold",
            setType !== "normal" ? SET_TYPE_INFO[setType].text : isNext ? accent.text : "text-zinc-400"
          )}
        >
          {label}
        </button>
        {(["weight", "reps"] as const).map((field) => (
          <input
            key={field}
            inputMode={field === "weight" ? "decimal" : "numeric"}
            aria-label={`${who} set ${number} ${field === "weight" ? `weight (${unit})` : "reps"}`}
            value={row[field]}
            placeholder={field === "weight" ? placeholder.weight : placeholder.reps}
            onChange={(e) => onField(field, e.target.value)}
            onKeyDown={(e) => {
              // Desktop shortcut: Space in an empty field accepts the grey "last time" value. Never types a space.
              if (e.key !== " ") return;
              e.preventDefault();
              const ph = field === "weight" ? placeholder.weight : placeholder.reps;
              if (row[field] === "" && ph) onField(field, ph);
            }}
            onBlur={onBlur}
            className={cn(
              "h-[46px] w-full min-w-0 rounded-xl border text-center font-display text-2xl font-bold tabular-nums placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2",
              accent.ring,
              row.completed
                ? "border-zinc-800/60 bg-zinc-900 text-zinc-400"
                : isNext
                  ? cn("bg-zinc-950 text-zinc-50", accent.border)
                  : "border-zinc-800 bg-zinc-950 text-zinc-50"
            )}
          />
        ))}
        <button
          type="button"
          onClick={onToggle}
          aria-label={row.completed ? `${who} set ${number} logged, tap to undo` : `Log ${who} set ${number}`}
          aria-pressed={row.completed}
          className={cn(
            "flex h-[46px] w-12 items-center justify-center rounded-xl border transition-transform active:scale-95",
            row.completed
              ? accent.fill
              : isNext
                ? cn("bg-zinc-950", accent.border, accent.text)
                : "border-zinc-800 bg-zinc-950 text-zinc-600"
          )}
        >
          <Check className="h-5 w-5 stroke-[3]" />
        </button>
      </div>
      {row.error && <p role="alert" className="mt-1 pl-[42px] text-xs text-red-400">{row.error}</p>}
      {row.queued && !row.error && (
        <p className="mt-0.5 pl-[42px] text-[11px] text-amber-400">Saved on this device · will sync when you&rsquo;re back online</p>
      )}
      {row.editedBy && !row.error && !row.queued && <p className="mt-0.5 pl-[42px] text-[11px] text-zinc-500">edited by {row.editedBy}</p>}
    </div>
  );
}

function repRange(ex: { rep_min: number | null; rep_max: number | null }): string {
  if (ex.rep_min == null) return "";
  return ex.rep_max && ex.rep_max !== ex.rep_min ? `${ex.rep_min}–${ex.rep_max}` : String(ex.rep_min);
}

/** One exercise as a card that opens and closes. Closed it is a one-line summary; open it holds the set rows. */
function ExerciseCard({
  ex,
  open,
  view,
  unit,
  unitLabel,
  hasBuddy,
  partnerName,
  partnerFirst,
  placeholderFor,
  onToggle,
  onMenu,
  onField,
  onBlurRow,
  onToggleRow,
  onOpenBuddy,
  onAddSet,
  onPickType,
  hint,
  tag,
  locked,
}: {
  ex: ExerciseState;
  open: boolean;
  view: "all" | "me" | "sam";
  unit: "kg" | "lb";
  unitLabel: string;
  hasBuddy: boolean;
  partnerName: string;
  partnerFirst: string;
  placeholderFor: (lane: Lane, index: number) => { weight: string; reps: string };
  onToggle: () => void;
  onMenu: () => void;
  onField: (rowId: string, field: "weight" | "reps", value: string) => void;
  onBlurRow: (row: Row) => void;
  onToggleRow: (lane: Lane, index: number) => void;
  onOpenBuddy: () => void;
  onAddSet: () => void;
  onPickType: (row: Row) => void;
  hint: OverloadHint | null;
  /** "A1", "A2": set when the exercise is in a superset. */
  tag?: string;
  /** Superset members stay open so you can alternate between them. */
  locked?: boolean;
}) {
  const myWork = ex.rows.filter((r) => !isWarmup(r.set_type));
  const theirWork = ex.partnerRows.filter((r) => !isWarmup(r.set_type));
  const mineDone = myWork.filter((r) => r.completed).length;
  const theirDone = theirWork.filter((r) => r.completed);
  const reps = repRange(ex);
  const allDone = myWork.length > 0 && mineDone === myWork.length;

  if (!open) {
    const parts = [
      `${ex.target_sets} sets`,
      reps ? `${reps} reps` : "",
      `you ${mineDone}/${myWork.length}`,
      hasBuddy ? `${partnerFirst} ${theirDone.length}/${theirWork.length}` : "",
    ].filter(Boolean);
    return (
      <section aria-label={ex.name}>
        <button
          type="button"
          aria-expanded={false}
          onClick={onToggle}
          className="flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5 text-left transition-colors hover:bg-zinc-800/60"
        >
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-display text-xl font-bold uppercase leading-tight tracking-wide", allDone && "text-emerald-400")}>{ex.name}</p>
            <p className={cn("truncate text-[13px]", allDone ? "text-emerald-300" : "text-zinc-400")}>{parts.join(" · ")}</p>
          </div>
          {allDone ? (
            <span role="img" aria-label="All sets done" className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
              <Check aria-hidden className="h-4 w-4 stroke-[3.5]" />
            </span>
          ) : (
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
          )}
        </button>
      </section>
    );
  }

  const lane = view === "sam" ? ex.partnerRows : ex.rows;
  const laneTone: Lane = view === "sam" ? "partner" : "me";
  const laneWho = view === "sam" ? `${partnerName}'s` : "Your";
  const laneLabels = setLabels(lane.map((r) => r.set_type));
  const pill = view === "sam" ? `${theirDone.length} / ${theirWork.length} sets` : `${mineDone} / ${myWork.length} sets`;

  return (
    <section aria-label={ex.name} className="rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <button type="button" aria-expanded disabled={locked} onClick={onToggle} className="min-w-0 flex-1 py-1 text-left">
          <span className={cn("block break-words font-display text-xl font-bold uppercase leading-[1.1] tracking-normal", allDone && "text-emerald-400")}>
            {allDone && <Check aria-label="All sets done" className="mr-1.5 inline h-5 w-5 stroke-[3.5] align-[-3px]" />}
            {tag && <span className="mr-1.5 text-emerald-400">{tag}</span>}
            {ex.name}
          </span>
          {ex.last.length > 0 ? (
            <span className="block text-xs text-zinc-400" suppressHydrationWarning>
              {ex.lastDate ? `${formatLastDate(ex.lastDate)}: ` : "Last time: "}{ex.last.map((l) => `${fmt(toPreferredWeight(l.weight_kg, unit))}×${l.reps}`).join(", ")} {unit}
            </span>
          ) : (
            reps && <span className="block text-xs text-zinc-400">Target: {ex.target_sets} × {reps}</span>
          )}
        </button>
        {/* right to left: collapse, options, sets pill */}
        <div className="flex shrink-0 items-center gap-0.5">
          <span
            className={cn(
              "mr-1 rounded-full border bg-zinc-950 px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider",
              view === "sam" ? "border-[#a8cbff] text-sky-300" : "border-emerald-500 text-emerald-400"
            )}
          >
            {pill}
          </span>
          <Button variant="ghost" size="icon" aria-label={`Options for ${ex.name}`} onClick={onMenu}>
            <MoreHorizontal className="h-5 w-5 text-zinc-400" />
          </Button>
          {!locked && (
            <Button variant="ghost" size="icon" aria-label={`Collapse ${ex.name}`} aria-expanded onClick={onToggle}>
              <ChevronUp className="h-5 w-5 text-zinc-400" />
            </Button>
          )}
        </div>
      </div>

        <>
          {hint && view !== "sam" && mineDone < myWork.length && (
            <p role="status" className="mb-2.5 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-[13px] text-zinc-100">
              <TrendingUp aria-hidden className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="min-w-0 flex-1">
                Try <b className="font-bold text-emerald-400">{fmt(hint.weight)} {unit} × {hint.reps}</b>
              </span>
              <span className="shrink-0 text-[11px] text-zinc-400">{hint.reason}</span>
            </p>
          )}
          <div className="mb-1 grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_48px] gap-2 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            <span>Set</span>
            <span>{unitLabel}</span>
            <span>Reps</span>
            <span />
          </div>
          <ol className="space-y-1.5">
            {lane.map((row, i) => (
              <li key={row.id} data-set={`${ex.id}:${i}`}>
                <SetRowView
                  row={row}
                  label={laneLabels[i]}
                  setType={row.set_type}
                  onPickType={() => onPickType(row)}
                  number={i + 1}
                  tone={laneTone}
                  unit={unit}
                  who={laneWho}
                  placeholder={placeholderFor(laneTone, i)}
                  isNext={!row.completed && lane.slice(0, i).every((r) => r.completed)}
                  onField={(field, value) => onField(row.id, field, value)}
                  onBlur={() => onBlurRow(row)}
                  onToggle={() => onToggleRow(laneTone, i)}
                />
              </li>
            ))}
          </ol>

          {/* All view: your buddy's progress in one line; tap to open and correct their sets */}
          {view === "all" && hasBuddy && (
            <button
              type="button"
              onClick={onOpenBuddy}
              aria-label={`Open ${partnerName}'s sets`}
              className="mt-2.5 flex min-h-[44px] w-full items-center gap-2 border-t border-dashed border-zinc-800 pt-2.5 text-left text-[13px] text-zinc-400"
            >
              <span className="font-display text-sm font-bold uppercase tracking-wider text-sky-300">{partnerFirst}</span>
              <span className="min-w-0 flex-1 truncate tabular-nums">
                {theirDone.length > 0 ? theirDone.map((r) => `${r.weight}×${r.reps}`).join(" · ") : "No sets yet"}
              </span>
              <span className="shrink-0 font-semibold text-sky-300">
                {theirDone.length} / {theirWork.length}
              </span>
            </button>
          )}
          {view === "sam" && (
            <p className="mt-2 text-xs text-zinc-500">Correcting {partnerName}&rsquo;s sets. Edits are marked &ldquo;edited by you&rdquo;.</p>
          )}

          <Button variant="outline" className="mt-2.5 h-11 w-full border-dashed text-zinc-400" onClick={onAddSet}>
            <Plus className="h-4 w-4" /> Add set
          </Button>
        </>
    </section>
  );
}

/** First exercise that still has sets to log (the one to start open); falls back to the first. */
function firstOpenId(list: SessionExerciseView[]): string | null {
  const next = list.find((e) => e.sets.filter((s) => s.completed && s.set_type !== "warmup").length < e.target_sets) ?? list[0];
  return next?.id ?? null;
}

export function ActiveWorkout({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { unit, session, userId } = data;

  const [roster, setRoster] = React.useState<RosterEntry[]>(data.roster);
  const [sessionState, setSessionState] = React.useState({ status: session.status, endedAt: session.endedAt });
  const myDoneAt = roster.find((r) => r.isMe)?.completedAt ?? null;
  const live = sessionState.status === "in_progress" && !myDoneAt;

  const me = roster.find((r) => r.isMe);
  const myName = me?.name ?? "You";
  const partner = roster.find((r) => !r.isMe && (r.status === "joined" || r.status === "left")) ?? null;
  const invited = roster.find((r) => !r.isMe && r.status === "invited") ?? null;
  const nameOf = React.useCallback(
    (id: string) => roster.find((r) => r.userId === id)?.name ?? data.buddy?.displayName ?? "Buddy",
    [roster, data.buddy]
  );

  const [exercises, setExercises] = React.useState<ExerciseState[]>(() => {
    const names = (id: string) => data.roster.find((r) => r.userId === id)?.name ?? "Buddy";
    return data.exercises.map((e) => {
      const { sets, ...rest } = e;
      const rows = padLane(
        sets.map((s) => rowFromSet(s, unit, userId, names)),
        userId,
        e.target_sets
      );
      const theirs = data.partnerSets.filter((s) => s.exercise_id === e.exercise_id).map((s) => rowFromSet(s, unit, userId, names));
      return { ...rest, rows, partnerRows: theirs };
    });
  });
  const exercisesRef = React.useRef(exercises);
  React.useEffect(() => {
    exercisesRef.current = exercises;
  });

  // Which exercise cards are open. The first with sets left to log starts open; any card can be opened or closed.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const id = firstOpenId(data.exercises);
    return new Set(id ? [id] : []);
  });
  /** The exercise you last opened or logged on; shared with your buddy as presence. */
  const [focusId, setFocusId] = React.useState<string | null>(() => firstOpenId(data.exercises));
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "me" | "sam">("all");
  const [addOpen, setAddOpen] = React.useState(false);
  /** Exercise being replaced while the picker is open (null = the picker adds). */
  const [swapId, setSwapId] = React.useState<string | null>(null);
  /** The picker row being added (or swapped in) right now: shown as busy until the server answers. */
  const [working, setWorking] = React.useState<{ id: string; kind: "add" | "swap" } | null>(null);
  /** Exercise (session-exercise id) being linked into a superset, and the partner picked so far. */
  const [linkFor, setLinkFor] = React.useState<string | null>(null);
  const [linkPick, setLinkPick] = React.useState<string | null>(null);
  const [linkQuery, setLinkQuery] = React.useState("");
  /** The superset whose options sheet is open (its group id). */
  const [groupMenu, setGroupMenu] = React.useState<string | null>(null);
  /** The set whose type is being chosen. */
  const [typePick, setTypePick] = React.useState<{ exId: string; rowId: string } | null>(null);
  /** Pending destructive change on an exercise that has logged sets; newId set = swap, else remove. */
  const [offers, setOffers] = React.useState<Array<{ exercise_id: string; name: string; byName: string; replaces?: string }>>([]);
  /** Buddy exercises already seen (or on my list at load): only genuinely new ones are offered. */
  const seenOffers = React.useRef<Set<string> | null>(null);
  const prevTheirIds = React.useRef<string[]>([]);
  const [routineOffer, setRoutineOffer] = React.useState<string | null>(null);
  const [setChange, setSetChange] = React.useState<{ ex: ExerciseState; kind: "add" | "remove" } | null>(null);
  const [pendingChange, setPendingChange] = React.useState<{ ex: ExerciseState; newId?: string } | null>(null);
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [banner, setBanner] = React.useState<string | null>(null);
  const [busy, startRawTransition] = React.useTransition();
  /** Set once Finish / Discard succeeds: its sheet stays busy until the page is gone, so nothing flashes behind it. */
  const [leaving, setLeaving] = React.useState<"finish" | "discard" | null>(null);
  // Next keeps this page alive (hidden) after leaving; reset so Back never shows a stale, busy sheet.
  React.useLayoutEffect(
    () => () => {
      setLeaving(null);
      setFinishOpen(false);
      setDiscardOpen(false);
    },
    []
  );
  /** Like startTransition, but a failed request (expired session, dropped connection) shows a banner instead of crashing the page. */
  function startTransition(fn: () => Promise<void>) {
    startRawTransition(async () => {
      try {
        await fn();
      } catch {
        setBanner("Couldn't reach the server. Pull down to refresh, or reload if it keeps happening.");
      }
    });
  }
  const [queuedCount, setQueuedCount] = React.useState(0);

  // Per-set write queue, in-flight set ids and latest known revisions: rapid taps never race or go stale.
  const queues = React.useRef(new Map<string, Promise<unknown>>());
  const pending = React.useRef(new Set<string>());
  const revisions = React.useRef(
    new Map<string, number | null>(
      [...data.exercises.flatMap((e) => e.sets), ...data.partnerSets].map((s) => [s.id, s.revision_number] as const)
    )
  );

  const now = useNow(live, 1000);
  const endAt = myDoneAt ?? sessionState.endedAt;
  const endMs = endAt ? Date.parse(endAt) : now;
  const elapsed = Math.max(0, (endMs - Date.parse(session.startedAt)) / 1000);

  const menuEx = exercises.find((e) => e.id === menuId);
  const swapEx = exercises.find((e) => e.id === swapId);

  // ---- row helpers ---------------------------------------------------------------------------
  function patchRow(exId: string, rowId: string, change: Partial<Row>) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exId
          ? {
              ...e,
              rows: e.rows.map((r) => (r.id === rowId ? { ...r, ...change } : r)),
              partnerRows: e.partnerRows.map((r) => (r.id === rowId ? { ...r, ...change } : r)),
            }
          : e
      )
    );
  }

  /** Today's suggestion for an exercise, from last time's working sets and its rep range. */
  function hintFor(e: ExerciseState): OverloadHint | null {
    return overloadHint({
      last: e.last,
      repMin: e.rep_min,
      repMax: e.rep_max,
      equipment: data.catalog.find((c) => c.id === e.exercise_id)?.primary_equipment ?? null,
      unit,
    });
  }

  function placeholderFor(e: ExerciseState, lane: Lane, index: number): { weight: string; reps: string } {
    const lanes = lane === "me" ? e.rows : e.partnerRows;
    const types = lanes.map((r) => r.set_type);
    const warm = isWarmup(types[index] ?? "normal");
    if (lane === "me" && !warm) {
      // The suggestion is today's plan for every working set; without one, fall back to last time.
      const hint = hintFor(e);
      if (hint) return { weight: fmt(hint.weight), reps: String(hint.reps) };
      // "Last time" holds working sets only, so line it up by working-set position (warm-ups don't shift it).
      const l = e.last[workingIndex(types, index)] ?? e.last[e.last.length - 1];
      if (l) return { weight: l.weight_kg > 0 ? fmt(toPreferredWeight(l.weight_kg, unit)) : "", reps: l.reps > 0 ? String(l.reps) : "" };
    }
    // A warm-up follows the row above it; a working set follows the last working set, never a warm-up.
    const prev = warm ? lanes[index - 1] : lanes.slice(0, index).reverse().find((r) => !isWarmup(r.set_type));
    return { weight: prev?.weight ?? "", reps: prev?.reps ?? "" };
  }

  // ---- writes ---------------------------------------------------------------------------------
  // ---- outbox (write-ahead log) ------------------------------------------------------------------
  // Every set write is recorded here BEFORE it is sent and removed when the server answers. If the app is
  // closed mid-request, or the connection drops, the write is still on the device and is replayed later.
  const storageKey = outboxKey(userId, session.id);
  const stamp = React.useRef(0);
  const readQueue = () => readOutbox(safeStorage(), storageKey, nowMs());
  /** Banner count: entries waiting on a retry, not ones whose request is simply still in flight. */
  const refreshQueuedCount = () => setQueuedCount(readQueue().filter((e) => !pending.current.has(e.id)).length);
  const writeQueue = (list: OutboxEntry[]) => {
    writeOutbox(safeStorage(), storageKey, list);
    refreshQueuedCount();
  };
  const enqueue = (entry: OutboxEntry) => writeQueue(upsertEntry(readQueue(), entry));
  const dequeueSent = (id: string, sentStamp: number) => writeQueue(removeEntryIfStamp(readQueue(), id, sentStamp));

  /** Apply the server's answer for one set (revision, or the winning values on a conflict). */
  function applySaveResult(exId: string, row: Row, res: SaveSetResult) {
    if (res.data) {
      revisions.current.set(row.id, res.data.revision_number);
      if (res.conflict) {
        patchRow(exId, row.id, { ...rowFromSet(res.data, unit, userId, nameOf), error: res.error ?? null });
      } else {
        patchRow(exId, row.id, { saved: true, queued: false, error: null });
      }
    } else {
      patchRow(exId, row.id, { error: res.error ?? "Couldn't save", queued: false, completed: row.saved ? row.completed : false });
    }
  }

  /**
   * Queue a write for one set. Writes per set are serialized; if the server can't be reached the latest
   * values are kept in the outbox and replayed later instead of failing the tap.
   */
  function persist(e: ExerciseState, row: Row, values: { weight: number; reps: number; completed: boolean }) {
    const payload = {
      id: row.id,
      session_id: session.id,
      exercise_id: e.exercise_id,
      user_id: row.owner,
      set_order: row.order,
      set_type: row.set_type,
      weight_kg: toCanonicalKg(values.weight, unit),
      reps: values.reps,
      completed: values.completed,
    };
    const entry: OutboxEntry = { ...payload, queued_at: (stamp.current = nextStamp(stamp.current, nowMs())) };
    enqueue(entry); // write-ahead: survives the tab closing while the request is in flight
    const run = async () => {
      let res: SaveSetResult;
      try {
        res = await saveSetAction({ ...payload, expected_revision: revisions.current.get(row.id) ?? null });
      } catch {
        // No answer (offline, or the request was cut off): the entry stays queued and is replayed later.
        patchRow(e.id, row.id, { queued: true, error: null });
        return;
      }
      dequeueSent(row.id, entry.queued_at);
      applySaveResult(e.id, row, res);
    };
    const prior = queues.current.get(row.id) ?? Promise.resolve();
    pending.current.add(row.id);
    const p: Promise<unknown> = prior.then(run, run).finally(() => {
      if (queues.current.get(row.id) === p) {
        pending.current.delete(row.id);
        refreshQueuedCount();
      }
    });
    queues.current.set(row.id, p);
  }

  /** Replay one queued write through the same per-set queue. Resolves false while still offline. */
  function sendQueued(entry: OutboxEntry): Promise<boolean> {
    const { queued_at: sentStamp, ...payload } = entry;
    const exId = exercisesRef.current.find((x) => x.exercise_id === entry.exercise_id)?.id;
    const run = async (): Promise<boolean> => {
      // The request that originally sent this may have finished (or been superseded) while we waited our turn.
      if (!readQueue().some((e) => e.id === entry.id && e.queued_at === sentStamp)) return true;
      let res: SaveSetResult;
      try {
        res = await saveSetAction({ ...payload, expected_revision: revisions.current.get(entry.id) ?? null });
      } catch {
        return false;
      }
      dequeueSent(entry.id, sentStamp);
      if (exId) {
        const ex = exercisesRef.current.find((x) => x.id === exId);
        const row = [...(ex?.rows ?? []), ...(ex?.partnerRows ?? [])].find((r) => r.id === entry.id);
        if (row) applySaveResult(exId, row, res);
      }
      return true;
    };
    const prior = queues.current.get(entry.id) ?? Promise.resolve();
    pending.current.add(entry.id);
    const p: Promise<boolean> = prior.then(run, run);
    const settled = p.finally(() => {
      if (queues.current.get(entry.id) === settled) {
        pending.current.delete(entry.id);
        refreshQueuedCount();
      }
    });
    queues.current.set(entry.id, settled);
    return p;
  }

  const flushing = React.useRef(false);
  async function flushOutbox() {
    if (flushing.current) return; // a slow flush is still running; don't send the same set twice
    flushing.current = true;
    try {
      for (const entry of readQueue()) {
        if (pending.current.has(entry.id)) continue; // its own request is still in flight
        if (!(await sendQueued(entry))) break; // still offline: try again later
      }
    } finally {
      flushing.current = false;
    }
  }

  /** After a reload: show what is still waiting to sync, on top of the server's data. */
  function overlayOutbox() {
    const entries = readQueue();
    setQueuedCount(entries.length);
    if (entries.length === 0) return;
    const partnerId = data.roster.find((r) => !r.isMe && (r.status === "joined" || r.status === "left"))?.userId ?? null;
    setExercises((prev) =>
      prev.map((e) => {
        const mine = entries.filter((x) => x.exercise_id === e.exercise_id);
        if (mine.length === 0) return e;
        const apply = (rows: Row[], owner: string) => {
          const out = [...rows];
          for (const x of mine.filter((m) => m.user_id === owner)) {
            const patch = {
              set_type: x.set_type,
              weight: x.weight_kg > 0 ? fmt(toPreferredWeight(x.weight_kg, unit)) : "",
              reps: x.reps > 0 ? String(x.reps) : "",
              completed: x.completed,
              queued: true,
              error: null,
            };
            const i = matchEntryToRow(out, x);
            if (i >= 0) out[i] = { ...out[i], id: x.id, ...patch };
            else out.push({ ...emptyRow(owner, x.set_order), id: x.id, ...patch });
          }
          return out.sort((a, b) => a.order - b.order);
        };
        return {
          ...e,
          rows: apply(e.rows, userId),
          partnerRows: partnerId ? apply(e.partnerRows, partnerId) : e.partnerRows,
        };
      })
    );
  }

  const outboxRef = React.useRef({ overlayOutbox, flushOutbox });
  React.useEffect(() => {
    outboxRef.current = { overlayOutbox, flushOutbox };
  });
  React.useEffect(() => {
    void (async () => {
      await Promise.resolve(); // not synchronously inside the effect
      outboxRef.current.overlayOutbox();
      await outboxRef.current.flushOutbox();
    })();
    const retry = () => void outboxRef.current.flushOutbox();
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(retry, 15000);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);

  function toggleOpen(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setFocusId(id);
  }

  function toggleComplete(e: ExerciseState, lane: Lane, index: number) {
    setFocusId(e.id);
    const rows = lane === "me" ? e.rows : e.partnerRows;
    const row = rows[index];
    if (row.completed) {
      patchRow(e.id, row.id, { completed: false, error: null });
      persist(e, row, { weight: parseWeight(row.weight) ?? 0, reps: parseReps(row.reps) ?? 0, completed: false });
      return;
    }
    // A confirm tap accepts the grey placeholder values when nothing was typed.
    const ph = placeholderFor(e, lane, index);
    const weight = parseWeight(row.weight || ph.weight);
    const reps = parseReps(row.reps || ph.reps);
    if (weight === null || reps === null || reps === 0) {
      patchRow(e.id, row.id, { error: "Enter weight and reps" });
      return;
    }
    const filled = { ...row, weight: row.weight || ph.weight, reps: row.reps || ph.reps, completed: true, error: null };
    patchRow(e.id, row.id, filled);
    persist(e, filled, { weight, reps, completed: true });
    // In a superset, bring the other exercise's next set into view.
    const other = e.superset_group ? exercisesRef.current.find((x) => x.superset_group === e.superset_group && x.id !== e.id) : null;
    const nextAt = other ? other.rows.findIndex((r) => !r.completed && !isWarmup(r.set_type)) : -1;
    if (other && nextAt >= 0) {
      window.setTimeout(() => document.querySelector(`[data-set="${other.id}:${nextAt}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    }
  }

  function setRowType(type: SetType) {
    const pick = typePick;
    setTypePick(null);
    const e = exercises.find((x) => x.id === pick?.exId);
    const row = [...(e?.rows ?? []), ...(e?.partnerRows ?? [])].find((r) => r.id === pick?.rowId);
    if (!e || !row || row.set_type === type) return;
    patchRow(e.id, row.id, { set_type: type });
    commitEdit(e, { ...row, set_type: type });
  }

  function commitEdit(e: ExerciseState, row: Row) {
    // Only already-logged sets are saved on edit; unlogged rows are saved when confirmed.
    if (!row.saved && !row.completed) return;
    const weight = parseWeight(row.weight);
    const reps = parseReps(row.reps);
    if (weight === null || reps === null) return;
    persist(e, row, { weight, reps, completed: row.completed });
  }

  /** Add/remove a set in my lane, my buddy's lane, or both. */
  function addSet(e: ExerciseState, who: SetTarget) {
    setExercises((prev) =>
      prev.map((x) => {
        if (x.id !== e.id) return x;
        const rows = who !== "partner" ? padLane(x.rows, userId, x.rows.length + 1) : x.rows;
        const partnerRows =
          who !== "me" && partner ? padLane(x.partnerRows, partner.userId, x.partnerRows.length + 1) : x.partnerRows;
        return { ...x, rows, partnerRows };
      })
    );
  }

  function removeLastSet(e: ExerciseState, who: SetTarget) {
    const dropMine = who !== "partner" && e.rows.length > 1 ? e.rows[e.rows.length - 1] : null;
    const dropTheirs = who !== "me" && e.partnerRows.length > 1 ? e.partnerRows[e.partnerRows.length - 1] : null;
    if (!dropMine && !dropTheirs) return;
    setExercises((prev) =>
      prev.map((x) =>
        x.id === e.id
          ? { ...x, rows: dropMine ? x.rows.slice(0, -1) : x.rows, partnerRows: dropTheirs ? x.partnerRows.slice(0, -1) : x.partnerRows }
          : x
      )
    );
    for (const r of [dropMine, dropTheirs]) {
      if (r?.saved) void deleteSetAction(r.id).then((res) => res.error && setBanner(res.error));
    }
    setMenuId(null);
  }

  /** On the All tab, ask whose list changes; on Mine / buddy tabs it is that person. */
  function requestSetChange(e: ExerciseState, kind: "add" | "remove") {
    if (view === "all" && partner) {
      setSetChange({ ex: e, kind });
      setMenuId(null);
      return;
    }
    const who: SetTarget = view === "sam" ? "partner" : "me";
    if (kind === "add") addSet(e, who);
    else removeLastSet(e, who);
  }

  /** Drop queued offline writes for an exercise so they can't re-create sets we just deleted. */
  function purgeOutbox(exerciseId: string) {
    writeQueue(readQueue().filter((q) => q.exercise_id !== exerciseId));
  }

  function removeExercise(e: ExerciseState) {
    startTransition(async () => {
      const res = await removeExerciseFromWorkoutAction(e.id);
      if (res.error) {
        setBanner(res.error);
        return;
      }
      purgeOutbox(e.exercise_id);
      setExercises((prev) => {
        const rest = prev.filter((x) => x.id !== e.id);
        // A superset left with one exercise is no longer one (the server did the same).
        const left = e.superset_group ? rest.filter((x) => x.superset_group === e.superset_group) : [];
        return left.length === 1 ? rest.map((x) => (x.id === left[0].id ? { ...x, superset_group: null } : x)) : rest;
      });
      setPendingChange(null);
      setMenuId(null);
    });
  }

  function swapExercise(e: ExerciseState, newExerciseId: string) {
    setWorking({ id: newExerciseId, kind: "swap" });
    startTransition(async () => {
      const res = await swapExerciseInWorkoutAction(e.id, newExerciseId);
      setWorking(null);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't swap that exercise");
        return;
      }
      purgeOutbox(e.exercise_id);
      const meta = data.catalog.find((c) => c.id === newExerciseId);
      const rows = padLane([], userId, e.target_sets);
      const swapped: ExerciseState = {
        ...e,
        exercise_id: newExerciseId,
        name: meta?.name ?? "Exercise",
        category: meta?.category ?? "other",
        rows,
        partnerRows: [],
        last: res.data.last,
        lastDate: res.data.lastDate,
      };
      setExercises((prev) => prev.map((x) => (x.id === e.id ? swapped : x)));
      setFocusId(e.id);
      setPendingChange(null);
      setSwapId(null);
      setAddOpen(false);
      setQuery("");
    });
  }

  function linkSuperset() {
    const from = exercises.find((x) => x.id === linkFor);
    if (!from || !linkPick) return;
    startTransition(async () => {
      const res = await linkSupersetAction(from.id, linkPick);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't link those exercises");
        return;
      }
      const { groups, added } = res.data;
      const meta = added ? data.catalog.find((c) => c.id === added.exercise_id) : null;
      setExercises((prev) => {
        const next = prev.map((x) => ({ ...x, superset_group: groups.find((g) => g.id === x.id)?.superset_group ?? x.superset_group }));
        if (!added || next.some((x) => x.id === added.id)) return next;
        const group = groups.find((g) => g.id === added.id)?.superset_group ?? null;
        return [
          ...next,
          {
            id: added.id,
            exercise_id: added.exercise_id,
            name: meta?.name ?? "Exercise",
            category: meta?.category ?? "other",
            position: added.position,
            target_sets: 3,
            rep_min: null,
            rep_max: null,
            rows: padLane([], userId, 3),
            partnerRows: [],
            last: added.last,
            lastDate: added.lastDate,
            superset_group: group,
          },
        ];
      });
      setLinkFor(null);
      setLinkPick(null);
      setLinkQuery("");
    });
  }

  function unlinkSuperset(group: string) {
    const member = exercises.find((x) => x.superset_group === group);
    if (!member) return;
    startTransition(async () => {
      const res = await unlinkSupersetAction(member.id);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't remove that superset");
        return;
      }
      setExercises((prev) => prev.map((x) => (x.superset_group === group ? { ...x, superset_group: null } : x)));
      setGroupMenu(null);
    });
  }

  /** Picker choice: add a new exercise, or swap the one being replaced (confirming first if it has logged sets). */
  function pickExercise(exerciseId: string) {
    const target = swapEx;
    if (!target) return addExercise(exerciseId);
    if (target.rows.some((r) => r.saved)) setPendingChange({ ex: target, newId: exerciseId });
    else swapExercise(target, exerciseId);
  }

  // Joined someone else's workout whose exercises match none of my routines: offer to keep it (once).
  React.useEffect(() => {
    if (session.isHost || session.status !== "in_progress") return;
    const key = `gb-routine-offer:${session.id}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* private mode: just ask */
    }
    let cancelled = false;
    void getRoutineOfferAction(session.id).then((res) => {
      if (!cancelled && res.data) setRoutineOffer(res.data.name);
    });
    return () => {
      cancelled = true;
    };
  }, [session.id, session.isHost, session.status]);

  function answerRoutineOffer(add: boolean) {
    setRoutineOffer(null);
    try {
      localStorage.setItem(`gb-routine-offer:${session.id}`, "1");
    } catch {
      /* ignore */
    }
    if (add) void addSessionRoutineAction(session.id).then((r) => r.error && setBanner(r.error));
  }

  function addExercise(exerciseId: string, fallbackName = "Exercise") {
    setWorking({ id: exerciseId, kind: "add" });
    startTransition(async () => {
      const res = await addExerciseToWorkoutAction(session.id, exerciseId);
      setWorking(null);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't add that exercise");
        return;
      }
      const meta = data.catalog.find((c) => c.id === exerciseId);
      const rows = padLane([], userId, 3);
      const added: ExerciseState = {
        id: res.data.id,
        exercise_id: exerciseId,
        name: meta?.name ?? fallbackName,
        category: meta?.category ?? "other",
        position: res.data.position,
        target_sets: 3,
        rep_min: null,
        rep_max: null,
        rows,
        partnerRows: [],
        last: res.data.last,
        lastDate: res.data.lastDate,
        superset_group: null,
      };
      setExercises((prev) => [...prev, added]);
      setExpanded((prev) => new Set(prev).add(added.id));
      setFocusId(added.id);
      setAddOpen(false);
      setQuery("");
    });
  }

  // ---- realtime: remote changes and resync ------------------------------------------------------
  function applyServerSet(set: SetRow) {
    if (pending.current.has(set.id)) return; // our own write is in flight; its response settles the row
    if (!shouldAdopt(revisions.current.get(set.id), set.revision_number)) return; // own echo or stale event
    revisions.current.set(set.id, set.revision_number);
    const isMine = set.user_id === userId;
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== set.exercise_id) return e;
        const key = isMine ? "rows" : "partnerRows";
        const lane = e[key];
        const row = rowFromSet(set, unit, userId, nameOf);
        const at = lane.findIndex((r) => r.id === set.id);
        let next: Row[];
        if (at >= 0) {
          next = lane.map((r) => (r.id === set.id ? row : r));
        } else {
          const blank = lane.findIndex((r) => !r.saved && r.order === set.set_order && r.weight === "" && r.reps === "");
          next = blank >= 0 ? lane.map((r, i) => (i === blank ? row : r)) : [...lane, row].sort((a, b) => a.order - b.order);
        }
        return { ...e, [key]: next };
      })
    );
  }

  function removeServerSet(id: string) {
    if (pending.current.has(id)) return;
    revisions.current.delete(id);
    setExercises((prev) =>
      prev.map((e) => ({ ...e, rows: e.rows.filter((r) => r.id !== id), partnerRows: e.partnerRows.filter((r) => r.id !== id) }))
    );
  }

  function onSetChange(change: SetChange) {
    if (change.kind === "delete") removeServerSet(change.id);
    else applyServerSet(change.set);
  }

  async function resync() {
    const res = await getSessionSyncAction(session.id);
    if (!res.data) return;
    const sync = res.data;
    setRoster(sync.roster);
    setSessionState({ status: sync.status, endedAt: sync.endedAt });

    // First snapshot is the baseline; after that, new buddy exercises I don't have become offers.
    const theirIds = sync.partnerExercises.map((x) => x.exercise_id);
    if (seenOffers.current === null) {
      seenOffers.current = new Set(theirIds);
    } else {
      const seen = seenOffers.current;
      const mine = new Set(exercisesRef.current.map((x) => x.exercise_id));
      const fresh = sync.partnerExercises.filter((x) => !seen.has(x.exercise_id) && !mine.has(x.exercise_id));
      for (const id of theirIds) seen.add(id);
      // An exercise that vanished from their list as another appeared is a swap: offer to swap mine too.
      const gone = prevTheirIds.current.filter((id) => !theirIds.includes(id) && mine.has(id));
      const offered = fresh.map((f, i) => ({ ...f, replaces: gone[i] }));
      if (offered.length > 0) setOffers((prev) => [...prev, ...offered.filter((f) => !prev.some((o) => o.exercise_id === f.exercise_id))]);
    }
    prevTheirIds.current = theirIds;

    const serverSets = [...sync.mySets, ...sync.partnerSets];
    const local = exercisesRef.current.flatMap((e) => [...e.rows, ...e.partnerRows]).map((r) => ({
      id: r.id,
      saved: r.saved,
      revision: revisions.current.get(r.id) ?? null,
    }));
    const diff = reconcile(local, serverSets, pending.current);
    const byId = new Map(serverSets.map((s) => [s.id, s]));
    for (const id of [...diff.add, ...diff.adopt]) {
      const s = byId.get(id);
      if (s) applyServerSet(s);
    }
    for (const id of diff.remove) removeServerSet(id);
  }

  // Pull-to-refresh: fetch the authoritative snapshot now instead of waiting for realtime.
  const resyncRef = React.useRef(resync);
  React.useEffect(() => {
    resyncRef.current = resync;
  });
  React.useEffect(() => {
    const onRefresh = () => void resyncRef.current().catch(() => setBanner("Couldn't refresh. Check your connection."));
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, []);

  const realtime = useSessionRealtime({
    sessionId: session.id,
    userId,
    name: myName,
    enabled: true,
    onSetChange,
    onRosterChange: () => void resync(),
    onResync: () => void resync(),
  });

  const currentExerciseId = exercises.find((e) => e.id === focusId)?.exercise_id ?? null;
  const { track } = realtime;
  React.useEffect(() => {
    track(currentExerciseId);
  }, [track, currentExerciseId]);

  const peer = realtime.peers[0] ?? null;

  // ---- session actions --------------------------------------------------------------------------
  function shareInvite() {
    const url = `${window.location.origin}/session/${session.id}`;
    const title = `${session.name} workout`;
    if (navigator.share) {
      navigator.share({ title, text: `Join my ${session.name} workout`, url }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(url).then(() => setBanner("Invite link copied"));
    }
  }

  function inviteBuddy() {
    startTransition(async () => {
      const res = await inviteBuddyAction(session.id);
      if (res.error) setBanner(res.error);
      else await resync();
    });
  }

  function finish(forBoth = false) {
    startTransition(async () => {
      const res = forBoth ? await finishWorkoutAction(session.id) : await finishMyWorkoutAction(session.id);
      if (res.error) {
        setBanner(res.error);
        setFinishOpen(false);
        return;
      }
      setLeaving("finish");
      router.push("/");
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      const res = await discardWorkoutAction(session.id);
      if (res.error) {
        setDiscardOpen(false);
        setBanner(res.error);
        return;
      }
      setLeaving("discard");
      router.push("/");
      router.refresh();
    });
  }

  const completedSets = exercises.reduce((n, e) => n + e.rows.filter((r) => r.completed && !isWarmup(r.set_type)).length, 0);
  const volumeKg = exercises.reduce(
    (sum, e) =>
      sum +
      e.rows.reduce((s, r) => {
        if (!r.completed || isWarmup(r.set_type)) return s;
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

  const progressOf = (e: ExerciseState) => {
    const work = e.rows.filter((r) => !isWarmup(r.set_type));
    return { id: e.id, done: work.filter((r) => r.completed).length, total: work.length };
  };
  const blocks = groupBySuperset(exercises);
  const renderCard = (e: ExerciseState, tag: string | undefined) => (
      <ExerciseCard
        key={e.id}
        ex={e}
        open={tag ? true : expanded.has(e.id)}
        view={view}
        unit={unit}
        unitLabel={unitLabel}
        hasBuddy={Boolean(partner)}
        partnerName={partnerName}
        partnerFirst={partnerFirst}
        placeholderFor={(lane, index) => placeholderFor(e, lane, index)}
        onToggle={() => toggleOpen(e.id)}
        onMenu={() => setMenuId(e.id)}
        onField={(rowId, field, value) => patchRow(e.id, rowId, { [field]: value, error: null })}
        onBlurRow={(row) => commitEdit(e, row)}
        onToggleRow={(lane, index) => toggleComplete(e, lane, index)}
        onOpenBuddy={() => setFilter("sam")}
        onAddSet={() => requestSetChange(e, "add")}
        onPickType={(row) => setTypePick({ exId: e.id, rowId: row.id })}
        hint={hintFor(e)}
        tag={tag}
        locked={Boolean(tag)}
      />
  );

  const unitLabel = unit.toUpperCase();
  const partnerName = partner?.name ?? "";
  const partnerFirst = partnerName.split(" ")[0] || partnerName;
  /** Which lane the card shows. Without a buddy in the workout there is only "all" (your own sets). */
  const view: "all" | "me" | "sam" = partner ? filter : "all";
  const segments: Array<{ id: "all" | "me" | "sam"; label: string; aria: string }> = [
    { id: "all", label: "All", aria: "Show all sets" },
    { id: "me", label: "Mine", aria: "Show my sets" },
    { id: "sam", label: partnerFirst, aria: `Show ${partnerName}'s sets` },
  ];
  const statusLine = !live
    ? sessionState.status === "completed" ? "Completed" : "Discarded"
    : !partner
      ? "Live"
      : realtime.status === "reconnecting"
        ? "Reconnecting…"
        : peer
          ? `Live · You + ${partnerFirst}`
          : `${partnerFirst} · not connected`;

  return (
    <div className="mx-auto w-full max-w-xl pb-28">
      {/* header: title, live status, clock; the All / Mine / Sam bar when training with someone */}
      <header className="mb-3.5 space-y-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Today"
            className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-zinc-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h1 className="truncate font-display text-[28px] font-extrabold uppercase leading-none tracking-wide">{session.name}</h1>
              {session.isFreestyle && <RenameSession sessionId={session.id} name={session.name} />}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                aria-hidden
                className={cn("h-[7px] w-[7px] shrink-0 rounded-full", live && (!partner || (realtime.status === "live" && peer)) ? "bg-emerald-500" : "bg-zinc-600")}
              />
              <span className="truncate">{statusLine}</span>
            </p>
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-emerald-400" suppressHydrationWarning>
            {formatClock(elapsed)}
          </div>
        </div>
        {partner && (
          <div role="group" aria-label="Show sets" className="grid grid-cols-3 rounded-xl bg-zinc-900 p-[3px]">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                aria-pressed={view === seg.id}
                aria-label={seg.aria}
                onClick={() => setFilter(seg.id)}
                className={cn(
                  "h-9 min-w-0 truncate rounded-[9px] px-2 font-display text-[15px] font-bold uppercase tracking-wider transition-colors",
                  view === seg.id
                    ? seg.id === "sam"
                      ? "bg-[#a8cbff] text-[#1e1e22]"
                      : "bg-emerald-500 text-accent-ink"
                    : "text-zinc-400 hover:text-zinc-50"
                )}
              >
                {seg.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* waiting for / inviting a buddy */}
      {live && !partner && (invited || (session.isHost && data.buddy)) && (
        <div role="status" className="mb-3 flex items-center gap-3 rounded-2xl bg-[#a8cbff]/15 px-3.5 py-2.5 text-sm text-zinc-100">
          {invited ? (
            <>
              <span className="min-w-0 flex-1 truncate">Waiting for {invited.name} to join</span>
              <Button size="sm" variant="secondary" onClick={shareInvite}>
                <Share2 className="h-4 w-4" /> Share link
              </Button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate">Train with {data.buddy?.displayName}?</span>
              <Button size="sm" variant="secondary" disabled={busy} onClick={inviteBuddy}>
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            </>
          )}
        </div>
      )}

      {offers[0] && (
        <div role="status" className="mb-3 flex items-center gap-3 rounded-2xl bg-[#a8cbff]/15 px-3.5 py-2.5 text-sm text-zinc-100">
          <span className="min-w-0 flex-1">
            {offers[0].byName.split(" ")[0]} {offers[0].replaces ? "swapped to" : "added"} {offers[0].name}. {offers[0].replaces ? "Swap yours too?" : "Add it to your workout?"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOffers((prev) => prev.slice(1))}>
            No thanks
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              const o = offers[0];
              const mineEx = o.replaces ? exercises.find((x) => x.exercise_id === o.replaces) : undefined;
              if (!mineEx) addExercise(o.exercise_id, o.name);
              else if (mineEx.rows.some((r) => r.saved)) setPendingChange({ ex: mineEx, newId: o.exercise_id });
              else swapExercise(mineEx, o.exercise_id);
              setOffers((prev) => prev.slice(1));
            }}
          >
            {offers[0].replaces ? "Swap" : "Add"}
          </Button>
        </div>
      )}

      {queuedCount > 0 && (
        <div role="status" className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-400/10 px-3.5 py-2.5 text-sm text-zinc-100">
          <span className="min-w-0 flex-1">
            {queuedCount} {queuedCount === 1 ? "set is" : "sets are"} waiting to sync. They&rsquo;re saved on this device.
          </span>
          <Button size="sm" variant="secondary" onClick={() => void flushOutbox()}>
            Retry
          </Button>
        </div>
      )}

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
          <div className="space-y-3">
            {blocks.map((b) =>
              b.group === null ? (
                renderCard(b.members[0], undefined)
              ) : (
                <div key={b.group} role="group" aria-label={`Superset ${b.letter}`} className="space-y-2 rounded-[22px] border border-emerald-500/60 p-2">
                  <div className="flex h-7 items-center gap-2 px-1.5">
                    <Link2 aria-hidden className="h-4 w-4 text-emerald-400" />
                    <span className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-emerald-400">Superset {b.letter}</span>
                    {view !== "sam" && (
                      <span className="ml-auto text-xs text-zinc-400">
                        Round {roundOf(b.members.map(progressOf)).round} of {roundOf(b.members.map(progressOf)).of}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Options for superset ${b.letter}`}
                      onClick={() => setGroupMenu(b.group)}
                      className={cn("flex h-8 w-8 items-center justify-center text-zinc-400", view === "sam" && "ml-auto")}
                    >
                      <MoreHorizontal className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                  {b.members.map((m, i) => renderCard(m, memberTag(b.letter ?? "A", i)))}
                  {live && view !== "sam" && (() => {
                    const up = nextUp(b.members.map(progressOf));
                    const who = up ? b.members.findIndex((m) => m.id === up.id) : -1;
                    if (!up || who < 0) return null;
                    return (
                      <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-[13px] text-zinc-100">
                        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span>
                          Up next: <b className="font-bold text-emerald-400">{memberTag(b.letter ?? "A", who)} {b.members[who].name}, set {up.set}</b>
                        </span>
                      </p>
                    );
                  })()}
                </div>
              )
            )}
            {working?.kind === "add" && <ExerciseSkeleton name={data.catalog.find((c) => c.id === working.id)?.name ?? "exercise"} />}
            <Button variant="outline" className="h-12 w-full border-dashed text-zinc-400" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          </div>
        </>
      )}

      {live && exercises.length > 0 && (
        <Button variant="outline" className="mt-4 h-12 w-full border-emerald-500/60 font-display text-lg uppercase tracking-wider text-emerald-400" onClick={() => setFinishOpen(true)}>
          Finish workout
        </Button>
      )}

      {/* set type */}
      <Sheet open={typePick !== null} onClose={() => setTypePick(null)} title="Set type">
        {(() => {
          const e = exercises.find((x) => x.id === typePick?.exId);
          const row = [...(e?.rows ?? []), ...(e?.partnerRows ?? [])].find((r) => r.id === typePick?.rowId);
          if (!e || !row) return null;
          const lane = e.rows.some((r) => r.id === row.id) ? e.rows : e.partnerRows;
          const label = setLabels(lane.map((r) => r.set_type))[lane.findIndex((r) => r.id === row.id)];
          return (
            <div className="space-y-2 pt-1">
              <p className="mb-1 text-[13px] text-zinc-400">{e.name}, set {label}</p>
              {SET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={row.set_type === t}
                  onClick={() => setRowType(t)}
                  className={cn(
                    "flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left",
                    row.set_type === t ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                  )}
                >
                  <span className={cn("w-[34px] shrink-0 text-center font-display text-[22px] font-bold", SET_TYPE_INFO[t].text || "text-zinc-400")}>
                    {t === "normal" ? "1" : SET_TYPE_INFO[t].letter}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{SET_TYPE_INFO[t].name}</span>
                    <span className="block text-xs text-zinc-400">{SET_TYPE_INFO[t].blurb}</span>
                  </span>
                  {row.set_type === t && <Check aria-hidden className="h-5 w-5 stroke-[3] text-emerald-400" />}
                </button>
              ))}
            </div>
          );
        })()}
      </Sheet>

      {/* exercise menu */}
      <Sheet open={menuId !== null} onClose={() => setMenuId(null)} title={menuEx?.name ?? "Exercise"}>
        {menuEx && (
          <div className="space-y-2 pt-2">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                setMenuId(null);
                setSwapId(menuEx.id);
                setAddOpen(true);
              }}
            >
              Swap exercise
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                setMenuId(null);
                setLinkQuery("");
                setLinkPick(null);
                setLinkFor(menuEx.id);
              }}
            >
              <Link2 className="h-4 w-4 text-emerald-400" /> Link as superset
            </Button>
            <Button variant="secondary" className="w-full justify-start" disabled={(view === "sam" ? menuEx.partnerRows : menuEx.rows).length <= 1} onClick={() => requestSetChange(menuEx, "remove")}>
              Remove last set
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start text-red-400"
              onClick={() => (menuEx.rows.some((r) => r.saved) ? setPendingChange({ ex: menuEx }) : removeExercise(menuEx))}
            >
              Remove exercise
            </Button>
          </div>
        )}
      </Sheet>

      {/* link as superset: any exercise from the catalog */}
      <Sheet
        open={linkFor !== null}
        onClose={() => setLinkFor(null)}
        title="Superset with"
        footer={
          <Button className="w-full" disabled={busy || !linkPick} onClick={linkSuperset}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Linking…" : "Link as superset"}
          </Button>
        }
      >
        {(() => {
          const from = exercises.find((x) => x.id === linkFor);
          if (!from) return null;
          const q = linkQuery.trim().toLowerCase();
          const options = data.catalog.filter((c) => c.id !== from.exercise_id && (q === "" || c.name.toLowerCase().includes(q)));
          const inWorkout = new Map(exercises.map((x) => [x.exercise_id, x]));
          return (
            <div className="space-y-3 pt-1">
              <p className="text-[13px] leading-snug text-zinc-400">
                Pick any exercise to pair with {from.name}. One not in this workout yet is added for you. An exercise is in one superset at a time, so picking one that is already paired moves it here.
              </p>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                <label htmlFor="link-search" className="sr-only">Search exercises</label>
                <Input id="link-search" value={linkQuery} onChange={(e) => setLinkQuery(e.target.value)} placeholder="Search exercises" className="pl-9" />
              </div>
              <ul className="space-y-1.5">
                {options.slice(0, 60).map((c) => {
                  const existing = inWorkout.get(c.id);
                  const note = !existing
                    ? "Will be added"
                    : existing.superset_group && existing.superset_group !== from.superset_group
                      ? "Already paired"
                      : "In workout";
                  const picked = linkPick === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        aria-pressed={picked}
                        onClick={() => setLinkPick(c.id)}
                        className={cn(
                          "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 text-left",
                          picked ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full", picked ? "bg-emerald-500 text-accent-ink" : "border-2 border-zinc-600")}
                        >
                          {picked && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{c.name}</span>
                          <span className="block text-xs capitalize text-zinc-400">{c.category.replace("_", " ")}{c.primary_equipment ? ` · ${c.primary_equipment}` : ""}</span>
                        </span>
                        <span className={cn("text-[11px] font-semibold", note === "Will be added" ? "text-emerald-400" : "text-zinc-400")}>{note}</span>
                      </button>
                    </li>
                  );
                })}
                {options.length === 0 && <li className="p-4 text-center text-sm text-zinc-400">No matching exercises.</li>}
              </ul>
            </div>
          );
        })()}
      </Sheet>

      {/* superset options: change the partner or remove it */}
      <Sheet open={groupMenu !== null} onClose={() => setGroupMenu(null)} title={`Superset ${blocks.find((b) => b.group === groupMenu)?.letter ?? ""}`}>
        {(() => {
          const block = blocks.find((b) => b.group === groupMenu);
          if (!block || block.members.length < 2) return null;
          const [first, second] = block.members;
          return (
            <div className="space-y-2 pt-1">
              <p className="mb-1 text-[13px] text-zinc-400">{first.name} and {second.name}</p>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  setGroupMenu(null);
                  setLinkQuery("");
                  setLinkPick(null);
                  setLinkFor(first.id);
                }}
              >
                Change {second.name} to another exercise
              </Button>
              <Button variant="secondary" className="w-full justify-start text-red-400" disabled={busy} onClick={() => block.group && unlinkSuperset(block.group)}>
                Remove superset
              </Button>
              <p className="text-xs leading-snug text-zinc-500">Removing keeps both exercises and all logged sets. They just stop alternating.</p>
            </div>
          );
        })()}
      </Sheet>

      {/* add exercise */}
      <Sheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setSwapId(null);
        }}
        title={swapEx ? `Swap ${swapEx.name}` : "Add exercise"}
      >
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
                  disabled={busy || working !== null}
                  aria-busy={working?.id === c.id}
                  onClick={() => pickExercise(c.id)}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-2.5 rounded-xl px-3 text-left transition-opacity",
                    working?.id === c.id ? "animate-pulse border border-emerald-500 bg-emerald-500/10" : "bg-zinc-900 hover:bg-zinc-800",
                    working && working.id !== c.id && "opacity-40"
                  )}
                >
                  {working?.id === c.id && <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin text-emerald-400" />}
                  <span className="flex-1 text-sm font-semibold">{c.name}</span>
                  <span className={cn("text-xs capitalize", working?.id === c.id ? "font-semibold text-emerald-400" : "text-zinc-400")}>
                    {working?.id === c.id ? (working.kind === "swap" ? "Swapping…" : "Adding…") : c.category.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
            {pickable.length === 0 && <li className="p-4 text-center text-sm text-zinc-400">No matching exercises.</li>}
          </ul>
        </div>
      </Sheet>

      <Sheet
        open={routineOffer !== null}
        onClose={() => answerRoutineOffer(false)}
        title="Add this routine?"
        footer={
          <div className="space-y-2">
            <Button className="w-full" onClick={() => answerRoutineOffer(true)}>Add to my routines</Button>
            <Button variant="ghost" className="w-full" onClick={() => answerRoutineOffer(false)}>Not now</Button>
          </div>
        }
      >
        <p className="pt-2 text-sm text-zinc-300">
          &ldquo;{routineOffer}&rdquo; has exercises that aren&rsquo;t in any of your routines. Save it so you can start it yourself later?
        </p>
      </Sheet>

      {/* All tab: whose list gets the extra / fewer set */}
      <Sheet
        open={setChange !== null}
        onClose={() => setSetChange(null)}
        title={setChange?.kind === "add" ? "Add a set for…" : "Remove the last set for…"}
        footer={
          setChange && (
            <div className="space-y-2">
              {(["me", "both"] as const).map((who) => (
                <Button
                  key={who}
                  variant={who === "both" ? "secondary" : "default"}
                  className="w-full"
                  onClick={() => {
                    if (setChange.kind === "add") addSet(setChange.ex, who);
                    else removeLastSet(setChange.ex, who);
                    setSetChange(null);
                  }}
                >
                  {who === "me" ? "Only me" : `Both of us (${partnerFirst})`}
                </Button>
              ))}
            </div>
          )
        }
      >
        {setChange && <p className="pt-2 text-sm text-zinc-300">{setChange.ex.name}</p>}
      </Sheet>

      {/* confirm removing/swapping an exercise that has logged sets */}
      <Sheet
        open={pendingChange !== null}
        onClose={() => setPendingChange(null)}
        title={pendingChange?.newId ? "Swap exercise?" : "Remove exercise?"}
        footer={
          pendingChange && (
            <Button
              variant="ghost"
              className="w-full text-red-400"
              disabled={busy}
              onClick={() => (pendingChange.newId ? swapExercise(pendingChange.ex, pendingChange.newId) : removeExercise(pendingChange.ex))}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {pendingChange.newId ? "Swap and delete sets" : "Delete exercise"}
            </Button>
          )
        }
      >
        {pendingChange && (
          <p className="pt-2 text-sm text-zinc-300">
            Delete {pendingChange.ex.name} and its {pendingChange.ex.rows.filter((r) => r.saved).length} logged sets? This can&rsquo;t be undone.
          </p>
        )}
      </Sheet>

      {/* finish */}
      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish your workout?"
        footer={
          <div className="space-y-2">
            <Button className="w-full" disabled={busy || leaving !== null} onClick={() => finish()}>
              {(busy || leaving) && <Loader2 className="h-4 w-4 animate-spin" />} {leaving === "finish" ? "Finishing…" : "Finish my workout"}
            </Button>
            {partner?.status === "joined" && !partner.completedAt && (
              <Button variant="secondary" className="w-full" disabled={busy || leaving !== null} onClick={() => finish(true)}>
                Finish for both of us
              </Button>
            )}
            {session.isHost && (
              <Button variant="ghost" className="w-full text-red-400" disabled={busy || leaving !== null} onClick={() => setDiscardOpen(true)}>
                Discard workout
              </Button>
            )}
          </div>
        }
      >
        {session.isFreestyle && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="truncate font-semibold">{session.name}</p>
            <RenameSession sessionId={session.id} name={session.name} />
          </div>
        )}
        <dl className="grid grid-cols-3 gap-2 pt-2 text-center">
          <div className="rounded-2xl bg-zinc-900 p-3">
            <dt className="text-[11px] font-semibold uppercase text-zinc-400">Time</dt>
            <dd className="font-display text-2xl font-extrabold tabular-nums" suppressHydrationWarning>{formatClock(elapsed)}</dd>
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
        {session.isHost && partner && (
          <p className="mt-3 text-sm text-zinc-400">This ends the workout for {partnerName} too. Their logged sets are kept.</p>
        )}
        {exercises.some((e) => e.rows.some((r) => !r.completed)) && (
          <p className="mt-3 text-sm text-amber-400">Some sets aren&rsquo;t logged yet. They won&rsquo;t be saved.</p>
        )}
      </Sheet>

      {/* discard: an in-app confirmation (the browser's confirm() is blocked in some contexts). Last in the page so it opens above the finish sheet. */}
      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard workout?"
        footer={
          <div className="space-y-2">
            <Button variant="ghost" className="w-full text-red-400" disabled={busy || leaving !== null} onClick={discard}>
              {(busy || leaving) && <Loader2 className="h-4 w-4 animate-spin" />} {busy || leaving ? "Discarding…" : "Discard workout"}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setDiscardOpen(false)}>
              Keep it
            </Button>
          </div>
        }
      >
        <p className="pt-2 text-sm text-zinc-300">Nothing from this workout will be kept. This can&rsquo;t be undone.</p>
      </Sheet>
    </div>
  );
}
