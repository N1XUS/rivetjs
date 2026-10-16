// DOM-target suite: `DateField` + `DateInputGroup` parts (upstream tests/components/date-field/date-field.test.tsx ported to happy-dom):
// spinbutton segments, data-slots + BEM block, Group variant modifier, fullWidth, ArrowUp / ArrowDown → onChange, typing digits builds a
// full date, controlled value (Rivet: a Signal of the string form — two-way — instead of a re-render), isRequired + FieldError,
// Description, isDisabled blocks changes, Prefix / Suffix. Rivet: parts outside a field (DateInputGroup standalone context), live
// `fullWidth`. Keyboard input = `keydown` / `beforeinput` events on the focused segment (what user-event dispatches). Skipped: "focus-visible
// via keyboard" (`user.tab()` needs real focus navigation: `tests-components/date-field.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CalendarDate } = await import("@rivetjs/cdk/date");
const { DateField, DateFieldRoot, dateFieldVariants } = await import("../src/components/date-field/index.ts");
const { DateInputGroup, DateInputGroupRoot, dateInputGroupVariants } = await import("../src/components/date-input-group/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

const Fixture = (props: Record<string, unknown>) => (
  <DateField name="date" {...props}>
    <Label>Date</Label>
    <DateField.Group>
      <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
    </DateField.Group>
  </DateField>
);

const segments = () => [...document.querySelectorAll<HTMLElement>("[role=spinbutton]")];
const segment = (name: RegExp) => segments().find((s) => name.test(s.getAttribute("aria-label") ?? ""))!;
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

async function press(el: HTMLElement, key: string) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await flush();
}
async function type(el: HTMLElement, text: string) {
  el.focus();
  for (const ch of text) {
    const target = (document.activeElement as HTMLElement) ?? el;
    target.dispatchEvent(new InputEvent("beforeinput", { data: ch, inputType: "insertText", bubbles: true, cancelable: true }));
    await flush();
  }
}

test("date-field: index exports", () => {
  assert.equal(DateField, DateFieldRoot);
  assert.equal(DateField.Root, DateFieldRoot);
  assert.equal(DateField.Group, DateInputGroupRoot);
  assert.equal(DateInputGroup, DateInputGroupRoot);
  assert.equal(DateField.Segment, DateInputGroup.Segment);
  assert.equal(dateFieldVariants(), "date-field");
  assert.equal(dateInputGroupVariants().base(), "date-input-group date-input-group--primary");
});

test("date-field: renders segmented spinbuttons for month, day, and year", () => {
  const { unmount } = render(() => <Fixture defaultValue={new CalendarDate(2026, 8, 15)} />);
  assert.equal(segments().length, 3);
  assert.equal(segment(/month/i).textContent, "8");
  assert.equal(segment(/day/i).textContent, "15");
  assert.equal(segment(/year/i).textContent, "2026");
  unmount();
});

test("date-field: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Fixture />);
  assert.match(slot("date-field")!.className, /\bdate-field\b/);
  assert.ok(slot("date-input-group"));
  assert.ok(slot("date-input-group-input"));
  assert.equal(document.querySelectorAll('[data-slot="date-input-group-segment"][role="spinbutton"]').length, 3);
  assert.match(slot("date-input-group")!.className, /\bdate-input-group\b/);
  assert.match(slot("date-input-group-input")!.className, /\bdate-input-group__input\b/);
  assert.match(document.querySelector<HTMLElement>('[data-slot="date-input-group-segment"]')!.className, /date-input-group__segment/);
  unmount();
});

test("date-field: exposes variant BEM modifier on Group", () => {
  const { unmount } = render(() => (
    <DateField name="date">
      <Label>Date</Label>
      <DateField.Group variant="secondary">
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
    </DateField>
  ));
  assert.match(slot("date-input-group")!.className, /date-input-group--secondary/);
  unmount();
});

test("date-field: supports fullWidth prop as a BEM modifier", () => {
  const { unmount } = render(() => <Fixture fullWidth />);
  assert.match(slot("date-field")!.className, /date-field--full-width/);
  unmount();
});

test("date-field: live fullWidth toggles the modifier", async () => {
  const full = signal(false);
  const { unmount } = render(() => <Fixture fullWidth={full()} />);
  assert.doesNotMatch(slot("date-field")!.className, /full-width/);
  full.set(true);
  await flush();
  assert.match(slot("date-field")!.className, /date-field--full-width/);
  unmount();
});

