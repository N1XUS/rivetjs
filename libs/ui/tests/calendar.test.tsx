// DOM-target suite: `Calendar` + `CalendarYearPicker` (upstream tests/components/calendar/calendar.test.tsx ported to happy-dom): grid
// name, data-slots + BEM block, selected day (`aria-selected` / `data-selected`), onChange, controlled value (Rivet: a Signal — two-way —
// instead of a re-render), ArrowRight focus, isDisabled, day view (`visibleDuration: { days: 7 }`), nav buttons, year picker open / select
// / data-selected / Escape. Rivet: context reads (parts outside a Calendar get only their own class), live `isYearPickerOpen` signal,
// default nav icons, CellIndicator, render-function children of the trigger. Skipped: "focus-visible via keyboard" (`user.tab()` needs
// real focus navigation: `tests-components/calendar.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CalendarDate } = await import("@rivetjs/cdk/date");
const { Calendar, CalendarRoot, calendarVariants, YearPickerContext, useYearPicker } = await import("../src/components/calendar/index.ts");
const { CalendarYearPicker } = await import("../src/components/calendar-year-picker/index.ts");

type DateValue = InstanceType<typeof CalendarDate>;
const MIN_VALUE = new CalendarDate(2020, 1, 1);
const MAX_VALUE = new CalendarDate(2030, 12, 31);
const flush = () => new Promise((r) => setTimeout(r, 20));

const Fixture = (props: Record<string, unknown>) => (
  <Calendar aria-label="Event date" defaultValue={new CalendarDate(2026, 8, 15)} maxValue={MAX_VALUE} minValue={MIN_VALUE} {...props}>
    <Calendar.Header>
      <Calendar.YearPickerTrigger>
        <Calendar.YearPickerTriggerHeading />
        <Calendar.YearPickerTriggerIndicator />
      </Calendar.YearPickerTrigger>
      <Calendar.NavButton slot="previous" />
      <Calendar.NavButton slot="next" />
    </Calendar.Header>
    <Calendar.Grid>
      <Calendar.GridHeader>{(day: string) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
      <Calendar.GridBody>{(date: DateValue) => <Calendar.Cell date={date as never} />}</Calendar.GridBody>
    </Calendar.Grid>
    <Calendar.YearPickerGrid>
      <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
    </Calendar.YearPickerGrid>
  </Calendar>
);

const dayCell = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=button]")].find((b) => (b.getAttribute("aria-label") ?? "").includes(label)) ?? null;
const grid = () => document.querySelector<HTMLElement>("[role=grid]")!;
const trigger = () => [...document.querySelectorAll<HTMLElement>("button")].find((b) => /year selector/.test(b.getAttribute("aria-label") ?? ""))!;
const yearGrid = () => document.querySelector<HTMLElement>('[data-slot="calendar-year-picker-grid"]')!;
const yearButton = (year: string) => [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === year) ?? null;

test("calendar: index exports", () => {
  assert.equal(Calendar, CalendarRoot);
  assert.equal(Calendar.Root, CalendarRoot);
  assert.equal(Calendar.YearPickerTrigger, CalendarYearPicker.Trigger);
  assert.equal(calendarVariants().base(), "calendar");
  assert.ok(YearPickerContext);
  assert.equal(typeof useYearPicker, "function");
});

test("calendar: renders a grid with an accessible name", () => {
  const r = render(() => <Fixture />);
  assert.match(grid().getAttribute("aria-label") ?? "", /Event date/);
  r.unmount();
});

test("calendar: exposes data-slots and BEM block", () => {
  const r = render(() => <Fixture />);
  assert.match(document.querySelector('[data-slot="calendar"]')!.className, /\bcalendar\b/);
  for (const [slot, cls] of [
    ["calendar-header", "calendar__header"],
    ["calendar-grid", "calendar__grid"],
    ["calendar-grid-header", "calendar__grid-header"],
    ["calendar-grid-body", "calendar__grid-body"],
    ["calendar-header-cell", "calendar__header-cell"],
    ["calendar-nav-button", "calendar__nav-button"],
    ["calendar-year-picker-trigger", "calendar-year-picker__trigger"],
    ["calendar-year-picker-trigger-heading", "calendar-year-picker__trigger-heading"],
    ["calendar-year-picker-trigger-indicator", "calendar-year-picker__trigger-indicator"],
    ["calendar-year-picker-grid", "calendar-year-picker__year-grid"],
  ]) {
    const el = document.querySelector(`[data-slot="${slot}"]`);
    assert.ok(el, slot);
    assert.match(el.getAttribute("class") ?? "", new RegExp(cls!), slot);
  }
  assert.ok(document.querySelectorAll('[data-slot="calendar-cell"]').length > 0);
  assert.match(document.querySelector('[data-slot="calendar-cell"]')!.className, /calendar__cell/);
  // Default nav icons (lucide chevrons) carry the icon slot.
  assert.equal(document.querySelectorAll('[data-slot="calendar-nav-button-icon"]').length, 2);
  assert.match(document.querySelector('[data-slot="calendar-nav-button-icon"]')!.getAttribute("class") ?? "", /calendar__nav-button-icon/);
  r.unmount();
});

