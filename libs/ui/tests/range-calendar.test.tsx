// DOM-target suite: `RangeCalendar` (upstream tests/components/range-calendar/range-calendar.test.tsx ported to happy-dom): grid name +
// aria-multiselectable, data-slots + BEM block (incl. the inner cell button), range start / end attributes, onChange for a range,
// controlled range (Rivet: a Signal of `{ start, end }` strings, two-way, instead of a re-render), isDisabled, nav buttons, year picker
// open / select / Escape. Rivet: index exports, parts outside a RangeCalendar, cell button data-* follow hover / selection, function
// children of the cell. Skipped: "focus-visible via keyboard" (`user.tab()` needs real focus navigation: Chromium suite).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CalendarDate } = await import("@rivetjs/cdk/date");
const { RangeCalendar, RangeCalendarRoot, rangeCalendarVariants, YearPickerContext } = await import("../src/components/range-calendar/index.ts");
const { CalendarYearPicker } = await import("../src/components/calendar-year-picker/index.ts");

type DateValue = InstanceType<typeof CalendarDate>;
const MIN_VALUE = new CalendarDate(2020, 1, 1);
const MAX_VALUE = new CalendarDate(2030, 12, 31);
const flush = () => new Promise((r) => setTimeout(r, 20));

const Fixture = (props: Record<string, unknown>) => (
  <RangeCalendar
    aria-label="Trip dates"
    defaultValue={{ start: new CalendarDate(2026, 8, 1), end: new CalendarDate(2026, 8, 5) }}
    maxValue={MAX_VALUE}
    minValue={MIN_VALUE}
    {...props}
  >
    <RangeCalendar.Header>
      <RangeCalendar.YearPickerTrigger>
        <RangeCalendar.YearPickerTriggerHeading />
        <RangeCalendar.YearPickerTriggerIndicator />
      </RangeCalendar.YearPickerTrigger>
      <RangeCalendar.NavButton slot="previous" />
      <RangeCalendar.NavButton slot="next" />
    </RangeCalendar.Header>
    <RangeCalendar.Grid>
      <RangeCalendar.GridHeader>{(day: string) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
      <RangeCalendar.GridBody>{(date: DateValue) => <RangeCalendar.Cell date={date as never} />}</RangeCalendar.GridBody>
    </RangeCalendar.Grid>
    <RangeCalendar.YearPickerGrid>
      <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
    </RangeCalendar.YearPickerGrid>
  </RangeCalendar>
);

const getDayCell = (day: number) =>
  [...document.querySelectorAll('[data-slot="range-calendar-cell-button"]')]
    .find((el) => el.textContent === String(day))
    ?.closest<HTMLElement>('[role="button"]') ?? null;
const grid = () => document.querySelector<HTMLElement>("[role=grid]")!;
const trigger = () => [...document.querySelectorAll<HTMLElement>("button")].find((b) => /year selector/.test(b.getAttribute("aria-label") ?? ""))!;
const yearGrid = () => document.querySelector<HTMLElement>('[data-slot="calendar-year-picker-grid"]')!;
const yearButton = (year: string) => [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === year) ?? null;

test("range-calendar: index exports", () => {
  assert.equal(RangeCalendar, RangeCalendarRoot);
  assert.equal(RangeCalendar.Root, RangeCalendarRoot);
  assert.equal(RangeCalendar.YearPickerCell, CalendarYearPicker.Cell);
  assert.equal(rangeCalendarVariants().base(), "range-calendar");
  assert.ok(YearPickerContext);
});

test("range-calendar: renders a multi-selectable grid with an accessible name", () => {
  const r = render(() => <Fixture />);
  assert.match(grid().getAttribute("aria-label") ?? "", /Trip dates/);
  assert.equal(grid().getAttribute("aria-multiselectable"), "true");
  r.unmount();
});

test("range-calendar: exposes data-slots and BEM block", () => {
  const r = render(() => <Fixture />);
  assert.match(document.querySelector('[data-slot="range-calendar"]')!.className, /\brange-calendar\b/);
  for (const [slot, cls] of [
    ["range-calendar-header", "range-calendar__header"],
    ["range-calendar-grid", "range-calendar__grid"],
    ["range-calendar-grid-header", "range-calendar__grid-header"],
    ["range-calendar-grid-body", "range-calendar__grid-body"],
    ["range-calendar-header-cell", "range-calendar__header-cell"],
    ["range-calendar-nav-button", "range-calendar__nav-button"],
    ["range-calendar-nav-button-icon", "range-calendar__nav-button-icon"],
    ["range-calendar-cell", "range-calendar__cell"],
    ["range-calendar-cell-button", "range-calendar__cell-button"],
  ]) {
    const el = document.querySelector(`[data-slot="${slot}"]`);
    assert.ok(el, slot);
    assert.match(el.getAttribute("class") ?? "", new RegExp(cls!), slot);
  }
  assert.ok(document.querySelectorAll('[data-slot="range-calendar-cell-button"]').length > 0);
  r.unmount();
});

test("range-calendar: exposes range start and end data attributes (+ cell button data-selected)", () => {
  const r = render(() => <Fixture />);
  assert.equal(getDayCell(1)!.getAttribute("data-selection-start"), "true");
  assert.equal(getDayCell(5)!.getAttribute("data-selection-end"), "true");
  assert.equal(getDayCell(1)!.querySelector('[data-slot="range-calendar-cell-button"]')!.getAttribute("data-selected"), "true");
  assert.equal(getDayCell(3)!.querySelector('[data-slot="range-calendar-cell-button"]')!.getAttribute("data-selected"), null);
  r.unmount();
});

test("range-calendar: calls onChange when selecting a date range", async () => {
  const calls: { start: string; end: string }[] = [];
  const r = render(() => <Fixture onChange={(v: { start: DateValue; end: DateValue }) => calls.push({ start: v.start.toString(), end: v.end.toString() })} />);
  getDayCell(10)!.click();
  await flush();
  getDayCell(15)!.click();
  await flush();
  assert.deepEqual(calls.at(-1), { start: "2026-08-10", end: "2026-08-15" });
  assert.equal(getDayCell(15)!.querySelector('[data-slot="range-calendar-cell-button"]')!.getAttribute("data-selected"), "true");
  r.unmount();
});

test("range-calendar: supports a controlled range value (cdk: a Signal of { start, end } strings, two-way)", async () => {
  const value = signal<{ start: string; end: string } | null>({ start: "2026-08-01", end: "2026-08-05" });
  const r = render(() => (
    <RangeCalendar aria-label="Trip dates" maxValue={MAX_VALUE} minValue={MIN_VALUE} value={value as never}>
      <RangeCalendar.Header>
        <RangeCalendar.Heading />
        <RangeCalendar.NavButton slot="previous" />
        <RangeCalendar.NavButton slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>{(day: string) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date: DateValue) => <RangeCalendar.Cell date={date as never} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </RangeCalendar>
  ));
  assert.equal(getDayCell(1)!.getAttribute("data-selection-start"), "true");
  assert.equal(getDayCell(5)!.getAttribute("data-selection-end"), "true");
  value.set({ start: "2026-08-10", end: "2026-08-15" });
  await flush();
  assert.equal(getDayCell(10)!.getAttribute("data-selection-start"), "true");
  assert.equal(getDayCell(15)!.getAttribute("data-selection-end"), "true");
  assert.match(document.querySelector('[data-slot="range-calendar-heading"]')!.className, /range-calendar__heading/);
  r.unmount();
});

test("range-calendar: supports isDisabled to block range selection", async () => {
  const calls: unknown[] = [];
  const r = render(() => <Fixture isDisabled onChange={(v: unknown) => calls.push(v)} />);
  assert.equal(document.querySelector('[data-slot="range-calendar"]')!.getAttribute("data-disabled"), "true");
  getDayCell(10)!.click();
  getDayCell(15)!.click();
  await flush();
  assert.deepEqual(calls, []);
  assert.equal(getDayCell(10)!.querySelector('[data-slot="range-calendar-cell-button"]')!.getAttribute("data-disabled"), "true");
  r.unmount();
});

test("range-calendar: supports next and previous month via NavButton", async () => {
  const r = render(() => <Fixture />);
  assert.match(grid().getAttribute("aria-label") ?? "", /August 2026/);
  document.querySelector<HTMLElement>('[data-slot="range-calendar-nav-button"][slot="next"]')!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /September 2026/);
  document.querySelector<HTMLElement>('[data-slot="range-calendar-nav-button"][slot="previous"]')!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /August 2026/);
  r.unmount();
});

