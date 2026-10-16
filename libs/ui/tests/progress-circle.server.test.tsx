// Server-target suite: `ProgressCircle` SSR markup (upstream tests/components/progress-circle/progress-circle.test.tsx cases that read
// markup). Ring geometry = upstream constants (r 16, stroke 4, circumference 2π·16); classes from the vendored `progressCircleVariants`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ProgressCircle, progressCircleVariants } from "../src/components/progress-circle/index.ts";

const tag = (html: string, slot: string): string => html.match(new RegExp(`<[a-z]+ [^>]*data-slot="${slot}"[^>]*>`))?.[0] ?? "";
const attr = (el: string, name: string): string | undefined => el.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const C = 2 * Math.PI * 16;

const circle = (props: { value?: number; isIndeterminate?: boolean }) => (
  <ProgressCircle aria-label="Loading" {...props}>
    <ProgressCircle.Track>
      <ProgressCircle.TrackCircle />
      <ProgressCircle.FillCircle />
    </ProgressCircle.Track>
  </ProgressCircle>
);

test("progress-circle SSR: role, parts' tags / data-slot / class, svg geometry from upstream numbers", async () => {
  const html = await renderToString(() => circle({ value: 60 }));
  const slots = progressCircleVariants({});
  const root = tag(html, "progress-circle");
  assert.equal(attr(root, "role"), "progressbar");
  assert.equal(attr(root, "aria-label"), "Loading");
  assert.equal(attr(root, "class"), slots.base());
  const track = tag(html, "progress-circle-track");
  assert.ok(track.startsWith("<svg"));
  assert.equal(attr(track, "class"), slots.track());
  assert.equal(attr(track, "viewBox"), "0 0 36 36");
  assert.equal(attr(track, "fill"), "none");
  const trackCircle = tag(html, "progress-circle-track-circle");
  assert.ok(trackCircle.startsWith("<circle"));
  assert.equal(attr(trackCircle, "class"), slots.trackCircle());
  for (const [name, value] of [
    ["cx", "18"],
    ["cy", "18"],
    ["r", "16"],
    ["stroke-width", "4"],
  ])
    assert.equal(attr(trackCircle, name), value, name);
  const fill = tag(html, "progress-circle-fill-circle");
  assert.equal(attr(fill, "class"), slots.fillCircle());
  assert.equal(Number(attr(fill, "stroke-dasharray")), C);
  assert.equal(Number(attr(fill, "stroke-dashoffset")), C - 0.6 * C);
  assert.equal(attr(fill, "stroke-linecap"), "round");
  assert.equal(attr(fill, "stroke-width"), "4");
  assert.equal(attr(fill, "transform"), "rotate(-90 18 18)");
});

test("progress-circle SSR: indeterminate → a quarter ring (offset 0.75·C), no aria-valuenow", async () => {
  const html = await renderToString(() => circle({ isIndeterminate: true }));
  assert.equal(attr(tag(html, "progress-circle"), "aria-valuenow"), undefined);
  assert.equal(Number(attr(tag(html, "progress-circle-fill-circle"), "stroke-dashoffset")), C * 0.75);
});

test("progress-circle SSR: color / size BEM modifiers, class + data-* passthrough", async () => {
  for (const color of ["default", "accent", "success", "warning", "danger"] as const)
    for (const size of ["sm", "md", "lg"] as const) {
      const html = await renderToString(() => (
        <ProgressCircle aria-label="Loading" color={color} size={size} class="x" data-foo="bar" value={50}>
          <ProgressCircle.Track>
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      ));
      const root = tag(html, "progress-circle");
      assert.equal(attr(root, "class"), `${progressCircleVariants({ color, size }).base()} x`);
      assert.equal(attr(root, "data-foo"), "bar");
    }
});

test("progress-circle SSR: parts outside a ProgressCircle get only `class` (geometry kept)", async () => {
  const html = await renderToString(() => (
    <ProgressCircle.Track class="t">
      <ProgressCircle.FillCircle class="f" />
    </ProgressCircle.Track>
  ));
  assert.equal(attr(tag(html, "progress-circle-track"), "class"), "t");
  const fill = tag(html, "progress-circle-fill-circle");
  assert.equal(attr(fill, "class"), "f");
  assert.equal(Number(attr(fill, "stroke-dashoffset")), C);
});
