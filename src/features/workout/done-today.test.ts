import { describe, expect, it } from "vitest";
import { doneToday } from "@/features/workout/done-today";
import type { RecentSession } from "@/features/workout/actions";

const session = (over: Partial<RecentSession>): RecentSession => ({
  id: "s",
  name: "Freestyle workout",
  status: "completed",
  startedAt: "2026-10-28T08:00:00",
  endedAt: "2026-10-28T09:00:00",
  withName: null,
  myEndedAt: "2026-10-28T09:00:00",
  sets: 5,
  volumeKg: 1000,
  exercises: [],
  ...over,
});

// Local-time strings (no Z) so the test is timezone independent.
const now = new Date("2026-10-28T20:00:00");

describe("doneToday", () => {
  it("keeps a completed session with sets finished today", () => {
    expect(doneToday([session({})], now)).toHaveLength(1);
  });
  it("ignores yesterday, discarded and empty sessions", () => {
    const list = [
      session({ id: "a", endedAt: "2026-10-27T23:59:00", myEndedAt: "2026-10-27T23:59:00" }),
      session({ id: "b", status: "cancelled" }),
      session({ id: "c", sets: 0 }),
    ];
    expect(doneToday(list, now)).toEqual([]);
  });
  it("counts a session I finished while my buddy is still training", () => {
    expect(doneToday([session({ status: "in_progress", endedAt: null })], now)).toHaveLength(1);
  });
  it("dates a session by when it ended, not started", () => {
    const s = session({ startedAt: "2026-10-27T23:30:00", endedAt: "2026-10-28T00:20:00", myEndedAt: "2026-10-28T00:20:00" });
    expect(doneToday([s], now)).toHaveLength(1);
  });
});
