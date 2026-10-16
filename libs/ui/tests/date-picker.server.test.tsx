// Server-target suite: `DatePicker` / `DateRangePicker` SSR (upstream tests/components/{date-picker,date-range-picker}/*.ssr.test.tsx:
// the closed trigger renders without errors) — data-slots, trigger, spinbuttons, the year; popover closed (not in the HTML).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CalendarDate } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Calendar } from "../src/components/calendar/index.ts";
import { DateField } from "../src/components/date-field/index.ts";
import { DatePicker } from "../src/components/date-picker/index.ts";
import { DateRangePicker } from "../src/components/date-range-picker/index.ts";
import { Label } from "../src/components/label/index.ts";
import { RangeCalendar } from "../src/components/range-calendar/index.ts";

test("date-picker SSR: closed trigger", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <DatePicker name="date" defaultValue={new CalendarDate(2026, 8, 15)}>
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
          <Calendar aria-label="Event date">
            <Calendar.Grid>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  ));
  assert.match(html, /data-slot="date-picker"/);
  assert.match(html, /class="date-picker"/);
  assert.match(html, /data-slot="date-picker-trigger"/);
  assert.match(html, /role="spinbutton"/);
  assert.match(html, /2026/);
  assert.doesNotMatch(html, /data-slot="date-picker-popover"/);
  assert.doesNotMatch(html, /not serializable/);
});

test("date-range-picker SSR: closed trigger + separator", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <DateRangePicker endName="end" startName="start" defaultValue={{ start: new CalendarDate(2026, 8, 1), end: new CalendarDate(2026, 8, 5) }}>
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
            <RangeCalendar.Grid>
              <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
            </RangeCalendar.Grid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>
    </I18nProvider>
  ));
  assert.match(html, /data-slot="date-range-picker"/);
  assert.match(html, /data-slot="date-range-picker-range-separator"/);
  assert.match(html, /date-range-picker__range-separator/);
  assert.match(html, /data-slot="date-range-picker-trigger"/);
  assert.equal((html.match(/role="spinbutton"/g) ?? []).length, 6);
  assert.doesNotMatch(html, /not serializable/);
});
