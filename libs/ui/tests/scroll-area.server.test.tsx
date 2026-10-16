// Server-target suite: `ScrollArea` (Rivet addition: Radix ScrollArea behaviour from `@rivetjs/cdk/scroll-area`, HeroUI look)
// SSR — BEM classes + `data-slot` on root / viewport, size / variant modifiers, `variant="always"` renders the static
// scrollbar track (no thumb before measuring), `hover` renders none, the viewport scrolls natively before activation,
// `shadow` puts the ScrollShadow classes + `data-scroll-shadow-mode="auto"` + `--scroll-shadow-size` on the viewport.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ScrollArea } from "../index.ts";

const Fixture = (props: { variant?: "hover" | "always"; size?: "sm" | "md"; shadow?: boolean | "horizontal" }) => (
  <ScrollArea variant={props.variant} size={props.size} shadow={props.shadow} class="h-40 w-48">
    <ScrollArea.Viewport id="vp">
      <p>row</p>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" id="bar" />
    <ScrollArea.Corner />
  </ScrollArea>
);

test("scroll-area SSR: root + viewport classes, data-slot, default modifiers", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /class="scroll-area scroll-area--md scroll-area--hover h-40 w-48"/);
  assert.match(html, /data-slot="scroll-area"/);
  const vp = /<div[^>]*id="vp"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(vp, /class="scroll-area__viewport"/);
  assert.match(vp, /data-slot="scroll-area-viewport"/);
  assert.match(html, /data-rv-scroll-area-viewport=""/);
  // native scrolling before activation (no script)
  assert.match(html, /overflow-x:\s*scroll/);
  assert.match(html, /overflow-y:\s*scroll/);
  assert.match(html, /<p>row<\/p>/);
  // hover scrollbars: not on the server
  assert.doesNotMatch(html, /scroll-area__scrollbar|scroll-area__thumb|scroll-area__corner/);
});

test('scroll-area SSR: variant="always" + size="sm" render the static track without a thumb', async () => {
  const html = await renderToString(() => <Fixture variant="always" size="sm" />);
  assert.match(html, /class="scroll-area scroll-area--sm scroll-area--always h-40 w-48"/);
  const bar = /<div[^>]*id="bar"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(bar, /class="scroll-area__scrollbar"/);
  assert.match(bar, /data-slot="scroll-area-scrollbar"/);
  assert.match(bar, /data-orientation="vertical"/);
  assert.match(bar, /data-state="visible"/);
  assert.match(bar, /position:\s*absolute/);
  assert.doesNotMatch(html, /scroll-area__thumb/);
});

test("scroll-area SSR: shadow → ScrollShadow classes in scroll-driven mode on the viewport", async () => {
  const vertical = await renderToString(() => <Fixture shadow />);
  const vp = /<div[^>]*id="vp"[^>]*>/.exec(vertical)?.[0] ?? "";
  assert.match(vp, /class="scroll-area__viewport scroll-shadow scroll-shadow--hide-scrollbar scroll-shadow--vertical scroll-shadow--fade"/);
  assert.match(vp, /data-scroll-shadow-mode="auto"/);
  assert.match(vp, /--scroll-shadow-size:\s*40px/);
  const horizontal = await renderToString(() => <Fixture shadow="horizontal" />);
  assert.match(horizontal, /scroll-shadow--horizontal/);
});
