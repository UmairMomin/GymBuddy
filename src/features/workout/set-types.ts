import { SET_TYPES } from "@/features/workout/schemas";

export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_INFO: Record<SetType, { letter: string; name: string; blurb: string; text: string }> = {
  normal: { letter: "", name: "Normal", blurb: "A working set. Counts everywhere.", text: "" },
  warmup: { letter: "W", name: "Warm-up", blurb: "Left out of volume, PRs, hints and last-time.", text: "text-amber-400" },
  drop: { letter: "D", name: "Drop set", blurb: "Lighter weight straight after the last set. Counts.", text: "text-purple-400" },
  failure: { letter: "F", name: "To failure", blurb: "Until you could not do another rep. Counts.", text: "text-red-400" },
};

/** Unknown values (older rows, a bad payload) are treated as normal sets. */
export function toSetType(raw: string): SetType {
  return (SET_TYPES as readonly string[]).includes(raw) ? (raw as SetType) : "normal";
}

/** Warm-ups never count toward volume, PRs, hints, last-time or "sets done". */
export const isWarmup = (t: SetType) => t === "warmup";

/** How many working (non-warm-up) sets come before position `i`. */
export function workingIndex(types: readonly SetType[], i: number): number {
  return types.slice(0, i).filter((t) => !isWarmup(t)).length;
}

/** Badge text per set: a letter for warm-up / drop / failure, otherwise the working-set number (warm-ups aren't counted). */
export function setLabels(types: readonly SetType[]): string[] {
  return types.map((t, i) => (t === "normal" ? String(workingIndex(types, i) + 1) : SET_TYPE_INFO[t].letter));
}
