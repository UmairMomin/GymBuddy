import { describe, expect, it } from "vitest";
import {
  MAX_AGE_MS,
  matchEntryToRow,
  nextStamp,
  outboxKey,
  readOutbox,
  removeEntry,
  removeEntryIfStamp,
  upsertEntry,
  writeOutbox,
  type OutboxEntry,
} from "@/features/workout/outbox";

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: "set-1",
  session_id: "sess",
  exercise_id: "ex",
  user_id: "me",
  set_order: 1,
  set_type: "normal",
  weight_kg: 60,
  reps: 8,
  completed: true,
  queued_at: 1_000_000,
  ...over,
});

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("upsertEntry / removeEntry", () => {
  it("keeps only the latest intent per set, in first-queued order", () => {
    let list = upsertEntry([], entry({ id: "a", reps: 8 }));
    list = upsertEntry(list, entry({ id: "b" }));
    list = upsertEntry(list, entry({ id: "a", reps: 9, completed: false }));
    expect(list.map((e) => e.id)).toEqual(["a", "b"]);
    expect(list[0].reps).toBe(9);
    expect(list[0].completed).toBe(false);
  });
  it("removes by id", () => {
    expect(removeEntry([entry({ id: "a" }), entry({ id: "b" })], "a").map((e) => e.id)).toEqual(["b"]);
  });
});

describe("read/write", () => {
  const key = outboxKey("me", "sess");

  it("round-trips and clears the key when empty", () => {
    const s = fakeStorage();
    writeOutbox(s, key, [entry()]);
    expect(readOutbox(s, key, 1_000_500)).toEqual([entry()]);
    writeOutbox(s, key, []);
    expect(s.map.has(key)).toBe(false);
  });

  it("drops malformed entries and survives corrupt JSON", () => {
    const s = fakeStorage({ [key]: JSON.stringify([entry(), { id: 1 }, null, entry({ id: "x", set_type: "bogus" as never })]) });
    expect(readOutbox(s, key, 1_000_500).map((e) => e.id)).toEqual(["set-1"]);
    expect(readOutbox(fakeStorage({ [key]: "{not json" }), key, 0)).toEqual([]);
    expect(readOutbox(fakeStorage({ [key]: '{"a":1}' }), key, 0)).toEqual([]);
  });

  it("drops entries older than 24h", () => {
    const s = fakeStorage();
    writeOutbox(s, key, [entry({ id: "old", queued_at: 0 }), entry({ id: "fresh", queued_at: MAX_AGE_MS })]);
    expect(readOutbox(s, key, MAX_AGE_MS + 1).map((e) => e.id)).toEqual(["fresh"]);
  });

  it("tolerates missing or throwing storage", () => {
    expect(readOutbox(null, key, 0)).toEqual([]);
    expect(() => writeOutbox(null, key, [entry()])).not.toThrow();
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readOutbox(throwing, key, 0)).toEqual([]);
    expect(() => writeOutbox(throwing, key, [entry()])).not.toThrow();
  });

  it("scopes keys per user and session", () => {
    expect(outboxKey("a", "s1")).not.toBe(outboxKey("b", "s1"));
    expect(outboxKey("a", "s1")).not.toBe(outboxKey("a", "s2"));
  });
});

describe("matchEntryToRow", () => {
  const row = (id: string, order: number, over: Partial<{ saved: boolean; weight: string; reps: string }> = {}) => ({
    id,
    order,
    saved: false,
    weight: "",
    reps: "",
    ...over,
  });

  it("prefers the row with the same id", () => {
    expect(matchEntryToRow([row("x", 1), row("set-1", 2, { saved: true, weight: "60" })], { id: "set-1", set_order: 1 })).toBe(1);
  });
  it("falls back to an untouched placeholder row with the same set number", () => {
    expect(matchEntryToRow([row("a", 1), row("b", 2)], { id: "gone", set_order: 2 })).toBe(1);
  });
  it("never overwrites a row the user already typed into or that is saved", () => {
    expect(matchEntryToRow([row("a", 1, { weight: "50" })], { id: "gone", set_order: 1 })).toBe(-1);
    expect(matchEntryToRow([row("a", 1, { saved: true })], { id: "gone", set_order: 1 })).toBe(-1);
  });
  it("returns -1 when there is no row for that set number", () => {
    expect(matchEntryToRow([row("a", 1)], { id: "gone", set_order: 5 })).toBe(-1);
  });
});

describe("write-ahead helpers", () => {
  it("removeEntryIfStamp keeps a newer intent queued while an older request finishes", () => {
    const sent = entry({ id: "a", reps: 8, queued_at: 100 });
    const newer = entry({ id: "a", reps: 9, queued_at: 101 });
    const queue = upsertEntry([sent], newer); // user edited again mid-flight
    expect(removeEntryIfStamp(queue, "a", 100)).toEqual([newer]); // old request done: newer stays
    expect(removeEntryIfStamp(queue, "a", 101)).toEqual([]); // the newer one done: gone
  });
  it("removeEntryIfStamp leaves other sets alone", () => {
    const q = [entry({ id: "a", queued_at: 1 }), entry({ id: "b", queued_at: 1 })];
    expect(removeEntryIfStamp(q, "a", 1).map((e) => e.id)).toEqual(["b"]);
  });
  it("nextStamp is strictly increasing even within one millisecond", () => {
    const a = nextStamp(0, 1000);
    const b = nextStamp(a, 1000);
    const c = nextStamp(b, 999); // clock went backwards
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(nextStamp(5, 1000)).toBe(1000);
  });
});
