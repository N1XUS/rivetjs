// DOM-target suite: `ColorSlider` (upstream tests/components/color-slider/color-slider.test.tsx ported to happy-dom): slider named by the
// composed Label, data-slots + BEM block, ArrowRight → onChange with a higher hue, isDisabled blocks keys. Rivet: index exports, default
// Output text (thumb value label), track checkerboard + edge colors, disabled thumb drops its background color, invalid
// channel / colorSpace combination auto-corrected, controlled Signal (two-way).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ColorSlider, ColorSliderRoot, ColorSliderOutput, ColorSliderTrack, ColorSliderThumb, colorSliderVariants } =
  await import("../src/components/color-slider/index.ts");
const { Label } = await import("../src/components/label/index.ts");
type Color = import("@rivetjs/cdk/color").Color;

const flush = () => new Promise((r) => setTimeout(r, 20));
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const input = () => document.querySelector<HTMLInputElement>("input[type=range]")!;

const Slider = (props: Record<string, unknown>) => (
  <ColorSlider channel="hue" colorSpace="hsl" defaultValue="hsl(0, 100%, 50%)" {...(props as object)}>
    <Label>Hue</Label>
    <ColorSlider.Output />
    <ColorSlider.Track>
      <ColorSlider.Thumb />
    </ColorSlider.Track>
  </ColorSlider>
);

async function press(el: HTMLElement, key: string) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await flush();
}

test("color-slider: index exports", () => {
  assert.equal(ColorSlider, ColorSliderRoot);
  assert.equal(ColorSlider.Root, ColorSliderRoot);
  assert.equal(ColorSlider.Output, ColorSliderOutput);
  assert.equal(ColorSlider.Track, ColorSliderTrack);
  assert.equal(ColorSlider.Thumb, ColorSliderThumb);
  assert.equal(colorSliderVariants().base(), "color-slider");
});

test("color-slider: renders a slider thumb with accessible name from composed Label", () => {
  const { unmount } = render(() => <Slider />);
  const label = document.querySelector("label")!;
  assert.equal(label.textContent, "Hue");
  const labelledBy = input().getAttribute("aria-labelledby") ?? "";
  assert.ok(labelledBy.split(" ").includes(label.id));
  unmount();
});

test("color-slider: exposes data-slots and BEM block", () => {
  const { unmount } = render(() => <Slider />);
  assert.match(slot("color-slider")!.className, /\bcolor-slider\b/);
  assert.match(slot("color-slider-track")!.className, /color-slider__track/);
  assert.match(slot("color-slider-thumb")!.className, /color-slider__thumb/);
  assert.match(slot("color-slider-output")!.className, /color-slider__output/);
  assert.equal(slot("color-slider")!.getAttribute("data-orientation"), "horizontal");
  unmount();
});

test("color-slider: calls onChange with an updated hue when the channel is adjusted via arrow keys", async () => {
  const calls: Color[] = [];
  const { unmount } = render(() => <Slider onChange={(c: Color) => calls.push(c)} />);
  await press(input(), "ArrowRight");
  assert.ok(calls.length > 0);
  assert.ok(calls.at(-1)!.getChannelValue("hue") > 0);
  assert.equal(slot("color-slider-output")!.textContent, "1°");
  unmount();
});

test("color-slider: supports disabled state and blocks keyboard interaction", async () => {
  const calls: Color[] = [];
  const { unmount } = render(() => <Slider isDisabled onChange={(c: Color) => calls.push(c)} />);
  await press(input(), "ArrowRight");
  assert.equal(calls.length, 0);
  assert.equal(slot("color-slider-thumb")!.style.backgroundColor, "");
  unmount();
});

test("color-slider: Output shows the thumb value label by default", () => {
  const { unmount } = render(() => <Slider defaultValue="hsl(120, 100%, 50%)" />);
  assert.equal(slot("color-slider-output")!.textContent, "120°");
  unmount();
});

test("color-slider: track gets the gradient, checkerboard and edge colors", () => {
  const { unmount } = render(() => <Slider channel="alpha" defaultValue="hsla(0, 100%, 50%, 0.5)" />);
  const track = slot("color-slider-track")!;
  // happy-dom keeps only the last layer of a multi-layer `background` (the gradient layer: Chromium story `tests-components/color.test.ts`).
  assert.match(track.style.background, /repeating-conic-gradient/);
  assert.equal(track.style.getPropertyValue("--track-start-color"), "hsla(0, 100%, 50%, 0)");
  assert.equal(track.style.getPropertyValue("--track-end-color"), "hsla(0, 100%, 50%, 1)");
  unmount();
});

test("color-slider: auto-corrects an invalid channel / colorSpace combination", () => {
  const { unmount } = render(() => <Slider channel="red" colorSpace={"hsl" as never} defaultValue="rgb(10, 20, 30)" />);
  // red requires rgb: the channel range is 0–255.
  assert.equal(input().max, "255");
  assert.equal(input().value, "10");
  unmount();
});

test("color-slider: controlled value Signal is two-way", async () => {
  const value = signal("hsl(10, 100%, 50%)");
  const { unmount } = render(() => (
    <ColorSlider channel="hue" value={value}>
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </ColorSlider>
  ));
  await press(input(), "ArrowRight");
  assert.equal(value(), "hsla(11, 100%, 50%, 1)");
  unmount();
});
