// DOM-target suite: `ColorSwatchPicker` (upstream tests/components/color-swatch-picker/color-swatch-picker.test.tsx ported to happy-dom):
// listbox of options, data-slots + BEM block, default `grid` layout modifier, selecting a swatch → onChange. Rivet: index exports,
// size / variant / stack layout modifiers, default lucide checkmark indicator + `data-light-color`, function indicator child (item
// render props), item `--color-swatch-current`, controlled Signal (two-way).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ColorSwatchPicker, ColorSwatchPickerRoot, ColorSwatchPickerItem, ColorSwatchPickerSwatch, ColorSwatchPickerIndicator, colorSwatchPickerVariants } =
  await import("../src/components/color-swatch-picker/index.ts");
type Color = import("@rivetjs/cdk/color").Color;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const options = () => [...document.querySelectorAll<HTMLElement>("[role=option]")];

const colors = ["#ef4444", "#22c55e", "#3b82f6"];

const Picker = (props: Record<string, unknown>) => (
  <ColorSwatchPicker aria-label="Color presets" {...props}>
    {colors.map((color) => (
      <ColorSwatchPicker.Item color={color}>
        <ColorSwatchPicker.Swatch />
        <ColorSwatchPicker.Indicator />
      </ColorSwatchPicker.Item>
    ))}
  </ColorSwatchPicker>
);

test("color-swatch-picker: index exports", () => {
  assert.equal(ColorSwatchPicker, ColorSwatchPickerRoot);
  assert.equal(ColorSwatchPicker.Root, ColorSwatchPickerRoot);
  assert.equal(ColorSwatchPicker.Item, ColorSwatchPickerItem);
  assert.equal(ColorSwatchPicker.Swatch, ColorSwatchPickerSwatch);
  assert.equal(ColorSwatchPicker.Indicator, ColorSwatchPickerIndicator);
  assert.equal(colorSwatchPickerVariants().base(), "color-swatch-picker color-swatch-picker--grid color-swatch-picker--md color-swatch-picker--circle");
});

test("color-swatch-picker: renders a listbox of color options", () => {
  const { unmount } = render(() => <Picker />);
  const listbox = document.querySelector("[role=listbox]")!;
  assert.equal(listbox.getAttribute("aria-label"), "Color presets");
  assert.equal(options().length, 3);
  unmount();
});

test("color-swatch-picker: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Picker />);
  assert.match(slot("color-swatch-picker")!.className, /\bcolor-swatch-picker\b/);
  assert.match(slot("color-swatch-picker-item")!.className, /color-swatch-picker__item/);
  assert.match(slot("color-swatch-picker-swatch")!.className, /color-swatch-picker__swatch/);
  assert.match(slot("color-swatch-picker-indicator")!.className, /color-swatch-picker__indicator/);
  unmount();
});

test("color-swatch-picker: exposes default layout BEM modifier", () => {
  const { unmount } = render(() => <Picker />);
  assert.match(slot("color-swatch-picker")!.className, /color-swatch-picker--grid/);
  unmount();
});

test("color-swatch-picker: layout / size / variant modifiers", () => {
  const { unmount } = render(() => <Picker layout="stack" size="xl" variant="square" />);
  const cls = slot("color-swatch-picker")!.className;
  assert.match(cls, /color-swatch-picker--stack/);
  assert.match(cls, /color-swatch-picker--xl/);
  assert.match(cls, /color-swatch-picker--square/);
  unmount();
});

test("color-swatch-picker: calls onChange when selecting a swatch", async () => {
  const calls: Color[] = [];
  const { unmount } = render(() => <Picker onChange={(c: Color) => calls.push(c)} />);
  press(options()[1]!);
  await flush();
  assert.ok(calls.length > 0);
  assert.equal(calls[0]!.toString("hex").toLowerCase(), "#22c55e");
  assert.equal(options()[1]!.getAttribute("aria-selected"), "true");
  unmount();
});

test("color-swatch-picker: default indicator is a lucide checkmark; data-light-color follows luminance", () => {
  const { unmount } = render(() => (
    <ColorSwatchPicker aria-label="Presets">
      <ColorSwatchPicker.Item color="#000000">
        <ColorSwatchPicker.Indicator />
      </ColorSwatchPicker.Item>
      <ColorSwatchPicker.Item color="#ffffff">
        <ColorSwatchPicker.Indicator />
      </ColorSwatchPicker.Item>
    </ColorSwatchPicker>
  ));
  const indicators = [...document.querySelectorAll<HTMLElement>('[data-slot="color-swatch-picker-indicator"]')];
  assert.equal(indicators[0]!.getAttribute("aria-hidden"), "true");
  assert.ok(indicators[0]!.querySelector('svg[data-slot="color-swatch-picker-checkmark"]'));
  assert.equal(indicators[0]!.getAttribute("data-light-color"), null);
  assert.equal(indicators[1]!.getAttribute("data-light-color"), "true");
  unmount();
});

test("color-swatch-picker: function indicator child gets the item render props", async () => {
  const { unmount } = render(() => (
    <ColorSwatchPicker aria-label="Presets" defaultValue="#22c55e">
      {colors.map((color) => (
        <ColorSwatchPicker.Item color={color}>
          <ColorSwatchPicker.Indicator>{({ isSelected }) => (isSelected() ? "on" : "off")}</ColorSwatchPicker.Indicator>
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
  ));
  const texts = () => [...document.querySelectorAll('[data-slot="color-swatch-picker-indicator"]')].map((e) => e.textContent);
  assert.deepEqual(texts(), ["off", "on", "off"]);
  press(options()[2]!);
  await flush();
  assert.deepEqual(texts(), ["off", "off", "on"]);
  unmount();
});

test("color-swatch-picker: item sets --color-swatch-current", () => {
  const { unmount } = render(() => <Picker />);
  assert.equal(slot("color-swatch-picker-item")!.style.getPropertyValue("--color-swatch-current"), "rgba(239, 68, 68, 1)");
  unmount();
});

test("color-swatch-picker: controlled value Signal is two-way", async () => {
  const value = signal<string>("#ef4444");
  const { unmount } = render(() => <Picker value={value} />);
  assert.equal(options()[0]!.getAttribute("aria-selected"), "true");
  press(options()[2]!);
  await flush();
  assert.equal(value(), "rgba(59, 130, 246, 1)");
  value.set("#22c55e");
  await flush();
  assert.equal(options()[1]!.getAttribute("aria-selected"), "true");
  unmount();
});
