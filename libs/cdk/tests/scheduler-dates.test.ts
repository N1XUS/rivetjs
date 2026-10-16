// `@rivetjs/cdk/scheduler` date bridge (`scheduler/dates.ts`, Rivet-authored): day numbers, wall minutes, string /
// instance inputs, write-back in the input form (string in → string out, instance in → same class / calendar / zone),
// DST gap / overlap for `ZonedDateTime`, non-Gregorian round-trips, labels.
import { describe, expect, it } from "vitest";
import { CalendarDate, CalendarDateTime, ZonedDateTime } from "../date/CalendarDate.ts";
import { JapaneseCalendar } from "../date/calendars/JapaneseCalendar.ts";
import { HebrewCalendar } from "../date/calendars/HebrewCalendar.ts";
import { toCalendar, toZoned } from "../date/conversion.ts";
import { parseDateValue, stringifyDateValue } from "../date/serialize.ts";
import {
  civilFromDay,
  dayFromCivil,
  dayOf,
  dayOfWeek,
  formatDay,
  formatWall,
  fromLayout,
  minuteOf,
  todayDay,
  toLayoutTime,
  toWallMinutes,
} from "../scheduler/dates.ts";
import { normalizeEvent, normalizeEvents } from "../scheduler/layout.ts";

describe("scheduler dates: day numbers", () => {
  it("numbers days from 1970-01-01 (proleptic Gregorian) and round-trips civil dates", () => {
    expect(dayFromCivil(1970, 1, 1)).toBe(0);
    expect(dayFromCivil(1969, 12, 31)).toBe(-1);
    expect(dayFromCivil(2000, 3, 1)).toBe(11017);
    for (const day of [-800_000, -1, 0, 59, 11016, 20_000, 2_000_000]) {
      const [y, m, d] = civilFromDay(day);
      expect(dayFromCivil(y, m, d)).toBe(day);
    }
    expect(civilFromDay(dayFromCivil(2024, 2, 29))).toEqual([2024, 2, 29]);
  });

  it("derives weekdays without date objects (0 = Sunday)", () => {
    expect(dayOfWeek(0)).toBe(4); // Thursday 1 Jan 1970
    expect(dayOfWeek(-1)).toBe(3);
    expect(dayOfWeek(dayFromCivil(2026, 10, 12))).toBe(1); // Monday
  });

  it("splits wall minutes into day + minute", () => {
    expect(dayOf(-1)).toBe(-1);
    expect(minuteOf(-1)).toBe(1439);
    expect(toLayoutTime("2026-10-12T09:30:00")).toEqual({ day: dayFromCivil(2026, 10, 12), minute: 570 });
  });
});

describe("scheduler dates: reading inputs", () => {
  it("reads strings and instances alike", () => {
    const day = dayFromCivil(2026, 10, 12);
    expect(toWallMinutes("2026-10-12")).toBe(day * 1440);
    expect(toWallMinutes(new CalendarDate(2026, 10, 12))).toBe(day * 1440);
    expect(toWallMinutes("2026-10-12T09:30:00")).toBe(day * 1440 + 570);
    expect(toWallMinutes(new CalendarDateTime(2026, 10, 12, 9, 30))).toBe(day * 1440 + 570);
    expect(toWallMinutes("2026-10-12T09:30:00+03:00[Europe/Kyiv]", "Europe/Kyiv")).toBe(day * 1440 + 570);
  });

  it("converts a ZonedDateTime in another zone to the scheduler zone's wall clock", () => {
    const day = dayFromCivil(2026, 10, 12);
    const kyiv = "2026-10-12T09:30:00+03:00[Europe/Kyiv]";
    expect(toWallMinutes(kyiv, "UTC")).toBe(day * 1440 + 390); // 06:30 UTC
    expect(toWallMinutes(parseDateValue(kyiv) as ZonedDateTime, "UTC")).toBe(day * 1440 + 390);
    expect(toWallMinutes(kyiv, "America/New_York")).toBe(day * 1440 + 150); // 02:30 EDT
  });

  it("reads non-Gregorian values on the Gregorian axis", () => {
    const greg = new CalendarDate(2026, 10, 12);
    const japanese = toCalendar(greg, new JapaneseCalendar());
    const hebrew = toCalendar(greg, new HebrewCalendar());
    expect(toWallMinutes(japanese)).toBe(toWallMinutes(greg));
    expect(toWallMinutes(hebrew)).toBe(toWallMinutes(greg));
    expect(toWallMinutes(stringifyDateValue(hebrew))).toBe(toWallMinutes(greg));
  });

  it("returns null for unparsable input and normalizeEvents drops the event", () => {
    expect(toWallMinutes("not a date")).toBeNull();
    expect(toWallMinutes(null)).toBeNull();
    const bad = { id: "x", title: "x", start: "nope", end: "2026-10-12" };
    expect(normalizeEvent(bad, 60)).toBeNull();
    expect(normalizeEvents([bad, { id: "ok", title: "ok", start: "2026-10-12T09:00:00", end: "2026-10-12T10:00:00" }], 60).map((e) => e.event.id)).toEqual([
      "ok",
    ]);
  });
});

