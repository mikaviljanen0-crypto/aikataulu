const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWorkday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function addWorkdays(value: string, delta: number): string {
  let date = parseDate(value);
  const step = delta >= 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  while (remaining > 0) {
    date = new Date(date.getTime() + step * DAY_MS);
    if (isWorkday(date)) remaining -= 1;
  }
  return formatDate(date);
}

export function workdayEnd(start: string, duration: number): string {
  return addWorkdays(start, Math.max(0, duration - 1));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

export function isoWeek(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

export function mondayOfWeek(value: string): string {
  const date = parseDate(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return formatDate(date);
}

export function monthName(date: Date): string {
  return date.toLocaleDateString("fi-FI", { month: "long" });
}
