// Pure CSV building and the experience-bucketing rule, no Prisma, no
// network, so both are unit-testable directly (same pattern as
// assessment.scoring.ts). stats.service.ts gathers the data.

/** One field, RFC 4180 quoted only when it contains a comma, quote or newline. */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV document: a header row, then one row per record, in the given column order. */
export function toCsv<T extends Record<string, unknown>>(
  columns: (keyof T & string)[],
  rows: T[],
): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvField(row[column] as never)).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Years of experience, bucketed rather than exported as the raw number ,
 * combined with role/industry/degree, an exact age-like number is a much
 * stronger re-identification risk in a small sample than a range is.
 */
export function experienceBucket(years: number | null | undefined): string {
  if (years === null || years === undefined) return "";
  if (years <= 2) return "0-2";
  if (years <= 5) return "3-5";
  if (years <= 10) return "6-10";
  return "11+";
}
