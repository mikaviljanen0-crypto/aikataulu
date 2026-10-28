const DAY_MS = 86_400_000;

// Date-only values must be independent of the browser's timezone.
// Using local midnight with toISOString() causes addDays(date, 1)
// to return the same day in Finland (UTC+2/+3), freezing progress loops.
function parseUtcDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

export function dateOffsetFrom(date: string, rangeStart: string): number {
  return daysBetween(rangeStart, date);
}

export function addDays(date: string, amount: number): string {
  const value = parseUtcDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function formatEndDate(start: string, duration: number): string {
  const end = endDateIso(start, duration);
  return parseUtcDate(end).toLocaleDateString("fi-FI", { timeZone: "UTC" });
}

export function endDateIso(start: string, duration: number): string {
  return addDays(start, Math.max(1, duration) - 1);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseUtcDate(end).getTime() - parseUtcDate(start).getTime()) / DAY_MS);
}

export function minIsoDate(values: string[]): string {
  return [...values].sort()[0];
}

export function maxIsoDate(values: string[]): string {
  return [...values].sort().at(-1)!;
}
