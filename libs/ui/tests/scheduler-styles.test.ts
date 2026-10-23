// Rivet-authored presentation contracts, followed by all six upstream stylesheet cases.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = () => readFileSync(new URL("../styles/components/scheduler.css", import.meta.url), "utf8");

test("scheduler styles: density supplies all five geometry tokens", () => {
  const source = css();
  for (const token of ["slot-height", "lane-height", "row-min-height", "column-min-width", "gutter"])
    assert.match(source, new RegExp(`--rv-scheduler-${token}:`));
  assert.match(source, /scheduler--compact/);
  assert.match(source, /scheduler--comfortable/);
});
test("scheduler styles: event semantic palette and custom CSS color", () => {
  const source = css();
  for (const tone of ["accent", "success", "warning", "danger", "default"]) assert.match(source, new RegExp(`var\\(--${tone}-soft`));
  assert.match(source, /var\(--rv-scheduler-event-color\)/);
});
test("scheduler styles: month spans, lanes and week-number column", () => {
  const source = css();
  assert.match(source, /var\(--rv-scheduler-span/);
  assert.match(source, /var\(--rv-scheduler-lane\)/);
  assert.match(source, /data-week-numbers/);
  assert.match(source, /week-number/);
});
test("scheduler styles: time-grid geometry, sticky header and now accent", () => {
  const source = css();
  for (const token of ["top", "height", "start", "width"]) assert.match(source, new RegExp(`var\\(--rv-scheduler-event-${token}\\)`));
  assert.match(source, /position: sticky/);
  assert.match(source, /scheduler__now-line/);
});
test("scheduler styles: scroll focus stays inset, weekend tint uses theme tokens", () => {
  const source = css();
  assert.match(source, /outline-offset: -2px/);
  assert.match(source, /data-weekend/);
  assert.match(source, /var\(--surface/);
  assert.match(source, /var\(--focus\)/);
});
test("scheduler styles: standalone portaled panel, concentric radius, RTL and reduced motion", () => {
  const source = css();
  assert.match(source, /\.scheduler__more-panel\s*\{/);
  assert.match(source, /--r-inner:/);
  assert.match(source, /inset-inline-start/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("scheduler port: resize grips appear on hover/focus and remain visible without hover", () => {
  const source = css();
  assert.match(source, /\.rv-SchedulerEvent-grip\s*\{[^}]*opacity:\s*0/);
  assert.match(source, /:hover[^}]*rv-SchedulerEvent-grip[^}]*opacity:\s*1/);
  assert.match(source, /:focus-visible[^}]*rv-SchedulerEvent-grip[^}]*opacity:\s*1/);
  assert.match(source, /@media\s*\(hover:\s*none\)[\s\S]*rv-SchedulerEvent-grip[^}]*opacity:\s*1/);
});

test("scheduler port: drag preview keeps its tone with a readable dashed preview channel", () => {
  const source = css();
  assert.match(source, /\[data-ghost="true"\]\s*\{[^}]*border[^}]*dashed[^}]*var\(--scheduler-event-bar\)/);
  assert.match(source, /\[data-ghost="true"\]\s*\{[^}]*opacity:\s*\.9/);
  assert.match(source, /\[data-dragging="true"\]\s*\{[^}]*opacity:\s*\.4/);
});

// Ported from @malva-ui/scheduler (src/lib/scheduler/scheduler-styles.spec.ts), MIT, © 2026 Malva UI.
// Sass's four sheets → one generated Tailwind sheet; density tight/spacious/airy → this spec's three values;
// continuation SVGs → logical square segment edges (the CDK has no continuation icon).
const compiled = () => readFileSync(new URL("../styles/out/scheduler.css", import.meta.url), "utf8");
const rule = async (selector: string, property: string): Promise<string | undefined> => {
  const { default: postcss } = await import("postcss");
  let value: string | undefined;
  postcss.parse(compiled()).walkRules((r) => {
    if (r.selectors.includes(selector))
      r.walkDecls(property, (d) => {
        value = d.value;
      });
  });
  return value;
};

test("scheduler port: uses logical inline properties only", () => {
  assert.deepEqual(compiled().match(/^\s*(margin|padding|border)-(left|right)\s*:|^\s*(left|right)\s*:|text-align\s*:\s*(left|right)/gm) ?? [], []);
});
test("scheduler port: mirrors navigation chevrons and continuation edges", () => {
  assert.match(compiled(), /scheduler[^{}]*navigation[^{}]*svg[^{}]*\{[^}]*scaleX\(var\(--rv-scheduler-navigation-direction, 1\)\)/);
  assert.match(compiled(), /\[dir="rtl"\][^{}]*\{[^}]*--rv-scheduler-navigation-direction: -1/);
  assert.match(compiled(), /data-continues-before[^{}]*\{[^}]*border-start-start-radius: 0/);
  assert.match(compiled(), /data-continues-after[^{}]*\{[^}]*border-start-end-radius: 0/);
});
test("scheduler port: consumes JS geometry through custom properties", () => {
  const source = compiled();
  assert.match(source, /var\(--rv-scheduler-lane\)/);
  assert.match(source, /inset-block-start: var\(--rv-scheduler-event-top\)/);
  assert.match(source, /inset-block-start: var\(--rv-scheduler-offset\)/);
});
test("scheduler port: every animated block has a reduced-motion path", () => {
  const source = compiled();
  for (const block of ["scheduler__event", "scheduler__more"]) assert.match(source, new RegExp(`prefers-reduced-motion: reduce[^}]*\\.${block}(?![\\w-])`));
});
test("scheduler port: density paints the slot and lane variables", async () => {
  for (const [selector, slot, lane] of [
    [".scheduler", "40px", "28px"],
    [".scheduler--compact", "32px", "24px"],
    [".scheduler--comfortable", "48px", "32px"],
  ]) {
    assert.equal(await rule(selector!, "--rv-scheduler-slot-height"), slot);
    assert.equal(await rule(selector!, "--rv-scheduler-lane-height"), lane);
  }
});
test("scheduler port: event focus ring is inset only inside the time-grid scroller", async () => {
  assert.equal(await rule(".scheduler__event:focus-visible", "outline-offset"), "2px");
  assert.equal(await rule(".scheduler .rv-SchedulerTimeGrid-scroller .scheduler__event:focus-visible", "outline-offset"), "-2px");
});
