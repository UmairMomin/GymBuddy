"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Plus, Search, Share2, UserPlus } from "lucide-react";
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
  setExerciseSkippedAction,
  type RosterEntry,
  type SaveSetResult,
  type SessionExerciseView,
  type SetRow,
  type WorkoutData,
} from "@/features/workout/actions";
import { RestTimerDock, formatClock, useNow, type RestState } from "@/features/workout/components/rest-timer-dock";
import {
  matchEntryToRow,
  outboxKey,
  readOutbox,
  removeEntry,
  upsertEntry,
  writeOutbox,
  type OutboxEntry,
} from "@/features/workout/outbox";
import { reconcile, shouldAdopt } from "@/features/workout/sync";
import { useSessionRealtime, type SetChange } from "@/features/workout/use-session-realtime";
import { toCanonicalKg, toPreferredWeight } from "@/lib/units";
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
  return { id: crypto.randomUUID(), owner, order, weight: "", reps: "", completed: false, saved: false, error: null, editedBy: null, queued: false };
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
    editedBy: set.last_edited_by !== set.user_id ? (set.last_edited_by === me ? "you" : nameOf(set.last_edited_by)) : null,
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
  label: string;
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
  const accent = partner
    ? { text: "text-sky-300", border: "border-[#a8cbff]", doneBg: "bg-[#a8cbff]/25", fill: "border-[#a8cbff] bg-[#a8cbff] text-[#1e1e22]", ring: "border-[#a8cbff] text-sky-300" }
    : { text: "text-emerald-400", border: "border-emerald-500", doneBg: "bg-emerald-500/15", fill: "border-emerald-500 bg-emerald-500 text-accent-ink", ring: "border-emerald-500 text-emerald-400" };

  return (
    <div>
      <div className="grid grid-cols-[1.75rem_1fr_1fr_3.25rem] items-center gap-2.5">
        <span className={cn("text-center text-sm font-bold", row.completed ? accent.text : partner ? "text-sky-300/80" : "text-zinc-300")}>
          {label}
        </span>
        {(["weight", "reps"] as const).map((field) => (
          <input
            key={field}
            inputMode={field === "weight" ? "decimal" : "numeric"}
            aria-label={`${who} set ${label} ${field === "weight" ? `weight (${unit})` : "reps"}`}
            value={row[field]}
            placeholder={field === "weight" ? placeholder.weight : placeholder.reps}
            onChange={(e) => onField(field, e.target.value)}
            onBlur={onBlur}
            className={cn(
              "w-full min-w-0 rounded-2xl border-2 text-center font-bold tabular-nums placeholder:font-semibold placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2",
              partner ? "h-11 text-lg focus-visible:ring-[#a8cbff]" : "h-[52px] text-xl focus-visible:ring-emerald-400",
              row.completed
                ? cn("border-transparent text-zinc-50", accent.doneBg)
                : isNext
                  ? cn("bg-zinc-950 text-zinc-50", accent.border)
                  : "border-transparent bg-zinc-800/70 text-zinc-50"
            )}
          />
        ))}
        <button
          type="button"
          onClick={onToggle}
          aria-label={row.completed ? `${who} set ${label} logged, tap to undo` : `Log ${who} set ${label}`}
          aria-pressed={row.completed}
          className={cn(
            "flex items-center justify-center rounded-2xl border-2 transition-transform active:scale-95",
            partner ? "h-11 w-[3.25rem]" : "h-[52px] w-[52px]",
            row.completed ? accent.fill : isNext ? accent.ring : "border-transparent bg-zinc-800/70 text-zinc-400"
          )}
        >
          <Check className="h-6 w-6 stroke-[3]" />
        </button>
      </div>
      {row.error && <p role="alert" className="mt-1 pl-9 text-xs text-red-400">{row.error}</p>}
      {row.queued && !row.error && (
        <p className="mt-0.5 pl-9 text-[11px] text-amber-400">Saved on this device · will sync when you&rsquo;re back online</p>
      )}
      {row.editedBy && !row.error && !row.queued && <p className="mt-0.5 pl-9 text-[11px] text-zinc-500">edited by {row.editedBy}</p>}
    </div>
  );
}

