import { describe, expect, it } from "vitest";
import { reconcile, shouldAdopt } from "@/features/workout/sync";

describe("shouldAdopt", () => {
  it("adopts anything when nothing is known", () => {
    expect(shouldAdopt(null, 1)).toBe(true);
    expect(shouldAdopt(undefined, 1)).toBe(true);
  });
  it("only adopts strictly newer revisions (ignores own echo and stale events)", () => {
    expect(shouldAdopt(3, 4)).toBe(true);
    expect(shouldAdopt(3, 3)).toBe(false);
    expect(shouldAdopt(3, 2)).toBe(false);
  });
});

describe("reconcile", () => {
  const none = new Set<string>();

  it("adds sets the server has and we don't (partner logged while we were offline)", () => {
    const r = reconcile([], [{ id: "a", revision_number: 1 }], none);
    expect(r).toEqual({ add: ["a"], adopt: [], remove: [] });
  });

  it("adopts rows where the server is ahead, keeps rows that are current", () => {
    const r = reconcile(
      [
        { id: "a", saved: true, revision: 1 },
        { id: "b", saved: true, revision: 2 },
      ],
      [
        { id: "a", revision_number: 3 },
        { id: "b", revision_number: 2 },
      ],
      none
    );
    expect(r.adopt).toEqual(["a"]);
    expect(r.add).toEqual([]);
    expect(r.remove).toEqual([]);
  });

  it("removes saved rows deleted elsewhere but never unsaved local rows", () => {
    const r = reconcile(
      [
        { id: "gone", saved: true, revision: 1 },
        { id: "draft", saved: false, revision: null },
      ],
      [],
      none
    );
    expect(r.remove).toEqual(["gone"]);
  });

  it("never touches rows with a write in flight", () => {
    const r = reconcile(
      [
        { id: "a", saved: true, revision: 1 },
        { id: "b", saved: true, revision: 1 },
      ],
      [{ id: "a", revision_number: 5 }],
      new Set(["a", "b"])
    );
    expect(r).toEqual({ add: [], adopt: [], remove: [] });
  });

  it("adopts a row we only know as unsaved once the server has it", () => {
    const r = reconcile([{ id: "a", saved: false, revision: null }], [{ id: "a", revision_number: 1 }], none);
    expect(r.adopt).toEqual(["a"]);
  });
});
