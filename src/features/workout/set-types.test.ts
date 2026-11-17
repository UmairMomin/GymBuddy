import { describe, expect, it } from "vitest";
import { setLabels, toSetType, workingIndex } from "./set-types";

describe("set types", () => {
  it("numbers working sets and skips warm-ups", () => {
    expect(setLabels(["warmup", "warmup", "normal", "normal", "normal", "drop"])).toEqual(["W", "W", "1", "2", "3", "D"]);
  });

  it("counts a drop set before a normal set as a working set", () => {
    expect(setLabels(["normal", "drop", "normal", "failure"])).toEqual(["1", "D", "3", "F"]);
  });

  it("counts working sets before a position", () => {
    expect(workingIndex(["warmup", "normal", "drop", "normal"], 3)).toBe(2);
    expect(workingIndex(["warmup", "warmup", "normal"], 2)).toBe(0);
  });

  it("falls back to normal for unknown values", () => {
    expect(toSetType("bogus")).toBe("normal");
    expect(toSetType("warmup")).toBe("warmup");
  });
});
