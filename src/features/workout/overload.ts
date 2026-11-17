import { toPreferredWeight } from "@/lib/units";

export const DEFAULT_REP_MIN = 8;
export const DEFAULT_REP_MAX = 12;

export type OverloadHint = {
  /** Suggested weight in the user's unit. */
  weight: number;
  reps: number;
  /** Short why, shown beside the suggestion. */
  reason: string;
};

/** Cable and machine loads move in bigger jumps; everything else in the smallest plates. */
function stepFor(equipment: string | null, unit: "kg" | "lb"): number {
  const big = equipment === "cable" || equipment === "machine";
  if (unit === "kg") return big ? 5 : 2.5;
  return big ? 10 : 5;
}

/**
 * Double progression on last time's working sets (warm-ups are already left out):
 *  - every set at the heaviest weight reached the top of the rep range → add one step, back to the bottom of the range
 *  - otherwise → same weight, one more rep than the weakest of those sets
 * Lighter sets (drop sets, back-offs) are ignored. No hint without history or for bodyweight (0) work.
 * shortcut: no RPE and no deload logic, it only ever suggests going up; add if users ask for it.
 */
export function overloadHint(opts: {
  last: ReadonlyArray<{ weight_kg: number; reps: number }>;
  repMin: number | null;
  repMax: number | null;
  equipment: string | null;
  unit: "kg" | "lb";
}): OverloadHint | null {
  const { last, equipment, unit } = opts;
  const min = opts.repMin ?? DEFAULT_REP_MIN;
  const max = Math.max(opts.repMax ?? DEFAULT_REP_MAX, min);
  const sets = last.filter((s) => s.reps > 0);
  if (sets.length === 0) return null;

  const top = Math.max(...sets.map((s) => s.weight_kg));
  if (top <= 0) return null;
  const atTop = sets.filter((s) => s.weight_kg === top);
  const weakest = Math.min(...atTop.map((s) => s.reps));
  const weight = toPreferredWeight(top, unit);

  if (weakest >= max) {
    const next = Math.round((weight + stepFor(equipment, unit)) * 100) / 100;
    return { weight: next, reps: min, reason: `you hit ${max}+ on every set` };
  }
  const reps = Math.max(weakest + 1, min);
  return { weight, reps, reason: `your weakest set was ${weakest}` };
}
