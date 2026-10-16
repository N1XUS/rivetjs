// Server-target suite: `RangeCalendar` SSR (upstream tests/components/range-calendar/range-calendar.ssr.test.tsx: controlled range view
// + year picker open render without errors) — data-slots / classes, aria-multiselectable, range start / end attributes and the inner
// cell button's data-selected in the HTML; `defaultYearPickerOpen` renders the year grid open; week view modifier.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CalendarDate } from "@rivetjs/cdk/date";
import { RangeCalendar } from "../src/components/range-calendar/index.ts";

const MIN_VALUE = new CalendarDate(2020, 1, 1);
const MAX_VALUE = new CalendarDate(2030, 12, 31);

const RangeCalendarExample = (props: { defaultYearPickerOpen?: boolean; weeks?: number }) => (
  <RangeCalendar
    aria-label="Trip dates"
    defaultValue={{ start: new CalendarDate(2026, 8, 10), end: new CalendarDate(2026, 8, 15) }}
    defaultYearPickerOpen={props.defaultYearPickerOpen}
    maxValue={MAX_VALUE}
    minValue={MIN_VALUE}
    visibleDuration={props.weeks ? { weeks: props.weeks } : undefined}
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
      <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
    </RangeCalendar.Grid>
    <RangeCalendar.YearPickerGrid>
      <RangeCalendar.YearPickerGridBody>{({ year }) => <RangeCalendar.YearPickerCell year={year} />}</RangeCalendar.YearPickerGridBody>
    </RangeCalendar.YearPickerGrid>
  </RangeCalendar>
);

test("range-calendar SSR: range view", async () => {
  const html = await renderToString(() => <RangeCalendarExample />);
  assert.match(html, /data-slot="range-calendar"/);
  assert.match(html, /class="range-calendar"/);
  assert.match(html, /aria-multiselectable="true"/);
  assert.match(html, /data-selection-start="true"/);
  assert.match(html, /data-selection-end="true"/);
  assert.match(html, /class="range-calendar__cell-button"/);
  assert.match(html, /data-slot="range-calendar-cell-button"[^>]*data-selected="true"|data-selected="true"[^>]*data-slot="range-calendar-cell-button"/);
  assert.equal((html.match(/data-slot="range-calendar-nav-button-icon"/g) ?? []).length, 2);
});

test("range-calendar SSR: year picker open (defaultYearPickerOpen)", async () => {
  const html = await renderToString(() => <RangeCalendarExample defaultYearPickerOpen />);
  assert.match(html, /data-slot="calendar-year-picker-grid"/);
  assert.match(html, /data-open="true"/);
  assert.match(html, />2026</);
});

test("range-calendar SSR: week view", async () => {
  const html = await renderToString(() => <RangeCalendarExample weeks={2} />);
  assert.match(html, /range-calendar--week-view/);
});