test("calendar: exposes aria-selected and data-selected on the selected day", () => {
  const r = render(() => <Fixture />);
  const selected = dayCell("August 15, 2026")!;
  assert.equal(selected.closest('[role="gridcell"]')!.getAttribute("aria-selected"), "true");
  assert.equal(selected.getAttribute("data-selected"), "true");
  r.unmount();
});

test("calendar: calls onChange when selecting a new day", async () => {
  const calls: string[] = [];
  const r = render(() => <Fixture onChange={(v: DateValue) => calls.push(v.toString())} />);
  dayCell("August 20, 2026")!.click();
  await flush();
  assert.deepEqual(calls, ["2026-08-20"]);
  r.unmount();
});

test("calendar: supports a controlled value (cdk: a Signal of the date string, two-way)", async () => {
  const value = signal<string | null>("2026-08-15");
  const r = render(() => (
    <Calendar aria-label="Event date" maxValue={MAX_VALUE} minValue={MIN_VALUE} value={value as never}>
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day: string) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date: DateValue) => <Calendar.Cell date={date as never} />}</Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  ));
  assert.equal(dayCell("August 15, 2026")!.getAttribute("data-selected"), "true");
  assert.match(document.querySelector('[data-slot="calendar-heading"]')!.className, /calendar__heading/);
  value.set("2026-08-20");
  await flush();
  assert.equal(dayCell("August 20, 2026")!.getAttribute("data-selected"), "true");
  assert.equal(dayCell("August 15, 2026")!.getAttribute("data-selected"), null);
  r.unmount();
});

test("calendar: ArrowRight moves focus to the next day", async () => {
  const r = render(() => <Fixture />);
  const current = dayCell("August 15, 2026")!;
  current.focus();
  await flush();
  current.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  await flush();
  assert.match(document.activeElement?.getAttribute("aria-label") ?? "", /August 16, 2026/);
  r.unmount();
});

test("calendar: isDisabled blocks day selection", async () => {
  const calls: unknown[] = [];
  const r = render(() => <Fixture isDisabled onChange={(v: unknown) => calls.push(v)} />);
  assert.equal(document.querySelector('[data-slot="calendar"]')!.getAttribute("data-disabled"), "true");
  dayCell("August 20, 2026")!.click();
  await flush();
  assert.deepEqual(calls, []);
  r.unmount();
});

test("calendar: day view renders a weekday header and the visible days", () => {
  const r = render(() => <Fixture visibleDuration={{ days: 7 }} />);
  assert.match(document.querySelector('[data-slot="calendar"]')!.className, /calendar--day-view/);
  assert.equal(document.querySelectorAll('[data-slot="calendar-grid-header"] th').length, 7);
  // The visible range is centered on the selected day, so its edges prove the range reached the day view grid.
  assert.ok(dayCell("August 12, 2026"));
  assert.ok(dayCell("August 15, 2026"));
  assert.ok(dayCell("August 18, 2026"));
  r.unmount();
});

test("calendar: week view modifier", () => {
  const r = render(() => <Fixture visibleDuration={{ weeks: 1 }} />);
  assert.match(document.querySelector('[data-slot="calendar"]')!.className, /calendar--week-view/);
  r.unmount();
});

test("calendar: next and previous month via NavButton", async () => {
  const r = render(() => <Fixture />);
  assert.match(grid().getAttribute("aria-label") ?? "", /August 2026/);
  document.querySelector<HTMLElement>('[data-slot="calendar-nav-button"][slot="next"]')!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /September 2026/);
  document.querySelector<HTMLElement>('[data-slot="calendar-nav-button"][slot="previous"]')!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /August 2026/);
  r.unmount();
});

