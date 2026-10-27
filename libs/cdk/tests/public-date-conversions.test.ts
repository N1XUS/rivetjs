// Public date convenience exports: deterministic zones, DST boundaries and locale weekends.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import {
  CalendarDate,
  fromDate,
  fromDateToLocal,
  getHoursInDay,
  isWeekday,
  parseAbsoluteToLocal,
  resetLocalTimeZone,
  setLocalTimeZone,
} from "@rivetjs/cdk/date";

afterEach(() => resetLocalTimeZone());

test("Date conversion preserves the instant across named zones and local convenience wrappers", () => {
  const date = new Date("2024-07-01T12:30:00.000Z");
  const zoned = fromDate(date, "America/New_York");
  assert.equal(zoned.hour, 8);
  assert.equal(zoned.offset, -4 * 60 * 60 * 1000);
  assert.equal(zoned.toDate().getTime(), date.getTime());
  setLocalTimeZone("Asia/Tokyo");
  assert.equal(fromDateToLocal(date).hour, 21);
  assert.equal(fromDateToLocal(date).timeZone, "Asia/Tokyo");
  assert.equal(parseAbsoluteToLocal(date.toISOString()).toString(), fromDateToLocal(date).toString());
});

test("day duration includes spring-forward and fall-back transitions", () => {
  assert.equal(getHoursInDay(new CalendarDate(2024, 3, 10), "America/New_York"), 23);
  assert.equal(getHoursInDay(new CalendarDate(2024, 11, 3), "America/New_York"), 25);
  assert.equal(getHoursInDay(new CalendarDate(2024, 3, 11), "America/New_York"), 24);
});

test("weekday depends on the locale's weekend rather than a fixed Saturday/Sunday rule", () => {
  assert.equal(isWeekday(new CalendarDate(2024, 7, 5), "en-US"), true);
  assert.equal(isWeekday(new CalendarDate(2024, 7, 6), "en-US"), false);
  assert.equal(isWeekday(new CalendarDate(2024, 7, 5), "ar-SA"), false);
  assert.equal(isWeekday(new CalendarDate(2024, 7, 7), "ar-SA"), true);
});
