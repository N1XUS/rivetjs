// DOM-target suite: `TimePicker` (Rivet addition, no HeroUI counterpart: TimeField + popover of wheel drums from
// `@rivetjs/cdk/time-wheels`). Index exports + variants, data-slots / BEM classes per part, default Clock indicator, the trigger
// opens the popover (dialog) with the default Wheels (slot classes, first drum focused) and Escape closes it, drum keys write the
// field value (segments follow) and segment keys move the drums, controlled string Signal + `isOpen` Signal, `minuteStep` on
// custom Wheels, a disabled field disables the trigger, parts outside a picker.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { I18nProvider } = await import("@rivetjs/cdk/i18n-provider");
const { TimePicker, TimePickerRoot, timePickerVariants } = await import("../src/components/time-picker/index.ts");
const { TimeField } = await import("../src/components/time-field/index.ts");
const { Label } = await import("../src/components/label/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

const Picker = (props: Record<string, unknown> & { wheels?: () => unknown }) => {
  const { wheels, ...rest } = props;
  return (
    <I18nProvider locale="en-US">
      <TimePicker data-testid="time-picker" id="tp" {...rest}>
        <Label>Alarm</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          <TimeField.Suffix>
            <TimePicker.Trigger aria-label="Choose time">
              <TimePicker.TriggerIndicator />
            </TimePicker.Trigger>
          </TimeField.Suffix>
        </TimeField.Group>
        {wheels ? <TimePicker.Popover>{wheels as never}</TimePicker.Popover> : <TimePicker.Popover />}
      </TimePicker>
    </I18nProvider>
  );
};

const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const trigger = () => slot("time-picker-trigger")!;
const drum = (type: string) => document.querySelector<HTMLElement>(`.time-picker__wheel[data-type="${type}"]`);
const segment = (type: string) => document.querySelector<HTMLElement>(`[role=spinbutton][data-type="${type}"]:not(.time-picker__wheel)`)!;
const key = (el: Element, k: string) =>
  el.dispatchEvent(new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

test("time-picker: index exports", () => {
  assert.equal(TimePicker, TimePickerRoot);
  assert.equal(TimePicker.Root, TimePickerRoot);
  for (const part of ["Trigger", "TriggerIndicator", "Popover", "Wheels"] as const) assert.equal(typeof TimePicker[part], "function");
  const slots = timePickerVariants();
  assert.equal(slots.base(), "time-picker");
  assert.equal(slots.popover(), "time-picker__popover");
  assert.equal(slots.wheels(), "time-picker__wheels");
  assert.equal(slots.wheel(), "time-picker__wheel");
  assert.equal(slots.item(), "time-picker__item");
});

test("time-picker: data-slots, BEM classes, default Clock indicator, closed popover renders nothing", () => {
  const { unmount } = render(() => <Picker defaultValue="07:30:00" />);
  const root = document.querySelector<HTMLElement>('[data-testid="time-picker"]')!;
  assert.equal(root.getAttribute("data-slot"), "time-picker");
  assert.match(root.className, /\btime-picker\b/);
  assert.match(root.className, /\btime-field\b/);
  assert.match(trigger().className, /time-picker__trigger/);
  const indicator = slot("time-picker-trigger-indicator")!;
  assert.match(indicator.className, /time-picker__trigger-indicator/);
  assert.equal(indicator.getAttribute("aria-hidden"), "true");
  assert.ok(indicator.querySelector("svg"), "lucide Clock");
  assert.equal(slot("time-picker-popover"), null);
  assert.equal(document.querySelector(".time-picker__wheels"), null);
  unmount();
});

test("time-picker: trigger opens the drums popover, first drum focused, Escape closes", async () => {
  const calls: boolean[] = [];
  const { unmount } = render(() => <Picker defaultValue="07:30:00" onOpenChange={(o: boolean) => calls.push(o)} />);
  trigger().click();
  await flush();
  const popover = slot("time-picker-popover")!;
  assert.ok(popover);
  assert.match(popover.className, /time-picker__popover/);
  assert.equal(popover.getAttribute("role"), "dialog");
  const wheels = popover.querySelector<HTMLElement>(".time-picker__wheels")!;
  assert.equal(wheels.getAttribute("role"), "group");
  assert.deepEqual(
    [...wheels.querySelectorAll(".time-picker__wheel")].map((w) => w.getAttribute("data-type")),
    ["hour", "minute", "dayPeriod"],
  );
  assert.equal(drum("hour")!.getAttribute("aria-valuenow"), "7");
  assert.equal(drum("minute")!.getAttribute("aria-valuetext"), "30");
  assert.ok(drum("minute")!.querySelector(".time-picker__item[data-selected]"));
  assert.equal(document.activeElement, drum("hour"), "first drum focused");
  key(document.activeElement!, "Escape");
  await flush();
  await flush();
  assert.equal(slot("time-picker-popover"), null);
  assert.deepEqual(calls, [true, false]);
  unmount();
});

test("time-picker: drums write the field value, segments move the drums (controlled Signal)", async () => {
  const value = signal<string | null>("07:30:00");
  const { unmount } = render(() => <Picker value={value} />);
  trigger().click();
  await flush();
  key(drum("minute")!, "ArrowUp");
  await flush();
  assert.equal(value(), "07:31:00");
  assert.equal(segment("minute").getAttribute("aria-valuetext"), "31");
  key(drum("dayPeriod")!, "ArrowUp");
  await flush();
  assert.equal(value(), "19:31:00");
  key(segment("hour"), "ArrowUp");
  await flush();
  assert.equal(value(), "20:31:00");
  assert.equal(drum("hour")!.getAttribute("aria-valuenow"), "8");
  value.set("23:59:00");
  await flush();
  assert.equal(drum("minute")!.getAttribute("aria-valuenow"), "59");
  key(drum("minute")!, "ArrowUp");
  await flush();
  assert.equal(value(), "23:00:00", "minute drum loops 59 → 00 (hour unchanged)");
  unmount();
});

test("time-picker: custom Wheels (minuteStep) + controlled isOpen Signal", async () => {
  const open = signal(true);
  const { unmount } = render(() => <Picker defaultValue="10:07:00" isOpen={open} wheels={() => <TimePicker.Wheels minuteStep={15} aria-label="Pick" />} />);
  await flush();
  const wheels = document.querySelector<HTMLElement>(".time-picker__wheels")!;
  assert.equal(wheels.getAttribute("aria-label"), "Pick");
  assert.equal(drum("minute")!.querySelectorAll(".time-picker__item").length, 4);
  assert.equal(drum("minute")!.getAttribute("aria-valuetext"), "00", "shows the step at or below the value");
  open.set(false);
  await flush();
  await flush();
  assert.equal(document.querySelector(".time-picker__wheels"), null);
  unmount();
});

test("time-picker: a disabled field disables the trigger", () => {
  const { unmount } = render(() => <Picker isDisabled defaultValue="07:30:00" />);
  assert.equal(trigger().hasAttribute("disabled") || trigger().getAttribute("data-disabled") === "true", true);
  unmount();
});

test("time-picker: parts outside a picker get only their own class; Wheels keep their slot classes", () => {
  const { unmount } = render(() => (
    <div>
      <TimePicker.TriggerIndicator class="x" />
      <TimeField aria-label="T" defaultValue="01:00:00">
        <TimePicker.Wheels class="w" />
      </TimeField>
    </div>
  ));
  assert.equal(slot("time-picker-trigger-indicator")!.className, "x");
  assert.match(document.querySelector<HTMLElement>("[role=group].time-picker__wheels")!.className, /time-picker__wheels w/);
  unmount();
});
