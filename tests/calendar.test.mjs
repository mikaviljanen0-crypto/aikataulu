import test from "node:test";
import assert from "node:assert/strict";
import { finnishHolidays, isWorkday, nextWorkday, addWorkdays, workdayEnd, workdaysInclusive } from "../lib/calendar.ts";

test("weekday calendar spans weekends", () => {
  assert.equal(workdayEnd("2026-07-23", 5), "2026-07-29");
  assert.equal(workdaysInclusive("2026-07-23", "2026-07-29"), 5);
  assert.equal(nextWorkday("2026-10-25"), "2026-10-26");
});

test("Finnish holiday rules are included", () => {
  const days = finnishHolidays(2026);
  assert.ok(days.has("2026-12-06"));
  assert.ok(days.has("2026-12-24"));
  assert.ok(days.has("2026-01-06"));
  assert.equal(isWorkday("2026-12-25"), false);
  assert.equal(isWorkday("2026-12-28"), true);
  assert.equal(workdayEnd("2026-12-23", 3), "2026-12-29");
});

test("working day lags go both directions", () => {
  assert.equal(addWorkdays("2026-10-23", 1), "2026-10-26");
  assert.equal(addWorkdays("2026-10-26", -1), "2026-10-23");
});

test("site-specific off days can be excluded", () => {
  assert.equal(workdayEnd("2026-10-26", 3, ["2026-10-27"]), "2026-10-29");
});
