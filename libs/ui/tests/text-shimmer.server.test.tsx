// Server-target suite: `TextShimmer` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public TextShimmer docs):
// one span with the text once (no copy), `data-active` true / false, base class kept next to text colour utilities.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { TextShimmer } from "../src/components/text-shimmer/index.ts";

test("text-shimmer SSR: single span + active state", async () => {
  const html = await renderToString(() => <TextShimmer class="x">Thinking</TextShimmer>);
  assert.match(html, /class="text-shimmer x"/);
  assert.match(html, /data-active="true"/);
  assert.match(html, /data-slot="text-shimmer"[^>]*>Thinking<\/span>/);
  assert.equal(html.match(/Thinking/g)?.length, 1);
  assert.doesNotMatch(html, /aria-hidden/);
  const off = await renderToString(() => <TextShimmer isActive={false}>Done</TextShimmer>);
  assert.match(off, /data-active="false"/);
  // tailwind-merge would read `text-shimmer` as a text colour and drop it next to `text-muted`.
  const coloured = await renderToString(() => <TextShimmer class="text-sm text-muted">Thinking</TextShimmer>);
  assert.match(coloured, /class="text-shimmer text-sm text-muted"/);
});
