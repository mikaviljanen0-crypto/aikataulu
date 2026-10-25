const DAY_MS = 86_400_000;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parse(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const d = new Date(Date.UTC(year, month, 1, 12));
  const delta = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(1 + delta + (nth - 1) * 7);
  return d;
}

export function finnishHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter); goodFriday.setUTCDate(easter.getUTCDate() - 2);
  const easterMonday = new Date(easter); easterMonday.setUTCDate(easter.getUTCDate() + 1);
  const ascension = new Date(easter); ascension.setUTCDate(easter.getUTCDate() + 39);

  // Juhannusaatto on rakennustyömailla käytännössä vapaapäivä.
  const midsummerSat = nthWeekdayOfMonth(year, 5, 6, 3);
  if (midsummerSat.getUTCDate() < 20) midsummerSat.setUTCDate(midsummerSat.getUTCDate() + 7);
  const midsummerEve = new Date(midsummerSat); midsummerEve.setUTCDate(midsummerSat.getUTCDate() - 1);

  return new Set([
    `${year}-01-01`,
    `${year}-01-06`,
    iso(goodFriday),
    iso(easterMonday),
    `${year}-05-01`,
    iso(ascension),
    iso(midsummerEve),
    `${year}-12-06`,
    `${year}-12-24`,
    `${year}-12-25`,
    `${year}-12-26`,
  ]);
}

export function isWorkday(value: string, extraDaysOff: string[] = []): boolean {
  const d = parse(value);
  const weekday = d.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  if (extraDaysOff.includes(value)) return false;
  return !finnishHolidays(d.getUTCFullYear()).has(value);
}

export function nextWorkday(value: string, extraDaysOff: string[] = []): string {
  let d = parse(value);
  for (let guard = 0; guard < 370; guard += 1) {
    const valueIso = iso(d);
    if (isWorkday(valueIso, extraDaysOff)) return valueIso;
    d = new Date(d.getTime() + DAY_MS);
  }
  return value;
}

export function addWorkdays(value: string, amount: number, extraDaysOff: string[] = []): string {
  if (amount === 0) return nextWorkday(value, extraDaysOff);
  let d = parse(nextWorkday(value, extraDaysOff));
  const direction = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  while (remaining > 0) {
    d = new Date(d.getTime() + direction * DAY_MS);
    if (isWorkday(iso(d), extraDaysOff)) remaining -= 1;
  }
  return iso(d);
}

export function workdayEnd(start: string, duration: number, extraDaysOff: string[] = []): string {
  return addWorkdays(start, Math.max(1, duration) - 1, extraDaysOff);
}

export function workdaysInclusive(start: string, end: string, extraDaysOff: string[] = []): number {
  if (end < start) return 1;
  let d = parse(start);
  const finish = parse(end).getTime();
  let count = 0;
  while (d.getTime() <= finish) {
    if (isWorkday(iso(d), extraDaysOff)) count += 1;
    d = new Date(d.getTime() + DAY_MS);
  }
  return Math.max(1, count);
}
