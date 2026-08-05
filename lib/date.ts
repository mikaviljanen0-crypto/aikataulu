const DAY_MS = 86_400_000;

export function dateOffsetFrom(date: string, rangeStart: string): number {
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${rangeStart}T00:00:00`).getTime()) /
      DAY_MS,
  );
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function formatEndDate(start: string, duration: number): string {
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() + Math.max(1, duration) - 1);
  return date.toLocaleDateString("fi-FI");
}

export function endDateIso(start: string, duration: number): string {
  return addDays(start, Math.max(1, duration) - 1);
}

export function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(`${end}T00:00:00`).getTime() -
      new Date(`${start}T00:00:00`).getTime()) /
      DAY_MS,
  );
}

export function minIsoDate(values: string[]): string {
  return [...values].sort()[0];
}

export function maxIsoDate(values: string[]): string {
  return [...values].sort().at(-1)!;
}
