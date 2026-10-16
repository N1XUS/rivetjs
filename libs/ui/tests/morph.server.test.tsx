// Server-target suite: `Morph` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public MorphButton docs): footprint
// root + collapsed content + trigger (`aria-expanded`, `aria-controls`) + surface + panel (`role="dialog"`, hidden by
// `inert` while closed); `defaultOpen` renders the open state (no script needed); variants / directions / disabled /
// animation off.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Morph } from "../src/components/morph/index.ts";

const Fixture = (props: {
  defaultOpen?: boolean;
  direction?: "top" | "bottom-end";
  variant?: "primary" | "secondary";
  animation?: false;
  isDisabled?: boolean;
}) => (
  <Morph id="m" defaultOpen={props.defaultOpen} direction={props.direction} variant={props.variant} animation={props.animation} isDisabled={props.isDisabled}>
    <Morph.CollapsedContent>
      2 items
      <Morph.Trigger>View</Morph.Trigger>
    </Morph.CollapsedContent>
    <Morph.ExpandedContent aria-label="Order summary" class="w-80">
      <p>Summary</p>
      <Morph.Close>Keep shopping</Morph.Close>
    </Morph.ExpandedContent>
  </Morph>
);

test("morph SSR: closed markup", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /<div[^>]*class="morph morph--top morph--primary"/);
  assert.match(html, /data-slot="morph"/);
  assert.match(html, /data-morph-root=""/);
  assert.doesNotMatch(html, /data-open=/);
  assert.match(html, /class="morph__collapsed"[^>]*data-slot="morph-collapsed"/);
  assert.match(html, /<button[^>]*type="button"[^>]*class="morph__trigger"[^>]*aria-expanded="false"[^>]*aria-controls="m-panel"/);
  assert.match(html, /class="morph__surface"[^>]*data-slot="morph-surface"/);
  assert.match(html, /<div[^>]*id="m-panel"[^>]*class="morph__expanded w-80"[^>]*role="dialog"[^>]*tabindex="-1"[^>]*inert/);
  assert.match(html, /aria-label="Order summary"/);
  assert.match(html, /data-slot="morph-close"[^>]*class="[^"]*button[^"]*morph__close"|class="[^"]*morph__close[^"]*"[^>]*data-slot="morph-close"/);
});

test("morph SSR: defaultOpen renders the open state", async () => {
  const html = await renderToString(() => <Fixture defaultOpen />);
  assert.match(html, /data-open=""/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /class="morph__collapsed"[^>]*inert/);
  assert.doesNotMatch(html, /role="dialog"[^>]*inert/);
});

test("morph SSR: variants, direction, disabled, animation off", async () => {
  const html = await renderToString(() => <Fixture variant="secondary" direction="bottom-end" isDisabled animation={false} />);
  assert.match(html, /class="morph morph--bottom-end morph--secondary"/);
  assert.match(html, /data-direction="bottom-end"/);
  assert.match(html, /data-disabled="true"/);
  assert.match(html, /data-animation="disabled"/);
  assert.match(html, /<button[^>]*class="morph__trigger"[^>]*disabled/);
});
