// Server-target suite: `TimePicker` (Rivet addition) SSR — closed picker = TimeField markup + trigger (no popover, no drums, no
// resume error); `defaultOpen` renders the popover with the drums resumably; standalone Wheels inside a TimeField.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { TimePicker } from "../src/components/time-picker/index.ts";
import { TimeField } from "../src/components/time-field/index.ts";
import { Label } from "../src/components/label/index.ts";

const Picker = (props: { defaultOpen?: boolean }) => (
  <I18nProvider locale="en-US">
    <TimePicker defaultValue="07:30:00" defaultOpen={props.defaultOpen}>
      <Label>Alarm</Label>
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        <TimeField.Suffix>
          <TimePicker.Trigger aria-label="Choose time">
            <TimePicker.TriggerIndicator />
          </TimePicker.Trigger>
        </TimeField.Suffix>
      </TimeField.Group>
      <TimePicker.Popover>{() => <TimePicker.Wheels />}</TimePicker.Popover>
    </TimePicker>
  </I18nProvider>
);

test("time-picker SSR: closed picker renders the field + trigger only", async () => {
  const html = await renderToString(() => <Picker />);
  assert.match(html, /data-slot="time-picker"/);
  assert.match(html, /class="[^"]*\btime-picker\b/);
  assert.match(html, /data-slot="time-picker-trigger"[^>]*|class="[^"]*time-picker__trigger/);
  assert.match(html, /aria-label="Choose time"/);
  assert.match(html, /role="spinbutton"/);
  assert.doesNotMatch(html, /time-picker__wheels|time-picker__popover/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("time-picker SSR: defaultOpen renders the drums", async () => {
  const html = await renderToString(() => <Picker defaultOpen />);
  assert.match(html, /time-picker__popover/);
  assert.match(html, /class="time-picker__wheels"[^>]*role="group"/);
  assert.match(html, /class="time-picker__wheel"[^>]*role="spinbutton"[^>]*aria-label="hour"[^>]*aria-valuenow="7"/);
  assert.match(html, /aria-valuetext="AM"/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("time-picker SSR: Wheels in a plain TimeField", async () => {
  const html = await renderToString(() => (
    <I18nProvider locale="de-DE">
      <TimeField aria-label="Zeit" defaultValue="18:05:00">
        <TimePicker.Wheels minuteStep={5} />
      </TimeField>
    </I18nProvider>
  ));
  assert.match(html, /aria-valuenow="18"/);
  assert.doesNotMatch(html, /aria-valuetext="(AM|PM)"/);
  assert.equal((html.match(/class="time-picker__item"/g) ?? []).length, 24 + 12);
});