test("calendar year picker: opens from the trigger", async () => {
  const r = render(() => <Fixture />);
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(yearGrid().getAttribute("aria-hidden"), "true");
  assert.match(document.querySelector('[data-slot="calendar-year-picker-trigger-heading"]')!.textContent ?? "", /August 2026/);
  trigger().click();
  await flush();
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  assert.equal(trigger().getAttribute("data-open"), "true");
  assert.notEqual(yearGrid().getAttribute("aria-hidden"), "true");
  assert.equal(yearGrid().getAttribute("data-open"), "true");
  r.unmount();
});

test("calendar year picker: selecting a year closes the picker", async () => {
  const r = render(() => <Fixture />);
  trigger().click();
  await flush();
  yearButton("2028")!.click();
  await flush();
  assert.match(grid().getAttribute("aria-label") ?? "", /2028/);
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(yearGrid().getAttribute("aria-hidden"), "true");
  r.unmount();
});

test("calendar year picker: data-selected on the focused year, one tab stop while open", async () => {
  const r = render(() => <Fixture />);
  trigger().click();
  await flush();
  const y2026 = yearButton("2026")!;
  assert.equal(y2026.getAttribute("data-selected"), "true");
  assert.equal(y2026.getAttribute("aria-selected"), "true");
  assert.equal(y2026.getAttribute("data-slot"), "calendar-year-picker-year-cell");
  assert.match(y2026.className, /calendar-year-picker__year-cell/);
  assert.equal(y2026.getAttribute("tabindex"), null);
  assert.equal(yearButton("2027")!.getAttribute("tabindex"), "-1");
  assert.equal(yearButton("2027")!.getAttribute("aria-selected"), "false");
  r.unmount();
});

test("calendar year picker: Escape closes", async () => {
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

test("calendar year picker: arrow keys move the active year (3 columns)", async () => {
  const r = render(() => <Fixture />);
  trigger().click();
  await flush();
  yearGrid().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  await flush();
  assert.equal(yearButton("2029")!.getAttribute("tabindex"), null);
  assert.equal(yearButton("2026")!.getAttribute("tabindex"), "-1");
  r.unmount();
});

test("calendar year picker: controlled isYearPickerOpen signal (two-way)", async () => {
  const open = signal(false);
  const r = render(() => <Fixture isYearPickerOpen={open} />);
  assert.equal(yearGrid().getAttribute("data-open"), null);
  open.set(true);
  await flush();
  assert.equal(yearGrid().getAttribute("data-open"), "true");
  trigger().click();
  await flush();
  assert.equal(open(), false);
  r.unmount();
});

test("calendar year picker: trigger render-function children get { isOpen, monthYear, toggle }", async () => {
  const r = render(() => (
    <Calendar aria-label="Event date" defaultValue={new CalendarDate(2026, 8, 15)}>
      <Calendar.Header>
        <Calendar.YearPickerTrigger>{(values) => <span id="probe">{() => `${values.monthYear}|${values.isOpen}`}</span>}</Calendar.YearPickerTrigger>
      </Calendar.Header>
      <Calendar.Grid>{(date: DateValue) => <Calendar.Cell date={date as never} />}</Calendar.Grid>
    </Calendar>
  ));
  assert.equal(document.getElementById("probe")!.textContent, "August 2026|false");
  trigger().click();
  await flush();
  assert.equal(document.getElementById("probe")!.textContent, "August 2026|true");
  r.unmount();
});

test("calendar: parts outside a Calendar get only their own class; CellIndicator", () => {
  const r = render(() => (
    <div>
      <Calendar.Header class="own">x</Calendar.Header>
      <Calendar aria-label="d" defaultValue={new CalendarDate(2026, 8, 15)}>
        <Calendar.Grid>
          {(date: DateValue) => (
            <Calendar.Cell date={date as never}>
              <Calendar.CellIndicator />
            </Calendar.Cell>
          )}
        </Calendar.Grid>
      </Calendar>
    </div>
  ));
  assert.equal(document.querySelector('[data-slot="calendar-header"]')!.getAttribute("class"), "own");
  const ind = document.querySelector('[data-slot="calendar-cell-indicator"]')!;
  assert.equal(ind.getAttribute("class"), "calendar__cell-indicator");
  assert.equal(ind.getAttribute("aria-hidden"), "true");
  r.unmount();
});