export function ActiveWorkout({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { unit, session, userId } = data;

  const [roster, setRoster] = React.useState<RosterEntry[]>(data.roster);
  const [sessionState, setSessionState] = React.useState({ status: session.status, endedAt: session.endedAt });
  const live = sessionState.status === "in_progress";

  const me = roster.find((r) => r.isMe);
  const myName = me?.name ?? "You";
  const partner = roster.find((r) => !r.isMe && (r.status === "joined" || r.status === "left")) ?? null;
  const invited = roster.find((r) => !r.isMe && r.status === "invited") ?? null;
  const nameOf = React.useCallback(
    (id: string) => roster.find((r) => r.userId === id)?.name ?? data.buddy?.displayName ?? "Buddy",
    [roster, data.buddy]
  );

  const [exercises, setExercises] = React.useState<ExerciseState[]>(() => {
    const partnerId = data.roster.find((r) => !r.isMe && (r.status === "joined" || r.status === "left"))?.userId ?? null;
    const names = (id: string) => data.roster.find((r) => r.userId === id)?.name ?? "Buddy";
    return data.exercises.map((e) => {
      const { sets, ...rest } = e;
      const rows = padLane(
        sets.map((s) => rowFromSet(s, unit, userId, names)),
        userId,
        e.target_sets
      );
      const theirs = data.partnerSets.filter((s) => s.exercise_id === e.exercise_id).map((s) => rowFromSet(s, unit, userId, names));
      const partnerRows = partnerId ? padLane(theirs, partnerId, rows.length) : theirs;
      return { ...rest, rows, partnerRows };
    });
  });
  const exercisesRef = React.useRef(exercises);
  React.useEffect(() => {
    exercisesRef.current = exercises;
  });

  const [current, setCurrent] = React.useState(() => {
    const i = data.exercises.findIndex((e) => !e.skipped && e.sets.filter((s) => s.completed).length < e.target_sets);
    return i === -1 ? 0 : i;
  });
  const [rest, setRest] = React.useState<RestState | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
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
  const endMs = sessionState.endedAt ? Date.parse(sessionState.endedAt) : now;
  const elapsed = Math.max(0, (endMs - Date.parse(session.startedAt)) / 1000);

  const ex = exercises[current] as ExerciseState | undefined;

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
  // ---- offline outbox -------------------------------------------------------------------------
  const storageKey = outboxKey(userId, session.id);
  const readQueue = () => readOutbox(safeStorage(), storageKey, nowMs());
  const writeQueue = (list: OutboxEntry[]) => {
    writeOutbox(safeStorage(), storageKey, list);
    setQueuedCount(list.length);
  };
  const enqueue = (entry: OutboxEntry) => writeQueue(upsertEntry(readQueue(), entry));
  const dequeue = (id: string) => {
    const cur = readQueue();
    if (cur.some((e) => e.id === id)) writeQueue(removeEntry(cur, id));
  };

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
    const run = async () => {
      let res: SaveSetResult;
      try {
        res = await saveSetAction({ ...payload, expected_revision: revisions.current.get(row.id) ?? null });
      } catch {
        enqueue({ ...payload, queued_at: nowMs() });
        patchRow(e.id, row.id, { queued: true, error: null });
        return;
      }
      dequeue(row.id);
      applySaveResult(e.id, row, res);
    };
    const prior = queues.current.get(row.id) ?? Promise.resolve();
    pending.current.add(row.id);
    const p: Promise<unknown> = prior.then(run, run).finally(() => {
      if (queues.current.get(row.id) === p) pending.current.delete(row.id);
    });
    queues.current.set(row.id, p);
  }

  /** Replay one queued write through the same per-set queue. Resolves false while still offline. */
  function sendQueued(entry: OutboxEntry): Promise<boolean> {
    const { queued_at: _queuedAt, ...payload } = entry;
    void _queuedAt;
    const exId = exercisesRef.current.find((x) => x.exercise_id === entry.exercise_id)?.id;
    const run = async (): Promise<boolean> => {
      let res: SaveSetResult;
      try {
        res = await saveSetAction({ ...payload, expected_revision: revisions.current.get(entry.id) ?? null });
      } catch {
        return false;
      }
      dequeue(entry.id);
      if (exId) {
        const row = [...(exercisesRef.current.find((x) => x.id === exId)?.rows ?? []), ...(exercisesRef.current.find((x) => x.id === exId)?.partnerRows ?? [])].find((r) => r.id === entry.id);
        if (row) applySaveResult(exId, row, res);
      }
      return true;
    };
    const prior = queues.current.get(entry.id) ?? Promise.resolve();
    pending.current.add(entry.id);
    const p: Promise<boolean> = prior.then(run, run);
    const settled = p.finally(() => {
      if (queues.current.get(entry.id) === settled) pending.current.delete(entry.id);
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

  function startRest(seconds: number) {
    const next = { endsAt: nowMs() + seconds * 1000, total: seconds };
    setRest(next);
    realtime.sendRest(next);
  }

  function toggleComplete(e: ExerciseState, lane: Lane, index: number) {
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
    if (live && lane === "me") startRest(e.rest_seconds ?? 90);
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
        const partnerRows = partner ? padLane(x.partnerRows, partner.userId, rows.length) : x.partnerRows;
        return { ...x, rows, partnerRows };
      })
    );
  }

  function removeLastSet(e: ExerciseState) {
    const last = e.rows[e.rows.length - 1];
    if (!last || e.rows.length <= 1) return;
    setExercises((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, rows: x.rows.slice(0, -1), partnerRows: x.partnerRows.slice(0, x.rows.length - 1) } : x))
    );
    if (last.saved) void deleteSetAction(last.id).then((r) => r.error && setBanner(r.error));
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
        rest_seconds: 90,
        skipped: false,
        rows,
        partnerRows: partner ? padLane([], partner.userId, rows.length) : [],
        last: [],
      };
      setExercises((prev) => {
        setCurrent(prev.length);
        return [...prev, added];
      });
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

    const joinedPartner = sync.roster.find((r) => !r.isMe && (r.status === "joined" || r.status === "left"));
    if (joinedPartner) {
      setExercises((prev) =>
        prev.map((e) => ({ ...e, partnerRows: padLane(e.partnerRows, joinedPartner.userId, e.rows.length) }))
      );
    }

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
    onRest: setRest,
  });

  const currentExerciseId = ex?.exercise_id ?? null;
  const { track } = realtime;
  React.useEffect(() => {
    track(currentExerciseId);
  }, [track, currentExerciseId]);

  const peer = realtime.peers[0] ?? null;
  const peerExercise = peer ? exercises.find((e) => e.exercise_id === peer.exerciseId)?.name : undefined;

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

  function finish() {
    startTransition(async () => {
      const res = session.isHost ? await finishWorkoutAction(session.id) : await finishMyWorkoutAction(session.id);
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
            {live ? formatClock(elapsed) : `${sessionState.status === "completed" ? "Completed" : "Discarded"} · ${formatClock(elapsed)}`}
          </p>
        </div>
        {live && (
          <Button className="h-11 rounded-2xl px-5" onClick={() => setFinishOpen(true)}>
            Finish
          </Button>
        )}
      </header>

      {/* buddy presence / invite */}
      {live && (partner || invited || (session.isHost && data.buddy)) && (
        <div
          role="status"
          className="mb-3 flex items-center gap-3 rounded-2xl bg-[#a8cbff]/15 px-3.5 py-2.5 text-sm text-zinc-100"
        >
          {partner ? (
            <>
              <span
                aria-hidden
                className={cn("h-2 w-2 shrink-0 rounded-full", realtime.status === "live" && peer ? "bg-[#a8cbff]" : "bg-zinc-500")}
              />
              <span className="min-w-0 flex-1 truncate">
                {realtime.status === "reconnecting"
                  ? "Reconnecting…"
                  : peer
                    ? `${partnerName} is here · live${peerExercise ? ` · ${peerExercise}` : ""}`
                    : `${partnerName} · not connected`}
              </span>
            </>
          ) : invited ? (
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
                  {partner && (
                    <p className="flex gap-4 px-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-emerald-400">● You</span>
                      <span className="text-sky-300">● {partnerName}</span>
                    </p>
                  )}
                  <ol className="space-y-3">
                    {ex.rows.map((row, i) => {
                      const theirs = partner ? ex.partnerRows[i] : undefined;
                      return (
                        <li key={row.id} className="space-y-1.5">
                          <SetRowView
                            row={row}
                            label={String(i + 1)}
                            tone="me"
                            unit={unit}
                            who="Your"
                            placeholder={placeholderFor(ex, "me", i)}
                            isNext={!row.completed && ex.rows.slice(0, i).every((r) => r.completed)}
                            onField={(field, value) => patchRow(ex.id, row.id, { [field]: value, error: null })}
                            onBlur={() => commitEdit(ex, row)}
                            onToggle={() => toggleComplete(ex, "me", i)}
                          />
                          {theirs && (
                            <SetRowView
                              row={theirs}
                              label={partnerName.slice(0, 1).toUpperCase()}
                              tone="partner"
                              unit={unit}
                              who={`${partnerName}'s`}
                              placeholder={placeholderFor(ex, "partner", i)}
                              isNext={!theirs.completed && ex.partnerRows.slice(0, i).every((r) => r.completed)}
                              onField={(field, value) => patchRow(ex.id, theirs.id, { [field]: value, error: null })}
                              onBlur={() => commitEdit(ex, theirs)}
                              onToggle={() => toggleComplete(ex, "partner", i)}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <Button variant="outline" className="h-12 w-full border-dashed text-zinc-400" onClick={() => addSet(ex)}>
                    <Plus className="h-4 w-4" /> Add set
                  </Button>
                  {partner && <p className="text-xs text-zinc-500">Tap {partnerName}&rsquo;s numbers to correct them. Edits show who made them.</p>}
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
          shared={Boolean(partner)}
          onAdjust={(d) => {
            const next = { endsAt: rest.endsAt + d * 1000, total: Math.max(1, rest.total + d) };
            setRest(next);
            realtime.sendRest(next);
          }}
          onSkip={() => {
            setRest(null);
            realtime.sendRest(null);
          }}
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
        title={session.isHost ? "Finish workout?" : "Finish your workout?"}
        footer={
          <div className="space-y-2">
            <Button className="w-full" disabled={busy} onClick={finish}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {session.isHost ? "Finish workout" : "Finish my workout"}
            </Button>
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
        {exercises.some((e) => !e.skipped && e.rows.some((r) => !r.completed)) && (
          <p className="mt-3 text-sm text-amber-400">Some sets aren&rsquo;t logged yet. They won&rsquo;t be saved.</p>
        )}
      </Sheet>
    </div>
  );
}
