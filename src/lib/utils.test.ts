import { describe, expect, it } from "vitest";
import { getInitials, parseLocalDate } from "@/lib/utils";

describe("parseLocalDate", () => {
  it("keeps the calendar day regardless of time zone", () => {
    const d = parseLocalDate("2026-10-18");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(18);
  });
});

describe("getInitials", () => {
  it("uses first and last word", () => {
    expect(getInitials("Alex Carter")).toBe("AC");
    expect(getInitials("alex")).toBe("A");
    expect(getInitials("   ")).toBe("?");
  });
});
