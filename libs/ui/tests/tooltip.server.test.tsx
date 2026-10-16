// Server-target suite: `Tooltip` SSR (upstream tooltip.ssr.test.tsx: closed, and defaultOpen with an arrow) — closed renders the
// trigger only (cdk: nothing for a closed tooltip); defaultOpen renders the tooltip (`role=tooltip`, `tooltip` class, arrow slots);
// `Tooltip.Trigger` markup (div role=button tabindex=0).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, Tooltip } from "../index.ts";

test("tooltip SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => (
    <Tooltip delay={0}>
      <Button>Hover me</Button>
      <Tooltip.Content>Hover tip</Tooltip.Content>
    </Tooltip>
  ));
  assert.match(html, />Hover me</);
  assert.doesNotMatch(html, /Hover tip/);
  assert.doesNotMatch(html, /role="tooltip"/);
});

test("tooltip SSR: defaultOpen with an arrow", async () => {
  const html = await renderToString(() => (
    <Tooltip defaultOpen delay={0}>
      <Button>Hover me</Button>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        Hover tip
      </Tooltip.Content>
    </Tooltip>
  ));
  assert.match(html, /role="tooltip"/);
  assert.match(html, /class="tooltip"/);
  assert.match(html, /data-slot="tooltip-arrow"/);
  assert.match(html, /data-slot="overlay-arrow"/);
  assert.match(html, /Hover tip/);
});

test("tooltip SSR: Tooltip.Trigger markup", async () => {
  const html = await renderToString(() => (
    <Tooltip>
      <Tooltip.Trigger aria-label="Info">i</Tooltip.Trigger>
      <Tooltip.Content>tip</Tooltip.Content>
    </Tooltip>
  ));
  assert.match(html, /<div[^>]*class="tooltip__trigger"/);
  assert.match(html, /data-slot="tooltip-trigger"/);
  assert.match(html, /role="button"/);
  assert.match(html, /tabindex="0"/);
});
