const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function mondayOfWeek(value: string): string {
  const date = parseDate(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return formatDate(date);
}
export function isoWeek(date: Date): number {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}
export function monthName(date: Date): string {
  return date.toLocaleDateString("fi-FI", { month: "long" });
}
export function daysBetween(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_MS);
}
export function isWorkingDay(date: Date, workdays = [1,2,3,4,5], holidays: string[] = []): boolean {
  return workdays.includes(date.getDay()) && !holidays.includes(formatDate(date));
}
export function addCalendarDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
export function addWorkdays(value: string, delta: number, workdays = [1,2,3,4,5], holidays: string[] = []): string {
  const date = parseDate(value);
  const direction = delta >= 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    if (isWorkingDay(date, workdays, holidays)) remaining -= 1;
  }
  return formatDate(date);
}
export function workdayEnd(value: string, duration: number, workdays = [1,2,3,4,5], holidays: string[] = []): string {
  let date = parseDate(value);
  let remaining = Math.max(1, duration) - 1;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (isWorkingDay(date, workdays, holidays)) remaining -= 1;
  }
  return formatDate(date);
}
export function finnishPublicHolidays(year: number): string[] {
  // Fixed-date holidays. Movable holidays can be added manually in v0.4 calendar panel.
  return [
    `${year}-01-01`, `${year}-01-06`, `${year}-05-01`,
    `${year}-12-06`, `${year}-12-24`, `${year}-12-25`, `${year}-12-26`
  ];
}
