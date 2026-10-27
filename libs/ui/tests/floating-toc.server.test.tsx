// Server-target suite: FloatingToc (Rivet addition, feature set inspired by HeroUI Pro's public Floating TOC docs): trigger
// button with bars (active, level variable, placement), content closed on the server.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { FloatingToc } from "../src/components/floating-toc/index.ts";

test("floating toc SSR: trigger, bars, closed content", async () => {
  const html = await renderToString(() => (
    <FloatingToc placement="left">
      <FloatingToc.Trigger>
        <FloatingToc.Bar active />
        <FloatingToc.Bar level={2} />
      </FloatingToc.Trigger>
      <FloatingToc.Content>
        <FloatingToc.Item active>Intro</FloatingToc.Item>
      </FloatingToc.Content>
    </FloatingToc>
  ));
  assert.match(html, /<button[^>]*aria-label="Table of contents"/);
  assert.match(html, /class="floating-toc__trigger"/);
  assert.match(html, /data-placement="left"/);
  assert.match(html, /class="floating-toc__bar"[^>]*data-active="true"/);
  assert.match(html, /--floating-toc-level:\s*2/);
  assert.doesNotMatch(html, />Intro</);
});
