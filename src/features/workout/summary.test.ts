import { describe, expect, it } from "vitest";
import { compareExercise, e1rm, isPersonalRecord, percentChange } from "./summary";

const sets = (...p: Array<[number, number]>) => p.map(([weight_kg, reps]) => ({ weight_kg, reps }));

describe("compareExercise", () => {
  it("has nothing to compare on a first time", () => {
    expect(compareExercise(sets([60, 8]), [], "kg")).toBeNull();
  });

  it("reports a heavier top set in the user's unit", () => {
    expect(compareExercise(sets([82.5, 6]), sets([80, 8]), "kg")).toEqual({ status: "up", text: "+2.5 kg" });
    expect(compareExercise(sets([100, 5]), sets([90, 5]), "lb")).toEqual({ status: "up", text: "+22.1 lb" });
  });

  it("reports a lighter top set as down", () => {
    expect(compareExercise(sets([70, 8]), sets([80, 8]), "kg")).toEqual({ status: "down", text: "−10 kg" });
  });

  it("compares reps at the same top weight, singular and plural", () => {
    expect(compareExercise(sets([80, 6]), sets([80, 5]), "kg")).toEqual({ status: "up", text: "+1 rep" });
    expect(compareExercise(sets([26, 10]), sets([26, 8]), "kg")).toEqual({ status: "up", text: "+2 reps" });
    expect(compareExercise(sets([80, 4]), sets([80, 6]), "kg")).toEqual({ status: "down", text: "−2 reps" });
  });

  it("falls back to total volume when the top set is unchanged", () => {
    const prev = sets([30, 12], [30, 12], [30, 12]);
    expect(compareExercise(sets([30, 12], [30, 11], [27.5, 12]), prev, "kg")).toEqual({ status: "down", text: "−6% volume" });
    expect(compareExercise(prev, prev, "kg")).toEqual({ status: "same", text: "Same" });
  });

  it("treats bodyweight (0 kg) work with equal reps as the same", () => {
    expect(compareExercise(sets([0, 10]), sets([0, 10]), "kg")).toEqual({ status: "same", text: "Same" });
  });
});

describe("isPersonalRecord", () => {
  const prior = e1rm({ weight_kg: 80, reps: 5 });
  it("needs a strictly higher estimated 1RM than any earlier workout", () => {
    expect(isPersonalRecord(sets([80, 6]), prior)).toBe(true);
    expect(isPersonalRecord(sets([80, 5]), prior)).toBe(false);
    expect(isPersonalRecord(sets([70, 8]), prior)).toBe(false);
  });
  it("is never a PR the first time an exercise is done", () => {
    expect(isPersonalRecord(sets([80, 6]), null)).toBe(false);
  });
});

describe("percentChange", () => {
  it("rounds and guards a zero baseline", () => {
    expect(percentChange(5222, 4925)).toBe(6);
    expect(percentChange(100, 0)).toBeNull();
  });
});
