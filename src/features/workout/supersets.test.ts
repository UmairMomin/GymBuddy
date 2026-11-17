import { describe, expect, it } from "vitest";
import { clearLoneGroups, groupBySuperset, memberTag, nextUp, pairItems, roundOf, unpairGroup } from "./supersets";

const ex = (id: string, superset_group: string | null = null) => ({ id, superset_group });

describe("groupBySuperset", () => {
  it("shows a superset together at its first exercise's spot, lettered in order", () => {
    const blocks = groupBySuperset([ex("bench", "g1"), ex("squat"), ex("curl", "g2"), ex("row", "g1"), ex("dip", "g2")]);
    expect(blocks.map((b) => [b.letter, b.members.map((m) => m.id)])).toEqual([
      ["A", ["bench", "row"]],
      [null, ["squat"]],
      ["B", ["curl", "dip"]],
    ]);
  });

  it("shows a group left with one exercise as a plain exercise", () => {
    const blocks = groupBySuperset([ex("bench", "g1"), ex("squat")]);
    expect(blocks.every((b) => b.group === null)).toBe(true);
  });
});

describe("rotation", () => {
  it("alternates A1, A2, A1, A2", () => {
    expect(nextUp([{ id: "a", done: 0, total: 3 }, { id: "b", done: 0, total: 3 }])).toEqual({ id: "a", set: 1 });
    expect(nextUp([{ id: "a", done: 1, total: 3 }, { id: "b", done: 0, total: 3 }])).toEqual({ id: "b", set: 1 });
    expect(nextUp([{ id: "a", done: 1, total: 3 }, { id: "b", done: 1, total: 3 }])).toEqual({ id: "a", set: 2 });
  });

  it("skips a finished member and ends when both are done", () => {
    expect(nextUp([{ id: "a", done: 3, total: 3 }, { id: "b", done: 1, total: 3 }])).toEqual({ id: "b", set: 2 });
    expect(nextUp([{ id: "a", done: 3, total: 3 }, { id: "b", done: 3, total: 3 }])).toBeNull();
  });

  it("reports the round and tags members", () => {
    expect(roundOf([{ id: "a", done: 1, total: 3 }, { id: "b", done: 1, total: 3 }])).toEqual({ round: 2, of: 3 });
    expect(roundOf([{ id: "a", done: 3, total: 3 }, { id: "b", done: 3, total: 3 }])).toEqual({ round: 3, of: 3 });
    expect(memberTag("A", 1)).toBe("A2");
  });
});

describe("pairing a list", () => {
  const item = (exercise_id: string, superset_group: string | null = null) => ({ exercise_id, superset_group });

  it("pairs two exercises and leaves other pairs alone", () => {
    const out = pairItems([item("bench", "g1"), item("row", "g1"), item("ohp"), item("curl", "g2"), item("dip", "g2")], "ohp", "curl", "g3");
    expect(out.map((i) => [i.exercise_id, i.superset_group])).toEqual([
      ["bench", "g1"],
      ["row", "g1"],
      ["ohp", "g3"],
      ["curl", "g3"],
      ["dip", null], // dip's pair (curl) moved, so dip is left on its own
    ]);
  });

  it("moves an exercise out of its pair and dissolves the pair it leaves", () => {
    const out = pairItems([item("bench", "g1"), item("row", "g1"), item("ohp")], "bench", "ohp", "g2");
    expect(out.map((i) => i.superset_group)).toEqual(["g2", null, "g2"]);
  });

  it("clears lone groups and takes a group apart", () => {
    expect(clearLoneGroups([item("a", "g"), item("b")]).map((i) => i.superset_group)).toEqual([null, null]);
    expect(unpairGroup([item("a", "g"), item("b", "g"), item("c", "h"), item("d", "h")], "g").map((i) => i.superset_group)).toEqual([null, null, "h", "h"]);
  });
});
