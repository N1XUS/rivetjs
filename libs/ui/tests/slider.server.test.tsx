// Server-target suite: `Slider` SSR markup (upstream slider.ssr case + classes, data-slots, stepped positions, output, disabled; T21 shorthand = the compound HTML).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Slider, sliderVariants } from "../src/components/slider/index.ts";
import { Label } from "../src/components/label/index.ts";
import { assertSameHtml } from "./same-html.ts";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("upstream SSR: renders without hydration mismatch with a default value", async () => {
  const html = await renderToString(() => (
    <Slider data-testid="slider" defaultValue={30}>
      <Label>Volume</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  ));
  assert.match(html, /data-slot="slider"/);
  assert.match(html, /data-slot="slider-thumb"/);
  const slots = sliderVariants({});
  for (const c of [slots.base(), slots.output(), slots.track(), slots.fill(), slots.thumb()]) assert.match(html, new RegExp(`class="${esc(c)}"`));
  assert.match(html, /data-orientation="horizontal"/);
  assert.match(html, /<output[^>]*>30<\/output>/);
  assert.match(html, /type="range"[^>]*/);
  assert.match(html, /value="30"/);
  assert.match(html, /width:\s*30%/);
  assert.match(html, /data-fill-start="true"/);
  assert.doesNotMatch(html, /data-fill-end/);
});

test("SSR: range output joined with an en dash; fill between the thumbs; disabled", async () => {
  const html = await renderToString(() => (
    <Slider defaultValue={[100, 500]} maxValue={1000} isDisabled>
      <Label>Price</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb index={0} />
        <Slider.Thumb index={1} />
        <Slider.Marks />
      </Slider.Track>
    </Slider>
  ));
  assert.match(html, /<output[^>]*>100 – 500<\/output>/);
  assert.match(html, /inset-inline-start:\s*10%/);
  assert.match(html, /width:\s*40%/);
  assert.match(html, /data-slot="slider-track"[^>]*data-disabled="true"|data-disabled="true"[^>]*data-slot="slider-track"/);
  assert.match(html, new RegExp(`class="${esc(sliderVariants({}).marks())}" data-slot="slider-marks"`));
  assert.doesNotMatch(html, /data-snapping/);
});

test("SSR: vertical", async () => {
  const html = await renderToString(() => (
    <Slider defaultValue={30} orientation="vertical" aria-label="v">
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  ));
  assert.match(html, /data-orientation="vertical"/);
  assert.match(html, /height:\s*30%/);
});

test("shorthand SSR (T21): Slider label without children = Label, Output, Track(Fill, Thumb); an array value gets two thumbs", async () => {
  await assertSameHtml(
    () => <Slider defaultValue={30} label="Volume" />,
    () => (
      <Slider defaultValue={30}>
        <Label>Volume</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    ),
  );
  await assertSameHtml(
    () => <Slider defaultValue={[20, 60]} label="Range" />,
    () => (
      <Slider defaultValue={[20, 60]}>
        <Label>Range</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Track>
      </Slider>
    ),
  );
});
