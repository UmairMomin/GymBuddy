/** An exercise is in at most one superset; members of a superset share a group id. */
export type Groupable = { id: string; superset_group: string | null };

export type SupersetBlock<T> = {
  /** Null for an exercise that isn't in a superset. */
  group: string | null;
  /** "A", "B", ... in the order the supersets appear; null when not in a superset. */
  letter: string | null;
  members: T[];
};

/**
 * Lay a list out for display. A superset is shown together at the spot of its first exercise, so linking two
 * exercises that are far apart in the list never needs the stored order to change. A group left with a single
 * exercise (it was removed elsewhere) is shown as a plain exercise.
 */
export function groupBySuperset<T extends Groupable>(items: readonly T[]): Array<SupersetBlock<T>> {
  const size = new Map<string, number>();
  for (const it of items) if (it.superset_group) size.set(it.superset_group, (size.get(it.superset_group) ?? 0) + 1);

  const out: Array<SupersetBlock<T>> = [];
  const placed = new Set<string>();
  let n = 0;
  for (const it of items) {
    const g = it.superset_group;
    if (!g || (size.get(g) ?? 0) < 2) {
      out.push({ group: null, letter: null, members: [it] });
    } else if (!placed.has(g)) {
      placed.add(g);
      out.push({ group: g, letter: String.fromCharCode(65 + (n++ % 26)), members: items.filter((x) => x.superset_group === g) });
    }
  }
  return out;
}

/** The tag shown before a superset member's name: "A1", "A2". */
export const memberTag = (letter: string, index: number) => `${letter}${index + 1}`;

export type Progress = { id: string; done: number; total: number };

/** Who is up next in a superset: the member with the fewest sets logged (ties go to the earlier one). */
export function nextUp(members: readonly Progress[]): { id: string; set: number } | null {
  let best: Progress | null = null;
  for (const m of members) {
    if (m.done >= m.total) continue;
    if (!best || m.done < best.done) best = m;
  }
  return best ? { id: best.id, set: best.done + 1 } : null;
}

/** "Round 2 of 3": the round the group is in, and how many there are. */
export function roundOf(members: readonly Progress[]): { round: number; of: number } {
  const of = Math.max(1, ...members.map((m) => m.total));
  const round = Math.min(of, Math.min(...members.map((m) => m.done)) + 1);
  return { round, of };
}

type Linkable = { exercise_id: string; superset_group: string | null };

/** Clear any group that is down to a single exercise. */
export function clearLoneGroups<T extends Linkable>(items: readonly T[]): T[] {
  const size = new Map<string, number>();
  for (const it of items) if (it.superset_group) size.set(it.superset_group, (size.get(it.superset_group) ?? 0) + 1);
  return items.map((it) => (it.superset_group && (size.get(it.superset_group) ?? 0) < 2 ? { ...it, superset_group: null } : it));
}

/** Pair two exercises under a new group; each leaves whatever pair it was in (that pair is dissolved if it shrinks to one). */
export function pairItems<T extends Linkable>(items: readonly T[], a: string, b: string, group: string): T[] {
  return clearLoneGroups(items.map((it) => (it.exercise_id === a || it.exercise_id === b ? { ...it, superset_group: group } : it)));
}

/** Take a whole group apart. */
export function unpairGroup<T extends Linkable>(items: readonly T[], group: string): T[] {
  return items.map((it) => (it.superset_group === group ? { ...it, superset_group: null } : it));
}
