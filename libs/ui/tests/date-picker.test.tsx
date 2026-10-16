// DOM-target suite: `DatePicker` + `DateRangePicker` (upstream tests/components/{date-picker,date-range-picker}/*.test.tsx ported to
// happy-dom): data-slots + BEM block, trigger / range separator, opening the calendar popover (dialog, nav buttons) and Escape closing it,
// onChange from a calendar cell (single date; range start + end). Rivet: index exports, parts outside a picker, default trigger icon,
// controlled string / `{ start, end }` signals, onOpenChange forwarded through the focus-restore wrapper, live class.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CalendarDate } = await import("@rivetjs/cdk/date");
const { DatePicker, DatePickerRoot, datePickerVariants } = await import("../src/components/date-picker/index.ts");
const { DateRangePicker, DateRangePickerRoot, dateRangePickerVariants } = await import("../src/components/date-range-picker/index.ts");
const { DateField } = await import("../src/components/date-field/index.ts");
const { Calendar } = await import("../src/components/calendar/index.ts");
const { RangeCalendar } = await import("../src/components/range-calendar/index.ts");
const { Label } = await import("../src/components/label/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

const Picker = (props: Record<string, unknown>) => (
  <DatePicker data-testid="date-picker" name="date" {...props}>
    <Label>Date</Label>
    <DateField.Group>
      <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      <DateField.Suffix>
        <DatePicker.Trigger aria-label="Open calendar">
          <DatePicker.TriggerIndicator />
        </DatePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    <DatePicker.Popover>
      <Calendar aria-label="Selected date">
        <Calendar.Header>
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
          <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </DatePicker.Popover>
  </DatePicker>
);

const RangePicker = (props: Record<string, unknown>) => (
  <DateRangePicker data-testid="date-range-picker" endName="end" startName="start" {...props}>
    <Label>Trip dates</Label>
    <DateField.Group>
      <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      <DateRangePicker.RangeSeparator />
      <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      <DateField.Suffix>
        <DateRangePicker.Trigger aria-label="Open calendar">
          <DateRangePicker.TriggerIndicator />
        </DateRangePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
    <DateRangePicker.Popover>
      <RangeCalendar aria-label="Trip dates">
        <RangeCalendar.Header>
          <RangeCalendar.Heading />
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </RangeCalendar>
    </DateRangePicker.Popover>
  </DateRangePicker>
);

const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => [...document.querySelectorAll<HTMLElement>("button")].find((b) => /Open calendar/.test(b.getAttribute("aria-label") ?? ""))!;
const buttonNamed = (name: string) => [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === name) ?? null;
const dayCell = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=button]")].find((b) => (b.getAttribute("aria-label") ?? "").includes(label)) ?? null;
const escape = (el: Element) =>
  el.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

test("date-picker: index exports", () => {
  assert.equal(DatePicker, DatePickerRoot);
  assert.equal(DatePicker.Root, DatePickerRoot);
  assert.equal(DateRangePicker, DateRangePickerRoot);
  assert.equal(typeof DateRangePicker.RangeSeparator, "function");
  assert.equal(datePickerVariants().base(), "date-picker");
  assert.equal(dateRangePickerVariants().rangeSeparator(), "date-range-picker__range-separator");
});

test("date-picker: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Picker />);
  const root = byTestId("date-picker");
  assert.equal(root.getAttribute("data-slot"), "date-picker");
  assert.match(root.className, /\bdate-picker\b/);
  assert.match(slot("date-picker-trigger")!.className, /date-picker__trigger/);
  const indicator = slot("date-picker-trigger-indicator")!;
  assert.match(indicator.className, /date-picker__trigger-indicator/);
  assert.equal(indicator.getAttribute("aria-hidden"), "true");
  assert.ok(indicator.querySelector("svg"), "default lucide Calendar icon");
  unmount();
});

test("date-picker: supports opening and closing the calendar popover", async () => {
  const calls: boolean[] = [];
  const { unmount } = render(() => <Picker onOpenChange={(o: boolean) => calls.push(o)} />);
  trigger().click();
  await flush();
  const popover = slot("date-picker-popover");
  assert.ok(popover);
  assert.match(popover.className, /date-picker__popover/);
  assert.ok(document.querySelector("[role=dialog]"));
  assert.ok(buttonNamed("Previous"));
  escape(document.querySelector("[role=dialog]") ?? popover);
  await flush();
  await flush();
  assert.equal(slot("date-picker-popover"), null);
  assert.deepEqual(calls, [true, false]);
  unmount();
});

test("date-picker: calls onChange when a calendar date is selected", async () => {
  const calls: string[] = [];
  const { unmount } = render(() => (
    <Picker defaultValue={new CalendarDate(2026, 8, 1)} onChange={(v: { toString(): string } | null) => calls.push(String(v))} />
  ));
  trigger().click();
  await flush();
  dayCell("August 15, 2026")!.click();
  await flush();
  assert.equal(calls.at(-1), "2026-08-15");
  unmount();
});

test("date-picker: controlled value (Signal)", async () => {
  const value = signal<string | null>("2026-08-01");
  const { unmount } = render(() => <Picker value={value} />);
  const year = () => [...document.querySelectorAll<HTMLElement>("[role=spinbutton]")].find((s) => s.getAttribute("data-type") === "year")!;
  assert.equal(year().textContent, "2026");
  trigger().click();
  await flush();
  dayCell("August 20, 2026")!.click();
  await flush();
  assert.equal(value(), "2026-08-20");
  value.set("2027-01-05");
  await flush();
  assert.equal(year().textContent, "2027");
  unmount();
});

test("date-picker: parts outside a picker get only their own class", () => {
  const { unmount } = render(() => (
    <div>
      <DatePicker.TriggerIndicator class="x" />
    </div>
  ));
  assert.equal(slot("date-picker-trigger-indicator")!.className, "x");
  unmount();
});

test("date-range-picker: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <RangePicker />);
  const root = byTestId("date-range-picker");
  assert.equal(root.getAttribute("data-slot"), "date-range-picker");
  assert.match(root.className, /\bdate-range-picker\b/);
  assert.ok(slot("date-range-picker-trigger"));
  const sep = slot("date-range-picker-range-separator")!;
  assert.match(sep.className, /date-range-picker__range-separator/);
  assert.equal(sep.textContent, " - ");
  unmount();
});

test("date-range-picker: supports opening and closing the range calendar popover", async () => {
  const { unmount } = render(() => <RangePicker />);
  trigger().click();
  await flush();
  assert.ok(slot("date-range-picker-popover"));
  assert.ok(document.querySelector("[role=dialog]"));
  assert.ok(buttonNamed("Previous"));
  escape(document.querySelector("[role=dialog]") ?? slot("date-range-picker-popover")!);
  await flush();
  await flush();
  assert.equal(slot("date-range-picker-popover"), null);
  unmount();
});

test("date-range-picker: calls onChange when a date range is selected", async () => {
  const calls: string[] = [];
  const { unmount } = render(() => (
    <RangePicker
      defaultValue={{ start: new CalendarDate(2026, 8, 1), end: new CalendarDate(2026, 8, 5) }}
      onChange={(v: { start: { toString(): string }; end: { toString(): string } } | null) => calls.push(`${v?.start}/${v?.end}`)}
    />
  ));
  trigger().click();
  await flush();
  dayCell("August 10, 2026")!.click();
  await flush();
  dayCell("August 12, 2026")!.click();
  await flush();
  assert.equal(calls.at(-1), "2026-08-10/2026-08-12");
  unmount();
});
