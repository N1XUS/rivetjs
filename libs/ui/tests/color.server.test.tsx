// Server-target suite: color components SSR (upstream tests/components/{color-field,color-picker}/*.ssr.test.tsx: a fixed color value /
// a closed picker render without errors) — data-slots, the hex input value, the closed trigger. Rivet: swatch / area / slider /
// swatch picker markup; `Color` instances reach the cdk parts as strings (resumable captures), so the HTML carries no resume error.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { parseColor } from "@rivetjs/cdk/color";
import { ColorArea } from "../src/components/color-area/index.ts";
import { ColorField } from "../src/components/color-field/index.ts";
import { ColorPicker } from "../src/components/color-picker/index.ts";
import { ColorSlider } from "../src/components/color-slider/index.ts";
import { ColorSwatch } from "../src/components/color-swatch/index.ts";
import { ColorSwatchPicker } from "../src/components/color-swatch-picker/index.ts";
import { Label } from "../src/components/label/index.ts";

test("color-field SSR: fixed color value", async () => {
  const html = await renderToString(() => (
    <ColorField defaultValue={parseColor("#0485F7")} name="color">
      <Label>Color</Label>
      <ColorField.Group>
        <ColorField.Input />
      </ColorField.Group>
    </ColorField>
  ));
  assert.match(html, /data-slot="color-field"/);
  assert.match(html, /data-slot="color-input-group"/);
  assert.match(html, /#0485F7/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("color-picker SSR: closed trigger and fixed defaultValue", async () => {
  const html = await renderToString(() => (
    <ColorPicker defaultValue="#0485F7">
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>Pick a color</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover>
        <ColorArea aria-label="Color area" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider channel="hue" colorSpace="hsb">
          <Label>Hue</Label>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
      </ColorPicker.Popover>
    </ColorPicker>
  ));
  assert.match(html, /data-slot="color-picker"/);
  assert.match(html, /data-slot="color-picker-trigger"/);
  assert.doesNotMatch(html, /data-slot="color-picker-popover"/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});

test("color SSR: swatch, area, slider and swatch picker markup", async () => {
  const html = await renderToString(() => (
    <div>
      <ColorSwatch color={parseColor("#ff0000")} shape="square" />
      <ColorArea aria-label="Color" defaultValue={parseColor("hsl(200, 100%, 50%)")} showDots>
        <ColorArea.Thumb />
      </ColorArea>
      <ColorSlider channel="hue" defaultValue="hsl(120, 100%, 50%)">
        <Label>Hue</Label>
        <ColorSlider.Output />
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider>
      <ColorSwatchPicker aria-label="Presets" defaultValue="#22c55e">
        <ColorSwatchPicker.Item color="#ef4444">
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
        <ColorSwatchPicker.Item color="#22c55e">
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
      </ColorSwatchPicker>
    </div>
  ));
  assert.match(html, /color-swatch--square/);
  assert.match(html, /--color-swatch-current:\s*rgba\(255, 0, 0, 1\)/);
  assert.match(html, /color-area--show-dots/);
  assert.match(html, /--color-area-background/);
  assert.match(html, /data-slot="color-slider-output"[^>]*>120°/);
  assert.match(html, /--track-start-color/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /data-slot="color-swatch-picker-checkmark"/);
  assert.doesNotMatch(html, /resume-error|not serializable/);
});
