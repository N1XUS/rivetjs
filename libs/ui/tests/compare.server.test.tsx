// Server-target suite: `Compare` SSR (Rivet-authored; HeroUI v3.2.6 / HeroUI Pro have no compare): BEM classes + data-slots
// on every part over the cdk markup (after layer clipped inline, handle = ARIA slider at the value), default handle
// (divider + thumb with the lucide grip icon), labels with placement, vertical (up / down icon, top inset), `class` merged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Compare } from "../src/components/compare/index.ts";

const Fixture = (props: { orientation?: "horizontal" | "vertical"; defaultValue?: number }) => (
  <Compare id="c" class="w-80" defaultValue={props.defaultValue} orientation={props.orientation}>
    <Compare.Before>
      <img src="/before.jpg" alt="Before" />
      <Compare.Label>Before</Compare.Label>
    </Compare.Before>
    <Compare.After>
      <img src="/after.jpg" alt="After" />
      <Compare.Label placement="end">After</Compare.Label>
    </Compare.After>
    <Compare.Handle />
  </Compare>
);

test("compare SSR: parts, classes, slider handle at the default value", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /<div[^>]*data-slot="compare"[^>]*>/);
  assert.match(html, /class="compare w-80"/);
  assert.match(html, /data-rv-compare=""/);
  assert.match(html, /--rv-compare-position:50%/);
  assert.match(html, /class="compare__before"/);
  assert.match(html, /data-slot="compare-before"/);
  assert.match(html, /class="compare__after"[^>]*style="[^"]*clip-path:inset\(0 0 0 50%\)|clip-path:inset\(0 0 0 50%\)[^"]*"[^>]*class="compare__after"/);
  assert.match(html, /role="slider"/);
  assert.match(html, /class="compare__handle"/);
  assert.match(html, /aria-label="Comparison position"/);
  assert.match(html, /aria-valuenow="50"/);
  assert.match(html, /aria-valuetext="50%"/);
  assert.match(html, /<span[^>]*class="compare__divider"[^>]*aria-hidden="true"/);
  assert.match(html, /<span[^>]*data-slot="compare-thumb"[^>]*aria-hidden="true"[^>]*class="compare__thumb"/);
  assert.match(html, /compare__thumb[^]*<svg[^>]*lucide-chevrons-left-right|compare__thumb[^]*<svg/);
  assert.match(html, /<span[^>]*data-slot="compare-label"[^>]*data-placement="start"[^>]*data-orientation="horizontal"[^>]*class="compare__label"[^>]*>Before/);
  assert.match(html, /data-placement="end"[^>]*>After/);
});

test("compare SSR: vertical", async () => {
  const html = await renderToString(() => <Fixture orientation="vertical" defaultValue={30} />);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(html, /clip-path:inset\(30% 0 0 0\)/);
  assert.match(html, /top:30%/);
  assert.match(html, /data-orientation="vertical"[^>]*class="compare__label"/);
});
