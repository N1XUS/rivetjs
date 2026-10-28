// Regression: a quick touch release must start a range without also completing it.
// The range grid owns this pointer path, including calendars opened inside a DateRangePicker.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { RangeCalendar } from "../calendar/index.tsx";
import { DateRangePicker } from "../date-picker/index.tsx";

const initialRange = { start: "2026-10-14", end: "2026-10-17" };
const changes: string[] = [];
const changed = (value: { start: { toString(): string }; end: { toString(): string } } | null) => changes.push(value ? `${value.start}..${value.end}` : "null");
const cell = (day: number) => document.querySelector<HTMLElement>(`[data-date="2026-10-${day}"]`)!;
const pointer = (target: Element, type: string) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 1, button: 0, width: 10, height: 10 }));
const tap = (day: number) => {
  const target = cell(day);
  expect(target).not.toBeNull();
  pointer(target, "pointerdown");
  pointer(target, "pointerup");
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  changes.length = 0;
});

describe("range calendar touch selection", () => {
  for (const defaultValue of [undefined, initialRange]) {
    it(`keeps a quick first tap pending (${defaultValue ? "existing" : "empty"} range)`, () => {
      render(() => <RangeCalendar aria-label="Dates" defaultValue={defaultValue} defaultFocusedValue="2026-10-14" onChange={changed} />);
      tap(20);
      expect(changes).toEqual([]);
      expect(cell(20).getAttribute("aria-describedby")).toContain("finish");
      tap(22);
      expect(changes).toEqual(["2026-10-20..2026-10-22"]);
    });
  }

  it("keeps the picker open until the second tap commits the range", async () => {
    const openChanges: boolean[] = [];
    render(() => <DateRangePicker aria-label="Trip" defaultValue={initialRange} onChange={changed} onOpenChange={(open) => openChanges.push(open)} />);
    document.querySelector<HTMLButtonElement>("button")!.click();
    await vi.waitFor(() => expect(cell(20)).not.toBeNull());
    tap(20);
    expect(changes).toEqual([]);
    expect(cell(22)).not.toBeNull();
    expect(openChanges).toEqual([true]);
    tap(22);
    expect(changes).toEqual(["2026-10-20..2026-10-22"]);
    expect(openChanges).toEqual([true, false]);
    await vi.waitFor(() => expect(document.querySelector("[role=grid]")).toBeNull());
  });

  it("allows two quick taps on the same date to select a one-day range", () => {
    render(() => <RangeCalendar aria-label="Dates" defaultFocusedValue="2026-10-14" onChange={changed} />);
    tap(20);
    expect(changes).toEqual([]);
    tap(20);
    expect(changes).toEqual(["2026-10-20..2026-10-20"]);
  });

  it("still completes a held touch drag on another date", () => {
    vi.useFakeTimers();
    render(() => <RangeCalendar aria-label="Dates" defaultFocusedValue="2026-10-14" onChange={changed} />);
    pointer(cell(20), "pointerdown");
    vi.advanceTimersByTime(200);
    expect(changes).toEqual([]);
    pointer(cell(22), "pointerup");
    expect(changes).toEqual(["2026-10-20..2026-10-22"]);
  });
});
