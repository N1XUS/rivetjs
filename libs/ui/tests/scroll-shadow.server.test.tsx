// Server-target suite: `ScrollShadow` SSR markup (upstream scroll-shadow.ssr.test.tsx): data-slot, auto shadow mode (the fade
// needs no measurement), size / offset variables, manual mode when visibility is controlled; no scroll-state attributes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ScrollShadow } from "../index.ts";

test("scroll-shadow SSR: data-slot, BEM block, auto shadow mode, no scroll-state attributes", async () => {
  const html = await renderToString(() => <ScrollShadow data-testid="scroll-shadow">Scrollable content</ScrollShadow>);
  assert.match(html, /data-slot="scroll-shadow"/);
  assert.match(html, /class="scroll-shadow scroll-shadow--vertical scroll-shadow--fade"/);
  assert.match(html, /data-scroll-shadow-mode="auto"/);
  assert.match(html, /data-orientation="vertical"/);
  assert.match(html, /data-scroll-shadow-size="40"/);
  assert.doesNotMatch(html, /data-(top|bottom)-scroll/);
  assert.match(html, />Scrollable content</);
});

test("scroll-shadow SSR: ships the shadow size and offset variables (+ a passed style)", async () => {
  const html = await renderToString(() => (
    <ScrollShadow data-testid="scroll-shadow" offset={20} size={64} style={{ height: "240px" }}>
      Scrollable content
    </ScrollShadow>
  ));
  assert.match(html, /--scroll-shadow-size:\s?64px/);
  assert.match(html, /--scroll-shadow-offset:\s?20px/);
  assert.match(html, /height:\s?240px/);
});

test("scroll-shadow SSR: manual shadow mode when visibility is controlled or detection is disabled", async () => {
  assert.match(await renderToString(() => <ScrollShadow visibility="both">x</ScrollShadow>), /data-scroll-shadow-mode="manual"/);
  assert.match(await renderToString(() => <ScrollShadow isEnabled={false}>x</ScrollShadow>), /data-scroll-shadow-mode="manual"/);
});
