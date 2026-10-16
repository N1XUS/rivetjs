// Ported from @malva-ui/scheduler (src/lib/layout/scheduler-time.spec.ts), MIT, © 2026 Malva UI. Titles and cases unchanged.
import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY, clampMinutes, minutesFromOffset, parseTime, slotCount, snapMinutes } from "../scheduler/time.ts";

describe("scheduler-time", () => {
  it("parses HH:mm including 24:00", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("09:30")).toBe(570);
    expect(parseTime("24:00")).toBe(MINUTES_PER_DAY);
    expect(() => parseTime("9:30")).toThrow(/HH:mm/);
    expect(() => parseTime("24:01")).toThrow(/HH:mm/);
    expect(() => parseTime("12:60")).toThrow(/HH:mm/);
  });

  it("snaps to the nearest multiple and clamps", () => {
    expect(snapMinutes(37, 15)).toBe(30);
    expect(snapMinutes(38, 15)).toBe(45);
    expect(snapMinutes(37, 0)).toBe(37);
    expect(clampMinutes(-5, 0, 1440)).toBe(0);
    expect(clampMinutes(1500, 0, 1440)).toBe(1440);
  });

  it("rounds to a whole minute when snapping is off", () => {
    // layout minutes are integers (`fromLayout`), so "no snapping" is still
    // minute granularity rather than a passthrough.
    expect(snapMinutes(542.37, 0)).toBe(542);
    expect(snapMinutes(542.5, -1)).toBe(543);
    expect(minutesFromOffset(101, 960, 0, 1440, 0)).toBe(152);
  });

  it("maps a pixel offset inside a column to snapped minutes of day", () => {
    // 8:00–18:00 window (600 min) over 600 px → 1 px per minute
    expect(minutesFromOffset(0, 600, 480, 1080, 30)).toBe(480);
    expect(minutesFromOffset(97, 600, 480, 1080, 30)).toBe(570); // 8:00 + 97 → 9:37 → 9:30
    expect(minutesFromOffset(-40, 600, 480, 1080, 30)).toBe(480);
    expect(minutesFromOffset(900, 600, 480, 1080, 30)).toBe(1080);
    expect(minutesFromOffset(97, 0, 480, 1080, 30)).toBe(480); // degenerate height
  });

  it("snaps against the window start, not against midnight", () => {
    // 08:15–18:15 window: slot boundaries are 08:15, 08:45, … — 10:00 is not one.
    expect(minutesFromOffset(100, 600, 495, 1095, 30)).toBe(585); // 09:45
    expect(minutesFromOffset(20, 600, 495, 1095, 30)).toBe(525); // 08:45
  });

  it("keeps a start off the window ceiling, which is a legal end only", () => {
    // The bottom band of a column: an end may sit at maxMinutes (midnight),
    // a start may not — it would roll onto the next day.
    expect(minutesFromOffset(960, 960, 0, 1440, 30)).toBe(1440);
    expect(minutesFromOffset(960, 960, 0, 1440, 30, "start")).toBe(1410);
    expect(minutesFromOffset(953, 960, 0, 1440, 30, "start")).toBe(1410);
    expect(minutesFromOffset(900, 600, 480, 1080, 30, "start")).toBe(1050);
    // No snapping: the ceiling still steps back one whole minute.
    expect(minutesFromOffset(960, 960, 0, 1440, 0, "start")).toBe(1439);
    // A window shorter than one snap step collapses onto its own start.
    expect(minutesFromOffset(600, 600, 480, 500, 30, "start")).toBe(480);
  });

  it("counts slots", () => {
    expect(slotCount(0, 1440, 30)).toBe(48);
    expect(slotCount(480, 1080, 15)).toBe(40);
    expect(slotCount(480, 490, 30)).toBe(1);
    expect(slotCount(480, 480, 30)).toBe(1); // empty window still renders one row
  });

  it("rejects a non-positive slot duration instead of returning Infinity", () => {
    // The caller renders one row per slot; `Infinity` hangs the view.
    expect(() => slotCount(0, 1440, 0)).toThrow(/positive minutes/);
    expect(() => slotCount(0, 1440, -30)).toThrow(/positive minutes/);
    expect(() => slotCount(0, 1440, Number.NaN)).toThrow(/positive minutes/);
  });
});
