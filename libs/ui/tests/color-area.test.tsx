// DOM-target suite: `ColorArea` (upstream tests/components/color-area/color-area.test.tsx ported to happy-dom): 2D slider over two range
// inputs (the y input aria-hidden), data-slots + BEM block, `showDots` modifier, ArrowRight → onChange with a higher hue. Rivet: index
// exports, `--color-area-background` / `--color-area-thumb-color` custom properties, controlled Signal (two-way), live `showDots`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ColorArea, ColorAreaRoot, ColorAreaThumb, colorAreaVariants } = await import("../src/components/color-area/index.ts");
type Color = import("@rivetjs/cdk/color").Color;

const flush = () => new Promise((r) => setTimeout(r, 20));
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const inputs = () => [...document.querySelectorAll<HTMLInputElement>("input[type=range]")];

const Area = (props: Record<string, unknown>) => (
  <ColorArea aria-label="Color" defaultValue="hsl(200, 100%, 50%)" {...props}>
    <ColorArea.Thumb />
  </ColorArea>
);

async function press(el: HTMLElement, key: string) {
  el.focus();
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await flush();
}

test("color-area: index exports", () => {
  assert.equal(ColorArea, ColorAreaRoot);
  assert.equal(ColorArea.Root, ColorAreaRoot);
  assert.equal(ColorArea.Thumb, ColorAreaThumb);
  assert.equal(colorAreaVariants().base(), "color-area");
});

test("color-area: renders an accessible 2D slider backed by two range inputs", () => {
  const { unmount } = render(() => <Area />);
  assert.equal(inputs().length, 2);
  // y-channel is aria-hidden; only x-channel is exposed.
  assert.equal(inputs().filter((i) => i.getAttribute("aria-hidden") !== "true").length, 1);
  assert.equal(inputs()[0]!.getAttribute("aria-roledescription"), "2D slider");
  unmount();
});

test("color-area: exposes data-slot and BEM block", () => {
  const { unmount } = render(() => <Area />);
  assert.match(slot("color-area")!.className, /\bcolor-area\b/);
  assert.match(slot("color-area-thumb")!.className, /\bcolor-area__thumb\b/);
  unmount();
});

test("color-area: exposes showDots BEM modifier", () => {
  const { unmount } = render(() => <Area showDots />);
  assert.match(slot("color-area")!.className, /color-area--show-dots/);
  unmount();
});

test("color-area: live showDots toggles the modifier", async () => {
  const dots = signal(false);
  const { unmount } = render(() => <Area showDots={dots()} />);
  assert.doesNotMatch(slot("color-area")!.className, /show-dots/);
  dots.set(true);
  await flush();
  assert.match(slot("color-area")!.className, /color-area--show-dots/);
  unmount();
});

test("color-area: calls onChange with an updated color when adjusted via arrow keys", async () => {
  const calls: Color[] = [];
  const { unmount } = render(() => <Area defaultValue="hsl(200, 50%, 50%)" onChange={(c: Color) => calls.push(c)} />);
  await press(inputs()[0]!, "ArrowRight");
  assert.ok(calls.length > 0);
  const value = calls.at(-1)!;
  assert.ok(value.getChannelValue("hue") > 200);
  assert.notEqual(value.toString("hsl"), "hsl(200, 50%, 50%)");
  unmount();
});

test("color-area: sets the background / thumb color custom properties", () => {
  const { unmount } = render(() => <Area />);
  assert.ok(slot("color-area")!.style.getPropertyValue("--color-area-background").length > 0);
  assert.ok(slot("color-area-thumb")!.style.getPropertyValue("--color-area-thumb-color").length > 0);
  unmount();
});

test("color-area: controlled value Signal is two-way", async () => {
  const value = signal<string>("hsl(200, 50%, 50%)");
  const { unmount } = render(() => <Area defaultValue={undefined} value={value} />);
  await press(inputs()[0]!, "ArrowRight");
  assert.notEqual(value(), "hsl(200, 50%, 50%)");
  unmount();
});
