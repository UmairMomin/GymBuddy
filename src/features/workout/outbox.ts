/**
 * Offline outbox for set writes. When a save can't reach the server (spotty gym signal), the latest
 * intent for that set is kept in localStorage and replayed when the connection returns, even after a
 * reload. Pure functions over an injectable storage so the rules are unit testable.
 */

export type OutboxEntry = {
  id: string;
  session_id: string;
  exercise_id: string;
  user_id: string;
  set_order: number;
  set_type: "normal" | "warmup" | "drop" | "failure";
  weight_kg: number;
  reps: number;
  completed: boolean;
  queued_at: number;
};

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

/** Entries older than this are dropped on read: replaying a day-old edit over newer data would surprise people. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const outboxKey = (userId: string, sessionId: string) => `gt-outbox:${userId}:${sessionId}`;

const SET_TYPES = new Set(["normal", "warmup", "drop", "failure"]);

function isEntry(v: unknown): v is OutboxEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.session_id === "string" &&
    typeof e.exercise_id === "string" &&
    typeof e.user_id === "string" &&
    Number.isInteger(e.set_order) &&
    typeof e.set_type === "string" &&
    SET_TYPES.has(e.set_type) &&
    typeof e.weight_kg === "number" &&
    Number.isFinite(e.weight_kg) &&
    Number.isInteger(e.reps) &&
    typeof e.completed === "boolean" &&
    typeof e.queued_at === "number"
  );
}

export function readOutbox(storage: ReadStorage | null, key: string, now: number): OutboxEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).filter((e) => now - e.queued_at <= MAX_AGE_MS);
  } catch {
    return [];
  }
}

export function writeOutbox(storage: WriteStorage | null, key: string, entries: readonly OutboxEntry[]): void {
  if (!storage) return;
  try {
    if (entries.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(entries));
  } catch {
    // Storage full or blocked (private mode): the in-memory state still works for this visit.
  }
}

/** Latest intent per set wins; keeps first-queued order for stable replay. */
export function upsertEntry(entries: readonly OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  const at = entries.findIndex((e) => e.id === entry.id);
  if (at === -1) return [...entries, entry];
  const next = [...entries];
  next[at] = entry;
  return next;
}

export function removeEntry(entries: readonly OutboxEntry[], id: string): OutboxEntry[] {
  return entries.filter((e) => e.id !== id);
}

export type RowLike = { id: string; order: number; saved: boolean; weight: string; reps: string };

/**
 * After a reload, which local row should a queued write be shown on?
 *  1. the row with the same id (the set was already on screen), else
 *  2. an untouched placeholder row with the same set number (rows that were never saved get fresh ids on reload).
 * Returns -1 when neither exists (the set was added offline beyond the planned rows: append it).
 */
export function matchEntryToRow(rows: readonly RowLike[], entry: Pick<OutboxEntry, "id" | "set_order">): number {
  const byId = rows.findIndex((r) => r.id === entry.id);
  if (byId >= 0) return byId;
  return rows.findIndex((r) => !r.saved && r.order === entry.set_order && r.weight === "" && r.reps === "");
}

/**
 * Remove an entry only if it is still the one that was sent. A newer edit to the same set may have replaced it
 * while the request was in flight, and that newer intent must stay queued.
 */
export function removeEntryIfStamp(entries: readonly OutboxEntry[], id: string, stamp: number): OutboxEntry[] {
  return entries.filter((e) => !(e.id === id && e.queued_at === stamp));
}

/** Strictly increasing timestamps, so two writes in the same millisecond still get distinct stamps. */
export function nextStamp(last: number, now: number): number {
  return Math.max(now, last + 1);
}
