import { toPreferredWeight } from "@/lib/units";

/** Comparison maths for the completed-workout summary. Callers pass working sets only (no warm-ups). */
export type SetLite = { weight_kg: number; reps: number };
export type Delta = { status: "up" | "same" | "down"; text: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => (n > 0 ? "+" : "−");

export const volumeOf = (sets: readonly SetLite[]) => sets.reduce((n, s) => n + s.weight_kg * s.reps, 0);

/** Epley estimated one-rep max. */
export const e1rm = (s: SetLite) => s.weight_kg * (1 + s.reps / 30);

/** Heaviest set; the most reps wins a tie. */
function topSet(sets: readonly SetLite[]): SetLite {
  return sets.reduce((b, s) => (s.weight_kg > b.weight_kg || (s.weight_kg === b.weight_kg && s.reps > b.reps) ? s : b));
}

/** Whole-number % change, or null when there is nothing to compare against. */
export function percentChange(now: number, prev: number): number | null {
  return prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
}

/**
 * This workout's sets for one exercise against the last time it was done: heavier top set first, then reps at
 * the top set, then total volume. null when either side has no sets (first time, nothing to compare).
 */
export function compareExercise(now: readonly SetLite[], prev: readonly SetLite[], unit: "kg" | "lb"): Delta | null {
  if (now.length === 0 || prev.length === 0) return null;
  const a = topSet(now);
  const b = topSet(prev);

  if (a.weight_kg !== b.weight_kg) {
    const d = round1(toPreferredWeight(a.weight_kg, unit) - toPreferredWeight(b.weight_kg, unit));
    if (d !== 0) return { status: d > 0 ? "up" : "down", text: `${signed(d)}${Math.abs(d)} ${unit}` };
  }
  if (a.reps !== b.reps) {
    const d = a.reps - b.reps;
    return { status: d > 0 ? "up" : "down", text: `${signed(d)}${Math.abs(d)} ${Math.abs(d) === 1 ? "rep" : "reps"}` };
  }
  const pct = percentChange(volumeOf(now), volumeOf(prev));
  if (pct === null || pct === 0) return { status: "same", text: "Same" };
  return { status: pct > 0 ? "up" : "down", text: `${signed(pct)}${Math.abs(pct)}% volume` };
}

/** A PR beats the best estimated 1RM from earlier workouts; a first-ever workout for the exercise is not one. */
export function isPersonalRecord(now: readonly SetLite[], priorBest: number | null): boolean {
  if (priorBest === null || priorBest <= 0) return false;
  const best = Math.max(0, ...now.filter((s) => s.weight_kg > 0 && s.reps > 0).map(e1rm));
  return best > priorBest + 1e-9;
}
