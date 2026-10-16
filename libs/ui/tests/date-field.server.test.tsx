// Server-target suite: `DateField` / `TimeField` SSR (upstream tests/components/{date,time}-field/*.ssr.test.tsx: controlled value +
// invalid required field with FieldError render without errors) — data-slots, spinbuttons, value text, `data-required`, the error
// message. Rivet: date / time instances reach the cdk field as strings (resumable captures), so the HTML carries no resume error.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CalendarDate, Time } from "@rivetjs/cdk/date";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { DateField } from "../src/components/date-field/index.ts";
import { TimeField } from "../src/components/time-field/index.ts";
import { Description } from "../src/components/description/index.ts";
import { FieldError } from "../src/components/field-error/index.ts";
import { Label } from "../src/components/label/index.ts";

test("date-field SSR: controlled value", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <DateField name="date" value={new CalendarDate(2026, 8, 15)}>
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <Description>Enter a date</Description>
      </DateField>
    </I18nProvider>
  ));
  assert.match(html, /data-slot="date-field"/);
  assert.match(html, /data-slot="date-input-group"/);
  assert.match(html, /role="spinbutton"/);
  assert.match(html, /2026/);
  assert.match(html, /Enter a date/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("date-field SSR: invalid, required field with FieldError", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <DateField isInvalid isRequired name="date" value={new CalendarDate(2026, 8, 15)}>
        <Label>Date</Label>
        <DateField.Group>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.Group>
        <FieldError>Please enter a valid date</FieldError>
      </DateField>
    </I18nProvider>
  ));
  assert.match(html, /data-required="true"/);
  assert.match(html, /Please enter a valid date/);
});

test("time-field SSR: controlled value", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <TimeField name="time" value={new Time(9, 30)}>
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <Description>Enter a time</Description>
      </TimeField>
    </I18nProvider>
  ));
  assert.match(html, /data-slot="time-field"/);
  assert.match(html, /data-slot="date-input-group"/);
  assert.match(html, /role="spinbutton"/);
  assert.match(html, />30</);
  assert.match(html, />AM</);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("time-field SSR: invalid, required field with FieldError", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="en-US">
      <TimeField isInvalid isRequired name="time" value={new Time(9, 30)}>
        <Label>Time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        </TimeField.Group>
        <FieldError>Please enter a valid time</FieldError>
      </TimeField>
    </I18nProvider>
  ));
  assert.match(html, /data-required="true"/);
  assert.match(html, /Please enter a valid time/);
});
