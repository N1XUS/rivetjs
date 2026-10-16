// Server-target suite: `ChainOfThought` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public ChainOfThought
// docs): disclosure root + streaming flag, shimmer label, steps list with statuses.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChainOfThought } from "../src/components/chain-of-thought/index.ts";

test("chain-of-thought SSR", async () => {
  const html = await renderToString(() => (
    <ChainOfThought isStreaming defaultExpanded>
      <ChainOfThought.Trigger>Thinking</ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          <ChainOfThought.Step label="Search" />
          <ChainOfThought.Step label="Read" status="active">
            3 pages
          </ChainOfThought.Step>
        </ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
  ));
  assert.match(html, /class="disclosure chain-of-thought"|chain-of-thought/);
  assert.match(html, /data-streaming="true"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /text-shimmer"[^>]*>Thinking<\/span>/);
  assert.match(html, /role="list"/);
  assert.equal(html.match(/role="listitem"/g)?.length, 2);
  assert.match(html, /data-status="complete"/);
  assert.match(html, /data-status="active"/);
  assert.match(html, /3 pages/);
  const idle = await renderToString(() => (
    <ChainOfThought>
      <ChainOfThought.Trigger>Thought</ChainOfThought.Trigger>
    </ChainOfThought>
  ));
  assert.doesNotMatch(idle, /data-streaming=/);
  assert.match(idle, /aria-expanded="false"/);
});
