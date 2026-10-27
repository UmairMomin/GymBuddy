"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronUp, Loader2, MoreHorizontal, Plus, Search, Share2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  addExerciseToWorkoutAction,
  deleteSetAction,
  discardWorkoutAction,
  finishMyWorkoutAction,
  finishWorkoutAction,
  getSessionSyncAction,
  inviteBuddyAction,
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

function emptyRow(owner: string, order: number): Row {
  return { id: randomUUID(), owner, order, weight: "", reps: "", completed: false, saved: false, error: null, editedBy: null, queued: false };
}

function rowFromSet(set: SetRow, unit: "kg" | "lb", me: string, nameOf: (id: string) => string): Row {
  return {
    id: set.id,
    owner: set.user_id,
    order: set.set_order,
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
  number,
  tone,
  unit,
  placeholder,
  isNext,
  who,
  onField,
  onBlur,
  onToggle,
  readOnly,
}: {
  row: Row;
  /** What the set badge shows. */
  label: string;
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
  /** Your buddy's lane: shown, never edited from your screen. */
  readOnly: boolean;
}) {
  const partner = tone === "partner";
  // Accent per person: your theme accent, or the sky blue used for your buddy.
  const accent = partner
    ? { text: "text-sky-300", border: "border-[#a8cbff]", fill: "border-[#a8cbff] bg-[#a8cbff] text-[#1e1e22]", ring: "focus-visible:ring-[#a8cbff]" }
    : { text: "text-emerald-400", border: "border-emerald-500", fill: "border-emerald-500 bg-emerald-500 text-accent-ink", ring: "focus-visible:ring-emerald-400" };

  return (
    <div>
      <div className="grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-2">
        <span className={cn("text-center font-display text-lg font-bold", isNext ? accent.text : "text-zinc-400")}>{label}</span>
        {(["weight", "reps"] as const).map((field) => (
          <input
            key={field}
            inputMode={field === "weight" ? "decimal" : "numeric"}
            aria-label={`${who} set ${number} ${field === "weight" ? `weight (${unit})` : "reps"}`}
            value={row[field]}
            placeholder={field === "weight" ? placeholder.weight : placeholder.reps}
            readOnly={readOnly}
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
          disabled={readOnly}
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
}) {
  const mineDone = ex.rows.filter((r) => r.completed).length;
  const theirDone = ex.partnerRows.filter((r) => r.completed);
  const reps = repRange(ex);

  if (!open) {
    const parts = [
      `${ex.target_sets} sets`,
      reps ? `${reps} reps` : "",
      `you ${mineDone}/${ex.rows.length}`,
      hasBuddy ? `${partnerFirst} ${theirDone.length}/${ex.partnerRows.length}` : "",
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
            <p className="truncate font-display text-xl font-bold uppercase leading-tight tracking-wide">{ex.name}</p>
            <p className="truncate text-[13px] text-zinc-400">{parts.join(" · ")}</p>
          </div>
          <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
        </button>
      </section>
    );
  }

  const lane = view === "sam" ? ex.partnerRows : ex.rows;
  const laneTone: Lane = view === "sam" ? "partner" : "me";
  const laneWho = view === "sam" ? `${partnerName}'s` : "Your";
  const pill = view === "sam" ? `${theirDone.length} / ${ex.partnerRows.length} sets` : `${mineDone} / ${ex.rows.length} sets`;

  return (
    <section aria-label={ex.name} className="rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <button type="button" aria-expanded onClick={onToggle} className="min-w-0 flex-1 py-1 text-left">
          <span className="block break-words font-display text-xl font-bold uppercase leading-[1.1] tracking-normal">{ex.name}</span>
          {ex.last.length > 0 ? (
            <span className="block text-xs text-zinc-400">
              Last time: {ex.last.map((l) => `${fmt(toPreferredWeight(l.weight_kg, unit))}×${l.reps}`).join(", ")} {unit}
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
          <Button variant="ghost" size="icon" aria-label={`Collapse ${ex.name}`} aria-expanded onClick={onToggle}>
            <ChevronUp className="h-5 w-5 text-zinc-400" />
          </Button>
        </div>
      </div>

        <>
          <div className="mb-1 grid grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)_48px] gap-2 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            <span>Set</span>
            <span>{unitLabel}</span>
            <span>Reps</span>
            <span />
          </div>
          <ol className="space-y-1.5">
            {lane.map((row, i) => (
              <li key={row.id}>
                <SetRowView
                  row={row}
                  label={String(i + 1)}
                  number={i + 1}
                  tone={laneTone}
                  unit={unit}
                  who={laneWho}
                  placeholder={placeholderFor(laneTone, i)}
                  isNext={!row.completed && lane.slice(0, i).every((r) => r.completed)}
                  onField={(field, value) => onField(row.id, field, value)}
                  onBlur={() => onBlurRow(row)}
                  onToggle={() => onToggleRow(laneTone, i)}
                  readOnly={laneTone === "partner"}
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
                {theirDone.length} / {ex.partnerRows.length}
              </span>
            </button>
          )}
          {view === "sam" && (
            <p className="mt-2 text-xs text-zinc-500">{partnerName}&rsquo;s sets. Only they can change these.</p>
          )}

          {view !== "sam" && (
            <Button variant="outline" className="mt-2.5 h-11 w-full border-dashed text-zinc-400" onClick={onAddSet}>
              <Plus className="h-4 w-4" /> Add set
            </Button>
          )}
        </>
    </section>
  );
}

/** First exercise that still has sets to log (the one to start open); falls back to the first. */
function firstOpenId(list: SessionExerciseView[]): string | null {
  const next = list.find((e) => e.sets.filter((s) => s.completed).length < e.target_sets) ?? list[0];
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
  /** Pending destructive change on an exercise that has logged sets; newId set = swap, else remove. */
  const [pendingChange, setPendingChange] = React.useState<{ ex: ExerciseState; newId?: string } | null>(null);
  const [finishOpen, setFinishOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [banner, setBanner] = React.useState<string | null>(null);
  const [busy, startTransition] = React.useTransition();
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

  function placeholderFor(e: ExerciseState, lane: Lane, index: number): { weight: string; reps: string } {
    if (lane === "me") {
      const l = e.last[index] ?? e.last[e.last.length - 1];
      if (l) return { weight: l.weight_kg > 0 ? fmt(toPreferredWeight(l.weight_kg, unit)) : "", reps: l.reps > 0 ? String(l.reps) : "" };
    }
    const lanes = lane === "me" ? e.rows : e.partnerRows;
    const prev = lanes[index - 1];
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
      set_type: "normal" as const,
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
    setExercises((prev) =>
      prev.map((x) => {
        if (x.id !== e.id) return x;
        const rows = padLane(x.rows, userId, x.rows.length + 1);
        return { ...x, rows };
      })
    );
  }

  function removeLastSet(e: ExerciseState) {
    const last = e.rows[e.rows.length - 1];
    if (!last || e.rows.length <= 1) return;
    setExercises((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, rows: x.rows.slice(0, -1), partnerRows: x.partnerRows } : x))
    );
    if (last.saved) void deleteSetAction(last.id).then((r) => r.error && setBanner(r.error));
    setMenuId(null);
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
      setExercises((prev) => prev.filter((x) => x.id !== e.id));
      setPendingChange(null);
      setMenuId(null);
    });
  }

  function swapExercise(e: ExerciseState, newExerciseId: string) {
    startTransition(async () => {
      const res = await swapExerciseInWorkoutAction(e.id, newExerciseId);
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
      };
      setExercises((prev) => prev.map((x) => (x.id === e.id ? swapped : x)));
      setFocusId(e.id);
      setPendingChange(null);
      setSwapId(null);
      setAddOpen(false);
      setQuery("");
    });
  }

  /** Picker choice: add a new exercise, or swap the one being replaced (confirming first if it has logged sets). */
  function pickExercise(exerciseId: string) {
    const target = swapEx;
    if (!target) return addExercise(exerciseId);
    if (target.rows.some((r) => r.saved)) setPendingChange({ ex: target, newId: exerciseId });
    else swapExercise(target, exerciseId);
  }

  function addExercise(exerciseId: string) {
    startTransition(async () => {
      const res = await addExerciseToWorkoutAction(session.id, exerciseId);
      if (res.error || !res.data) {
        setBanner(res.error ?? "Couldn't add that exercise");
        return;
      }
      const meta = data.catalog.find((c) => c.id === exerciseId);
      const rows = padLane([], userId, 3);
      const added: ExerciseState = {
        id: res.data.id,
        exercise_id: exerciseId,
        name: meta?.name ?? "Exercise",
        category: meta?.category ?? "other",
        position: res.data.position,
        target_sets: 3,
        rep_min: null,
        rep_max: null,
        rows,
        partnerRows: [],
        last: [],
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
            <h1 className="truncate font-display text-[28px] font-extrabold uppercase leading-none tracking-wide">{session.name}</h1>
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
            {exercises.map((e) => (
              <ExerciseCard
                key={e.id}
                ex={e}
                open={expanded.has(e.id)}
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
                onAddSet={() => addSet(e)}
              />
            ))}
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
            <Button variant="secondary" className="w-full justify-start" disabled={menuEx.rows.length <= 1} onClick={() => removeLastSet(menuEx)}>
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
                  disabled={busy}
                  onClick={() => pickExercise(c.id)}
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
            <Button className="w-full" disabled={busy} onClick={() => finish()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Finish my workout
            </Button>
            {partner?.status === "joined" && !partner.completedAt && (
              <Button variant="secondary" className="w-full" disabled={busy} onClick={() => finish(true)}>
                Finish for both of us
              </Button>
            )}
            {session.isHost && (
              <Button variant="ghost" className="w-full text-red-400" disabled={busy} onClick={discard}>
                Discard workout
              </Button>
            )}
          </div>
        }
      >
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
    </div>
  );
}