test("date-field: calls onChange when a segment is incremented or decremented", async () => {
  const calls: string[] = [];
  const { unmount } = render(() => (
    <Fixture defaultValue={new CalendarDate(2026, 8, 15)} onChange={(v: { toString(): string } | null) => calls.push(String(v))} />
  ));
  const day = segment(/day/i);
  await press(day, "ArrowUp");
  assert.equal(calls.at(-1), "2026-08-16");
  await press(day, "ArrowDown");
  assert.equal(calls.at(-1), "2026-08-15");
  unmount();
});

test("date-field: supports typing digits into segments to build a full date", async () => {
  const calls: string[] = [];
  const { unmount } = render(() => <Fixture onChange={(v: { toString(): string } | null) => calls.push(String(v))} />);
  await type(segment(/month/i), "01022026");
  assert.ok(calls.length > 0);
  assert.equal(calls.at(-1), "2026-01-02");
  unmount();
});

test("date-field: supports controlled value (Signal)", async () => {
  const value = signal<string | null>("2026-08-15");
  const { unmount } = render(() => <Fixture value={value} />);
  assert.equal(segment(/year/i).textContent, "2026");
  value.set("2027-01-01");
  await flush();
  assert.equal(segment(/year/i).textContent, "2027");
  assert.equal(segment(/month/i).textContent, "1");
  await press(segment(/day/i), "ArrowUp");
  assert.equal(value(), "2027-01-02");
  unmount();
});

test("date-field: supports isRequired and shows FieldError when isInvalid", () => {
  const { unmount } = render(() => (
    <DateField isInvalid isRequired name="date">
      <Label>Date</Label>
      <DateField.Group>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
      <FieldError>Please enter a valid date</FieldError>
    </DateField>
  ));
  assert.equal(slot("date-field")!.getAttribute("data-required"), "true");
  assert.match(document.body.textContent ?? "", /Please enter a valid date/);
  assert.equal(slot("date-input-group")!.getAttribute("data-invalid"), "true");
  unmount();
});

test("date-field: exposes accessible description via Description", () => {
  const { unmount } = render(() => (
    <DateField name="date">
      <Label>Date</Label>
      <DateField.Group>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.Group>
      <Description>Enter a date</Description>
    </DateField>
  ));
  assert.ok(slot("description"));
  assert.match(document.body.textContent ?? "", /Enter a date/);
  unmount();
});

test("date-field: supports disabled state and blocks value changes", async () => {
  const calls: unknown[] = [];
  const { unmount } = render(() => <Fixture defaultValue={new CalendarDate(2026, 8, 15)} isDisabled onChange={(v: unknown) => calls.push(v)} />);
  await press(segment(/day/i), "ArrowUp");
  assert.equal(calls.length, 0);
  assert.equal(segment(/day/i).textContent, "15");
  unmount();
});

test("date-field: supports prefix and suffix composition data-slots", () => {
  const { unmount } = render(() => (
    <DateField name="date">
      <Label>Date</Label>
      <DateField.Group>
        <DateField.Prefix>
          <span>prefix</span>
        </DateField.Prefix>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <span>suffix</span>
        </DateField.Suffix>
      </DateField.Group>
    </DateField>
  ));
  assert.match(slot("date-input-group-prefix")!.className, /date-input-group__prefix/);
  assert.match(slot("date-input-group-suffix")!.className, /date-input-group__suffix/);
  unmount();
});

test("date-field: InputContainer wraps the input", () => {
  const { unmount } = render(() => (
    <DateField name="date" aria-label="Date">
      <DateField.Group>
        <DateField.InputContainer>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        </DateField.InputContainer>
      </DateField.Group>
    </DateField>
  ));
  const container = slot("date-input-group-input-container")!;
  assert.match(container.className, /date-input-group__input-container/);
  assert.ok(container.querySelector('[data-slot="date-input-group-input"]'));
  unmount();
});

test("date-field: class merges onto every part", () => {
  const { unmount } = render(() => (
    <DateField name="date" aria-label="Date" class="w-64">
      <DateField.Group class="g">
        <DateField.Input class="i">{(segment) => <DateField.Segment class="s" segment={segment} />}</DateField.Input>
      </DateField.Group>
    </DateField>
  ));
  assert.match(slot("date-field")!.className, /\bw-64\b/);
  assert.match(slot("date-input-group")!.className, /\bg\b/);
  assert.match(slot("date-input-group-input")!.className, /\bi\b/);
  assert.match(slot("date-input-group-segment")!.className, /\bs\b/);
  unmount();
});
