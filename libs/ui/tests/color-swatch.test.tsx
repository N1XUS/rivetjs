// DOM-target suite: `ColorSwatch` (upstream tests/components/color-swatch/color-swatch.test.tsx ported to happy-dom): img role, data-slot +
// BEM block, size / shape modifiers, `colorName` accessible name. Rivet: index exports, `--color-swatch-current` custom property, a
// `Color` instance reaching the cdk swatch as a string, accessor `color` (reactive), live `size`, user `style` merged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { parseColor } = await import("@rivetjs/cdk/color");
const { ColorSwatch, ColorSwatchRoot, colorSwatchVariants } = await import("../src/components/color-swatch/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const img = () => document.querySelector<HTMLElement>("[role=img]")!;

test("color-swatch: index exports", () => {
  assert.equal(ColorSwatch, ColorSwatchRoot);
  assert.equal(ColorSwatch.Root, ColorSwatchRoot);
  assert.equal(colorSwatchVariants(), "color-swatch color-swatch--circle color-swatch--md");
});

test("color-swatch: renders with img role", () => {
  const { unmount } = render(() => <ColorSwatch color="#0485F7" />);
  assert.ok(img());
  unmount();
});

test("color-swatch: exposes BEM block and data-slot", () => {
  const { unmount } = render(() => <ColorSwatch color="#0485F7" />);
  assert.equal(img().getAttribute("data-slot"), "color-swatch");
  assert.match(img().className, /\bcolor-swatch\b/);
  unmount();
});

test("color-swatch: exposes size and shape BEM modifiers", () => {
  const { unmount } = render(() => <ColorSwatch color="#0485F7" shape="square" size="lg" />);
  assert.match(img().className, /color-swatch--lg/);
  assert.match(img().className, /color-swatch--square/);
  unmount();
});

test("color-swatch: supports a custom accessible name via colorName", () => {
  const { unmount } = render(() => <ColorSwatch color="#0485F7" colorName="Brand blue" />);
  assert.equal(img().getAttribute("aria-label"), "Brand blue");
  unmount();
});

test("color-swatch: sets --color-swatch-current (Color instance prop) and merges the user style", () => {
  const { unmount } = render(() => <ColorSwatch color={parseColor("#ff0000")} style={{ width: "10px" }} />);
  assert.equal(img().style.getPropertyValue("--color-swatch-current"), "rgba(255, 0, 0, 1)");
  assert.equal(img().style.width, "10px");
  unmount();
});

test("color-swatch: accessor color and live size update in place", async () => {
  const color = signal("#ff0000");
  const size = signal<"sm" | "xl">("sm");
  const { unmount } = render(() => <ColorSwatch color={() => color()} size={size()} />);
  assert.match(img().className, /color-swatch--sm/);
  color.set("#00ff00");
  size.set("xl");
  await flush();
  assert.equal(img().style.getPropertyValue("--color-swatch-current"), "rgba(0, 255, 0, 1)");
  assert.match(img().className, /color-swatch--xl/);
  unmount();
});
