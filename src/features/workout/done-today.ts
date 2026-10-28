import type { RecentSession } from "@/features/workout/actions";

const sameLocalDay = (iso: string, now: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

/**
 * Sessions that count as "done today" on the device's local calendar: over (or over for me while my buddy
 * trains), not discarded, with at least one set of mine logged. Dated by when I finished, so a workout that
 * runs past midnight belongs to the day it ended.
 */
export function doneToday(recent: readonly RecentSession[], now: Date): RecentSession[] {
  return recent.filter((s) => {
    if (s.status === "cancelled" || s.sets < 1) return false;
    const finished = s.myEndedAt ?? s.endedAt;
    return finished !== null && sameLocalDay(finished, now);
  });
}