describe("scheduler dates: writing back in the input form", () => {
  const day = dayFromCivil(2026, 10, 14);

  it("keeps the string shape and annotation", () => {
    expect(fromLayout(day, 0, "2026-10-12")).toBe("2026-10-14");
    expect(fromLayout(day, 600, "2026-10-12", "UTC", false)).toBe("2026-10-14T10:00:00");
    expect(fromLayout(day, 600, "2026-10-12T09:30:00")).toBe("2026-10-14T10:00:00");
    expect(fromLayout(day, 1440, "2026-10-12T09:30:00")).toBe("2026-10-15T00:00:00"); // minute overflow rolls over
    const hebrew = stringifyDateValue(toCalendar(new CalendarDate(2026, 10, 12), new HebrewCalendar()));
    const out = fromLayout(day, 0, hebrew);
    expect(out).toBe("2026-10-14[u-ca=hebrew]");
    expect(parseDateValue(out)).toEqual(toCalendar(new CalendarDate(2026, 10, 14), new HebrewCalendar()));
  });

  it("keeps the instance class, calendar and zone", () => {
    expect(fromLayout(day, 0, new CalendarDate(2026, 10, 12))).toEqual(new CalendarDate(2026, 10, 14));
    expect(fromLayout(day, 600, new CalendarDate(2026, 10, 12), "UTC", false)).toEqual(new CalendarDateTime(2026, 10, 14, 10, 0));
    expect(fromLayout(day, 600, new CalendarDateTime(2026, 10, 12, 9))).toEqual(new CalendarDateTime(2026, 10, 14, 10, 0));
    const japanese = fromLayout(day, 0, toCalendar(new CalendarDate(2026, 10, 12), new JapaneseCalendar()));
    expect(japanese.calendar.identifier).toBe("japanese");
    expect(toWallMinutes(japanese)).toBe(day * 1440);
    const zoned = fromLayout(day, 600, toZoned(new CalendarDateTime(2026, 10, 12, 9), "Europe/Kyiv"), "Europe/Kyiv");
    expect(zoned).toBeInstanceOf(ZonedDateTime);
    expect((zoned as ZonedDateTime).timeZone).toBe("Europe/Kyiv");
    expect(zoned.toString()).toBe("2026-10-14T10:00:00+03:00[Europe/Kyiv]");
  });

  it("converts between the scheduler zone and the value's own zone", () => {
    // The scheduler shows UTC; the event lives in Kyiv: 10:00 UTC wall = 13:00 Kyiv.
    expect(fromLayout(day, 600, "2026-10-12T09:30:00+03:00[Europe/Kyiv]", "UTC")).toBe("2026-10-14T13:00:00+03:00[Europe/Kyiv]");
  });

  it("resolves a DST gap 'compatible' (later) and an overlap to the earlier instant", () => {
    const zone = "America/New_York";
    const like = "2026-03-01T09:00:00-05:00[America/New_York]";
    // 8 Mar 2026 02:30 does not exist (02:00 → 03:00): compatible = 03:30 EDT.
    expect(fromLayout(dayFromCivil(2026, 3, 8), 150, like, zone)).toBe("2026-03-08T03:30:00-04:00[America/New_York]");
    // 1 Nov 2026 01:30 happens twice: compatible = the earlier (EDT) one.
    expect(fromLayout(dayFromCivil(2026, 11, 1), 90, like, zone)).toBe("2026-11-01T01:30:00-04:00[America/New_York]");
    // Reading back gives the same wall clock (the gap value reads as its shifted wall time).
    expect(toWallMinutes("2026-11-01T01:30:00-05:00[America/New_York]", zone)).toBe(dayFromCivil(2026, 11, 1) * 1440 + 90);
  });

  it("round-trips every form through the layout axis", () => {
    const values = [
      "2026-10-12",
      "2026-10-12T09:30:00",
      "2026-10-12T09:30:00+03:00[Europe/Kyiv]",
      new CalendarDate(2026, 10, 12),
      new CalendarDateTime(2026, 10, 12, 9, 30),
      toCalendar(new CalendarDateTime(2026, 10, 12, 9, 30), new JapaneseCalendar()),
    ];
    for (const value of values) {
      const t = toLayoutTime(value, "Europe/Kyiv")!;
      const back = fromLayout(t.day, t.minute, value, "Europe/Kyiv");
      expect(typeof back).toBe(typeof value);
      expect(String(back)).toBe(String(value));
    }
  });
});

describe("scheduler dates: today and labels", () => {
  it("reads today on the wall clock of a zone", () => {
    const t = todayDay("UTC");
    const now = new Date();
    expect(t).toBe(dayFromCivil(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()));
  });

  it("formats day numbers and wall minutes in the locale", () => {
    const day = dayFromCivil(2026, 10, 12);
    expect(formatDay(day, "en-US", { weekday: "long" })).toBe("Monday");
    expect(formatDay(day, "de-DE", { month: "long", year: "numeric" })).toBe("Oktober 2026");
    expect(formatWall(day * 1440 + 570, "en-US", { hour: "numeric", minute: "2-digit" })).toBe("9:30 AM");
  });
});
