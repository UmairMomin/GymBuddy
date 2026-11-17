import { describe, expect, it } from "vitest";
import { overloadHint } from "./overload";

const base = { repMin: null, repMax: null, equipment: "barbell", unit: "kg" as const };
const sets = (...p: Array<[number, number]>) => p.map(([weight_kg, reps]) => ({ weight_kg, reps }));

describe("overloadHint", () => {
  it("adds a step when every set hit the top of the default 8-12 range", () => {
    expect(overloadHint({ ...base, last: sets([60, 12], [60, 12], [60, 12]) })).toMatchObject({ weight: 62.5, reps: 8 });
  });

  it("keeps the weight and asks for one more rep than the weakest set", () => {
    expect(overloadHint({ ...base, last: sets([60, 12], [60, 12], [60, 10]) })).toMatchObject({ weight: 60, reps: 11 });
  });

  it("uses a routine's own rep range over the default", () => {
    expect(overloadHint({ ...base, repMin: 6, repMax: 8, last: sets([60, 8], [60, 8], [60, 8]) })).toMatchObject({ weight: 62.5, reps: 6 });
  });

  it("uses 5 kg steps for cable and machine, 2.5 kg otherwise", () => {
    const l = sets([40, 12], [40, 12]);
    expect(overloadHint({ ...base, equipment: "cable", last: l })?.weight).toBe(45);
    expect(overloadHint({ ...base, equipment: "machine", last: l })?.weight).toBe(45);
    expect(overloadHint({ ...base, equipment: "dumbbell", last: l })?.weight).toBe(42.5);
    expect(overloadHint({ ...base, equipment: null, last: l })?.weight).toBe(42.5);
  });

  it("ignores lighter sets such as drop sets", () => {
    expect(overloadHint({ ...base, last: sets([60, 12], [60, 12], [45, 8]) })).toMatchObject({ weight: 62.5, reps: 8 });
  });

  it("never suggests fewer reps than the bottom of the range", () => {
    expect(overloadHint({ ...base, last: sets([60, 3], [60, 3]) })).toMatchObject({ weight: 60, reps: 8 });
  });

  it("is silent without history or for bodyweight work", () => {
    expect(overloadHint({ ...base, last: [] })).toBeNull();
    expect(overloadHint({ ...base, last: sets([0, 12], [0, 12]) })).toBeNull();
  });

  it("works in pounds with pound steps", () => {
    const h = overloadHint({ ...base, unit: "lb", equipment: "cable", last: sets([45.36, 12]) });
    expect(h?.weight).toBeCloseTo(110, 0); // 100 lb + 10 lb
  });
});
