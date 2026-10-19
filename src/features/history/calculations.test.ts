import { describe, expect, it } from "vitest";
import { calculateEstimated1RM, calculateTotalVolume } from "@/features/history/calculations";

describe("calculateEstimated1RM (Brzycki)", () => {
  it("returns the weight itself for a single", () => {
    expect(calculateEstimated1RM(100, 1)).toBe(100);
  });
  it("matches the Brzycki formula", () => {
    // 100 kg x 5 -> 100 * 36 / 32 = 112.5
    expect(calculateEstimated1RM(100, 5)).toBe(112.5);
    // 60 kg x 10 -> 60 * 36 / 27 = 80
    expect(calculateEstimated1RM(60, 10)).toBe(80);
  });
  it("is 0 for non-positive input", () => {
    expect(calculateEstimated1RM(0, 5)).toBe(0);
    expect(calculateEstimated1RM(50, 0)).toBe(0);
  });
});

describe("calculateTotalVolume", () => {
  it("sums weight x reps of completed sets only", () => {
    expect(
      calculateTotalVolume([
        { weight_kg: 60, reps: 8, completed: true },
        { weight_kg: 60, reps: 8, completed: true },
        { weight_kg: 100, reps: 1, completed: false },
      ])
    ).toBe(960);
  });
  it("is 0 for no sets", () => {
    expect(calculateTotalVolume([])).toBe(0);
  });
});
