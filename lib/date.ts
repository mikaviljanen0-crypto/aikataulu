const DAY_MS = 86_400_000;

export const RANGE_START = new Date("2026-07-01T00:00:00");

export function dateOffset(date: string): number {
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() - RANGE_START.getTime()) / DAY_MS,
  );
}

export function formatEndDate(start: string, duration: number): string {
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() + Math.max(1, duration) - 1);
  return date.toLocaleDateString("fi-FI");
}
