import test from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, dateOffsetFrom, endDateIso, formatEndDate } from "../lib/date.ts";

test("date-only arithmetic advances in Finland, including summer", () => {
  assert.equal(addDays("2026-07-23", 1), "2026-07-24");
  assert.equal(addDays("2026-07-23", 7), "2026-07-30");
  assert.equal(addDays("2026-07-23", -1), "2026-07-22");
  assert.equal(daysBetween("2026-07-23", "2026-07-30"), 7);
  assert.equal(dateOffsetFrom("2026-07-30", "2026-07-23"), 7);
});

test("DST transitions and leap dates are exact", () => {
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-12-31", 1), "2025-01-01");
});

test("end dates and Finnish formatting are timezone invariant", () => {
  assert.equal(endDateIso("2026-07-23", 5), "2026-07-27");
  assert.equal(formatEndDate("2026-07-23", 5), "27.7.2026");
});
