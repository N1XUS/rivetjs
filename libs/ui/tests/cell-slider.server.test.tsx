// Server-target suite: `CellSlider` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// SSR — cdk Slider root + variant modifier, track over the cell with fill + thumb (hidden range input), label wiring, output
// text (default value label, formatOptions), disabled.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CellSlider } from "../src/components/cell-slider/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("cell-slider SSR: parts, label, output, range input", async () => {
  const html = await renderToString(() => (
    <CellSlider defaultValue={40}>
      <CellSlider.Track>
        <CellSlider.Fill />
        <CellSlider.Thumb />
      </CellSlider.Track>
      <CellSlider.Label>Volume</CellSlider.Label>
      <CellSlider.Output />
    </CellSlider>
  ));
  assert.match(html, /class="cell-slider cell-slider--default"/);
  assert.match(html, /class="cell-slider__track"/);
  assert.match(html, /class="cell-slider__fill"/);
  assert.match(html, /class="cell-slider__thumb"/);
  const input = /<input[^>]*type="range"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(input, /value="40"/);
  const labelFor = /<label[^>]*class="cell-slider__label"[^>]*>|<label[^>]*data-slot="cell-slider-label"[^>]*>/.exec(html)?.[0] ?? "";
  assert.ok(labelFor);
  assert.match(html, /Volume<\/label>/);
  assert.match(html, /<output[^>]*class="cell-slider__output"[^>]*>(?:<!--[^>]*-->)*40/);
});

test("cell-slider SSR: secondary, formatOptions output, disabled", async () => {
  const html = await renderToString(() => (
    <CellSlider
      variant="secondary"
      defaultValue={0.3}
      minValue={0}
      maxValue={1}
      step={0.1}
      formatOptions={{ style: "percent" }}
      isDisabled
      aria-label="Opacity"
    >
      <CellSlider.Track>
        <CellSlider.Fill />
        <CellSlider.Thumb />
      </CellSlider.Track>
      <CellSlider.Output />
    </CellSlider>
  ));
  assert.match(html, /class="cell-slider cell-slider--secondary"/);
  assert.match(html, /data-disabled/);
  assert.match(html, /<output[^>]*>(?:<!--[^>]*-->)*30%/);
  assert.match(/<input[^>]*type="range"[^>]*>/.exec(html)?.[0] ?? "", /disabled/);
});

test("cell-slider SSR: shorthand (label, no children) = compound form", async () => {
  await assertSameHtml(
    () => <CellSlider defaultValue={40} label="Volume" />,
    () => (
      <CellSlider defaultValue={40}>
        <CellSlider.Track>
          <CellSlider.Fill />
          <CellSlider.Thumb />
        </CellSlider.Track>
        <CellSlider.Label>Volume</CellSlider.Label>
        <CellSlider.Output />
      </CellSlider>
    ),
  );
});
