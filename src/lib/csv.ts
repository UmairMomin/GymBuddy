/**
 * CSV cell escaping for exports. Quotes cells containing delimiters, and neutralises spreadsheet
 * formula injection (cells starting with = + - @ or tab/CR are prefixed with an apostrophe).
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(",");
}
