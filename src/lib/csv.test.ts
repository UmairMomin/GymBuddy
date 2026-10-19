import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain values alone and blanks null/undefined", () => {
    expect(csvCell("Push")).toBe("Push");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes cells with commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("-2+3")).toBe("'-2+3");
  });
  it("does not mangle real negative numbers", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("csvRow", () => {
  it("joins escaped cells", () => {
    expect(csvRow(["a", 1, null, "x,y"])).toBe('a,1,,"x,y"');
  });
});