test("range-calendar: year picker opens from the trigger, selects a year and closes", async () => {
  const r = render(() => <Fixture />);
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(yearGrid().getAttribute("aria-hidden"), "true");
  trigger().click();
  await flush();
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  assert.notEqual(yearGrid().getAttribute("aria-hidden"), "true");
  yearButton("2028")!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /2028/);
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(yearGrid().getAttribute("aria-hidden"), "true");
  r.unmount();
});

test("range-calendar: Escape dismisses the year picker", async () => {
  const r = render(() => <Fixture />);
  trigger().click();
  await flush();
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  yearGrid().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await flush();
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(yearGrid().getAttribute("aria-hidden"), "true");
  r.unmount();
});

test("range-calendar: Cell function children get the cdk render props; CellIndicator", () => {
  const r = render(() => (
    <RangeCalendar aria-label="Trip dates" defaultValue={{ start: "2026-08-01", end: "2026-08-05" }}>
      <RangeCalendar.Grid>
        <RangeCalendar.GridBody>
          {(date: DateValue) => (
            <RangeCalendar.Cell date={date as never}>
              {({ formattedDate, isSelectionStart }) => (
                <>
                  <b data-start={isSelectionStart() ? "y" : "n"}>{formattedDate}</b>
                  <RangeCalendar.CellIndicator />
                </>
              )}
            </RangeCalendar.Cell>
          )}
        </RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </RangeCalendar>
  ));
  const start = [...document.querySelectorAll("b")].find((b) => b.textContent === "1")!;
  assert.equal(start.getAttribute("data-start"), "y");
  assert.ok(start.closest('[data-slot="range-calendar-cell-button"]'));
  assert.match(document.querySelector('[data-slot="range-calendar-cell-indicator"]')!.className, /range-calendar__cell-indicator/);
  r.unmount();
});

test("range-calendar: parts outside a RangeCalendar get only their own class", () => {
  const r = render(() => <RangeCalendar.Header class="x">h</RangeCalendar.Header>);
  assert.equal(document.querySelector('[data-slot="range-calendar-header"]')!.getAttribute("class"), "x");
  r.unmount();
});
