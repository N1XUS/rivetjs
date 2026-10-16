// DOM-target suite: `ColorPicker` (upstream tests/components/color-picker/color-picker.test.tsx ported to happy-dom): data-slots + BEM
// block, opening the popover (dialog with the area + hue slider) and Escape closing it, a ColorSwatchPicker item updating the color
// → onChange. Rivet: index exports, the trigger swatch follows the picker color, popover placement default,
// controlled Signal (two-way) shared by the trigger swatch and the popover parts. Fake timers → `flush()`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ColorPicker, ColorPickerRoot, ColorPickerTrigger, ColorPickerPopover, colorPickerVariants } = await import("../src/components/color-picker/index.ts");
const { ColorArea } = await import("../src/components/color-area/index.ts");
const { ColorSlider } = await import("../src/components/color-slider/index.ts");
const { ColorSwatch } = await import("../src/components/color-swatch/index.ts");
const { ColorSwatchPicker } = await import("../src/components/color-swatch-picker/index.ts");
const { Label } = await import("../src/components/label/index.ts");
type Color = import("@rivetjs/cdk/color").Color;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const escape = (el: Element) => el.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const trigger = () => slot("color-picker-trigger")!;

const presets = ["#ef4444", "#22c55e", "#3b82f6"];

const Picker = (props: Record<string, unknown>) => (
  <ColorPicker defaultValue="#0485F7" {...(props as object)}>
    <ColorPicker.Trigger>
      <ColorSwatch size="lg" />
      <Label>Pick a color</Label>
    </ColorPicker.Trigger>
    <ColorPicker.Popover>
      {props.withSwatches ? (
        <ColorSwatchPicker aria-label="Color presets" size="xs">
          {presets.map((preset) => (
            <ColorSwatchPicker.Item color={preset}>
              <ColorSwatchPicker.Swatch />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
      ) : null}
      <ColorArea aria-label="Color area" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
        <ColorArea.Thumb />
      </ColorArea>
      <ColorSlider channel="hue" colorSpace="hsb">
        <Label>Hue</Label>
        <ColorSlider.Output />
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
    </ColorPicker.Popover>
  </ColorPicker>
);

test("color-picker: index exports", () => {
  assert.equal(ColorPicker, ColorPickerRoot);
  assert.equal(ColorPicker.Root, ColorPickerRoot);
  assert.equal(ColorPicker.Trigger, ColorPickerTrigger);
  assert.equal(ColorPicker.Popover, ColorPickerPopover);
  assert.equal(colorPickerVariants().base(), "color-picker");
});

test("color-picker: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Picker />);
  assert.match(slot("color-picker")!.className, /\bcolor-picker\b/);
  assert.match(trigger().className, /color-picker__trigger/);
  assert.equal(trigger().tagName, "BUTTON");
  unmount();
});

test("color-picker: the trigger swatch shows the picker color", () => {
  const { unmount } = render(() => <Picker />);
  const swatch = trigger().querySelector<HTMLElement>('[data-slot="color-swatch"]')!;
  assert.match(swatch.className, /color-swatch--lg/);
  assert.equal(swatch.style.getPropertyValue("--color-swatch-current"), "rgba(4, 133, 247, 1)");
  unmount();
});

test("color-picker: supports opening and closing the popover", async () => {
  const { unmount } = render(() => <Picker />);
  press(trigger());
  await flush();
  const popover = slot("color-picker-popover")!;
  assert.ok(popover);
  assert.match(popover.className, /color-picker__popover/);
  assert.equal(popover.getAttribute("data-placement"), "bottom");
  assert.ok(document.querySelector("[role=dialog]"));
  assert.match(document.body.textContent ?? "", /Hue/);
  assert.ok(slot("color-area"));
  escape(document.querySelector("[role=dialog]") ?? popover);
  await flush();
  await flush();
  assert.equal(slot("color-picker-popover"), null);
  unmount();
});

test("color-picker: supports updating color via ColorSwatchPicker item", async () => {
  const calls: Color[] = [];
  const { unmount } = render(() => <Picker withSwatches onChange={(c: Color) => calls.push(c)} />);
  press(trigger());
  await flush();
  const options = [...document.querySelectorAll("[role=option]")];
  assert.ok(options.length > 0);
  press(options[1]!);
  await flush();
  assert.ok(calls.length > 0);
  assert.equal(calls[0]!.toString("hex").toLowerCase(), "#22c55e");
  unmount();
});

test("color-picker: controlled value Signal drives the trigger swatch", async () => {
  const value = signal<string>("#ff0000");
  const { unmount } = render(() => <Picker defaultValue={undefined} value={value} />);
  const swatch = () => trigger().querySelector<HTMLElement>('[data-slot="color-swatch"]')!;
  assert.equal(swatch().style.getPropertyValue("--color-swatch-current"), "rgba(255, 0, 0, 1)");
  value.set("#00ff00");
  await flush();
  assert.equal(swatch().style.getPropertyValue("--color-swatch-current"), "rgba(0, 255, 0, 1)");
  unmount();
});
