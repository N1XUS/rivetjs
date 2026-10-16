// Server-target suite: `Calendar` SSR (upstream tests/components/calendar/calendar.ssr.test.tsx: month view + year picker open render
// without errors) — data-slots / classes / grid in the HTML; `defaultYearPickerOpen` renders the year grid open (`data-open="true"`,
// years listed, the focused year selected); day view; RangeCalendar-free parts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CalendarDate } from "@rivetjs/cdk/date";
import { Calendar } from "../src/components/calendar/index.ts";

const MIN_VALUE = new CalendarDate(2020, 1, 1);
const MAX_VALUE = new CalendarDate(2030, 12, 31);

const CalendarExample = (props: { defaultYearPickerOpen?: boolean; days?: number }) => (
  <Calendar
    aria-label="Event date"
    defaultValue={new CalendarDate(2026, 8, 15)}
    defaultYearPickerOpen={props.defaultYearPickerOpen}
    maxValue={MAX_VALUE}
    minValue={MIN_VALUE}
    visibleDuration={props.days ? { days: props.days } : undefined}
  >
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
      <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
    </Calendar.Grid>
    <Calendar.YearPickerGrid>
      <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
    </Calendar.YearPickerGrid>
  </Calendar>
);

test("calendar SSR: month view", async () => {
  const html = await renderToString(() => <CalendarExample />);
  assert.match(html, /data-slot="calendar"/);
  assert.match(html, /class="calendar"/);
  assert.match(html, /role="grid"/);
  assert.match(html, /data-slot="calendar-cell"/);
  assert.match(html, /class="calendar__cell"/);
  assert.match(html, /data-slot="calendar-year-picker-trigger"[^>]*|aria-label="August 2026, year selector"/);
  assert.match(html, /August 2026, year selector/);
  assert.match(html, /data-slot="calendar-year-picker-grid"/);
  assert.match(html, /aria-hidden="true"[^>]*data-slot="calendar-year-picker-grid"|data-slot="calendar-year-picker-grid"[^>]*aria-hidden="true"/);
  assert.equal((html.match(/data-slot="calendar-nav-button-icon"/g) ?? []).length, 2);
});

test("calendar SSR: year picker open (defaultYearPickerOpen)", async () => {
  const html = await renderToString(() => <CalendarExample defaultYearPickerOpen />);
  assert.match(html, /data-slot="calendar-year-picker-grid"/);
  assert.match(html, /data-open="true"/);
  assert.match(html, /aria-label="2026"[^>]*data-selected="true"|data-selected="true"[^>]*aria-label="2026"|aria-selected="true"/);
  assert.match(html, />2026</);
  assert.match(html, />2030</);
});

test("calendar SSR: day view", async () => {
  const html = await renderToString(() => <CalendarExample days={7} />);
  assert.match(html, /calendar--day-view/);
  assert.match(html, /August 12, 2026/);
  assert.match(html, /August 18, 2026/);
});
