/**
 * Pure helpers for keeping a live two-person session consistent.
 * Kept free of React/Supabase so the merge rules can be unit tested.
 */

/** Should an incoming server revision replace what this client currently shows? */
export function shouldAdopt(known: number | null | undefined, incoming: number): boolean {
  return known == null || incoming > known;
}

export type LocalSetRef = { id: string; saved: boolean; revision: number | null };
export type ServerSetRef = { id: string; revision_number: number };

export type Reconciliation = {
  /** Server rows we don't have yet. */
  add: string[];
  /** Rows we have where the server is ahead (and we have no write in flight). */
  adopt: string[];
  /** Saved rows that no longer exist on the server (deleted elsewhere). */
  remove: string[];
};

/**
 * Compare local rows with an authoritative server snapshot (used after a reconnect).
 * Rows with a write still in flight (`pending`) are never overwritten or dropped: the
 * queued write will resolve them through the normal revision check.
 */
export function reconcile(
  local: readonly LocalSetRef[],
  server: readonly ServerSetRef[],
  pending: ReadonlySet<string>
): Reconciliation {
  const serverById = new Map(server.map((s) => [s.id, s]));
  const localIds = new Set(local.map((l) => l.id));

  const add = server.filter((s) => !localIds.has(s.id)).map((s) => s.id);
  const adopt: string[] = [];
  const remove: string[] = [];

  for (const l of local) {
    const s = serverById.get(l.id);
    if (pending.has(l.id)) continue;
    if (!s) {
      if (l.saved) remove.push(l.id);
      continue;
    }
    if (shouldAdopt(l.revision, s.revision_number)) adopt.push(l.id);
  }
  return { add, adopt, remove };
}

/** Rest timers are shared as an absolute end time; clamp nonsense from the wire. */
export function parseRestBroadcast(payload: unknown): { endsAt: number; total: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { endsAt?: unknown; total?: unknown };
  if (typeof p.endsAt !== "number" || typeof p.total !== "number") return null;
  if (!Number.isFinite(p.endsAt) || !Number.isFinite(p.total)) return null;
  if (p.total < 1 || p.total > 3600) return null;
  return { endsAt: p.endsAt, total: p.total };
}
