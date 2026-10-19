import { describe, expect, it } from "vitest";
import { formatClock } from "@/lib/clock";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(83)).toBe("01:23");
    expect(formatClock(3599)).toBe("59:59");
  });
  it("adds hours when needed", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3723)).toBe("1:02:03");
  });
  it("never goes negative or fractional", () => {
    expect(formatClock(-5)).toBe("00:00");
    expect(formatClock(61.9)).toBe("01:01");
  });
});
