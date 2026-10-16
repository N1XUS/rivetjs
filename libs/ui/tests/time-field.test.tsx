// DOM-target suite: `TimeField` (upstream tests/components/time-field/time-field.test.tsx ported to happy-dom): hour / minute / AM-PM
// spinbuttons, data-slots + BEM block, fullWidth, minute ArrowUp / ArrowDown, AM/PM toggle, controlled value (Rivet: a Signal of the string
// form — two-way — instead of a re-render), isRequired + FieldError, Description, isDisabled, Prefix / Suffix. Keyboard input =
// `keydown` events on the focused segment. Skipped: "focus-visible via keyboard" (`user.tab()` needs real focus navigation:
// `tests-components/date-field.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Time } = await import("@rivetjs/cdk/date");
const { TimeField, TimeFieldRoot, timeFieldVariants } = await import("../src/components/time-field/index.ts");
const { DateInputGroupRoot } = await import("../src/components/date-input-group/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");

type TimeLike = { hour: number; minute: number } | null;
const flush = () => new Promise((r) => setTimeout(r, 20));

const Fixture = (props: Record<string, unknown>) => (
  <TimeField name="time" {...props}>
    <Label>Time</Label>
    <TimeField.Group>
      <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
    </TimeField.Group>
  </TimeField>
);

const segments = () => [...document.querySelectorAll<HTMLElement>("[role=spinbutton]")];
const segment = (name: RegExp) => segments().find((s) => name.test(s.getAttribute("aria-label") ?? ""))!;
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

async function press(el: HTMLElement, key: string) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await flush();
}
test("time-field: index exports", () => {
  assert.equal(TimeField, TimeFieldRoot);
  assert.equal(TimeField.Root, TimeFieldRoot);
  assert.equal(TimeField.Group, DateInputGroupRoot);
  assert.equal(timeFieldVariants(), "time-field");
});

test("time-field: renders segmented spinbuttons for hour, minute, and day period", () => {
  const { unmount } = render(() => <Fixture defaultValue={new Time(9, 30)} />);
  assert.equal(segments().length, 3);
  assert.equal(segment(/hour/i).textContent, "9");
  assert.equal(segment(/minute/i).textContent, "30");
  assert.equal(segment(/AM\/PM/i).textContent, "AM");
  unmount();
});

test("time-field: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Fixture />);
  assert.match(slot("time-field")!.className, /\btime-field\b/);
  assert.ok(slot("date-input-group"));
  assert.ok(slot("date-input-group-input"));
  assert.equal(document.querySelectorAll('[data-slot="date-input-group-segment"][role="spinbutton"]').length, 3);
  unmount();
});

test("time-field: supports fullWidth prop as a BEM modifier", () => {
  const { unmount } = render(() => <Fixture fullWidth />);
  assert.match(slot("time-field")!.className, /time-field--full-width/);
  unmount();
});

test("time-field: supports incrementing and decrementing the minute segment", async () => {
  const calls: TimeLike[] = [];
  const { unmount } = render(() => <Fixture defaultValue={new Time(9, 30)} onChange={(v: TimeLike) => calls.push(v)} />);
  const minute = segment(/minute/i);
  await press(minute, "ArrowUp");
  assert.equal(calls.at(-1)!.hour, 9);
  assert.equal(calls.at(-1)!.minute, 31);
  await press(minute, "ArrowDown");
  assert.equal(calls.at(-1)!.minute, 30);
  unmount();
});

test("time-field: supports toggling AM/PM on the day period segment", async () => {
  const calls: TimeLike[] = [];
  const { unmount } = render(() => <Fixture defaultValue={new Time(9, 30)} onChange={(v: TimeLike) => calls.push(v)} />);
  const dayPeriod = segment(/AM\/PM/i);
  await press(dayPeriod, "ArrowUp");
  assert.equal(calls.at(-1)!.hour, 21);
  assert.equal(dayPeriod.textContent, "PM");
  unmount();
});

test("time-field: supports controlled value (Signal)", async () => {
  const value = signal<string | null>("09:30:00");
  const { unmount } = render(() => <Fixture value={value} />);
  assert.equal(segment(/hour/i).textContent, "9");
  value.set("14:15:00");
  await flush();
  assert.equal(segment(/hour/i).textContent, "2");
  assert.equal(segment(/minute/i).textContent, "15");
  assert.equal(segment(/AM\/PM/i).textContent, "PM");
  unmount();
});

test("time-field: supports isRequired and shows FieldError when isInvalid", () => {
  const { unmount } = render(() => (
    <TimeField isInvalid isRequired name="time">
      <Label>Time</Label>
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      </TimeField.Group>
      <FieldError>Please enter a valid time</FieldError>
    </TimeField>
  ));
  assert.equal(slot("time-field")!.getAttribute("data-required"), "true");
  assert.match(document.body.textContent ?? "", /Please enter a valid time/);
  unmount();
});

test("time-field: exposes accessible description via Description", () => {
  const { unmount } = render(() => (
    <TimeField name="time">
      <Label>Time</Label>
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      </TimeField.Group>
      <Description>Enter a time</Description>
    </TimeField>
  ));
  assert.ok(slot("description"));
  assert.match(document.body.textContent ?? "", /Enter a time/);
  unmount();
});

test("time-field: supports disabled state and blocks value changes", async () => {
  const calls: unknown[] = [];
  const { unmount } = render(() => <Fixture defaultValue={new Time(9, 30)} isDisabled onChange={(v: unknown) => calls.push(v)} />);
  await press(segment(/minute/i), "ArrowUp");
  assert.equal(calls.length, 0);
  unmount();
});

test("time-field: supports prefix and suffix composition data-slots", () => {
  const { unmount } = render(() => (
    <TimeField name="time">
      <Label>Time</Label>
      <TimeField.Group>
        <TimeField.Prefix>
          <span>prefix</span>
        </TimeField.Prefix>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        <TimeField.Suffix>
          <span>suffix</span>
        </TimeField.Suffix>
      </TimeField.Group>
    </TimeField>
  ));
  assert.ok(slot("date-input-group-prefix"));
  assert.ok(slot("date-input-group-suffix"));
  unmount();
});
