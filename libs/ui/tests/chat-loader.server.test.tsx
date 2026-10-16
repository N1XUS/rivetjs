// Server-target suite: `ChatLoader` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public ChatLoader docs):
// status roles + labels, dots / pulse / spinner / skeleton markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatLoader } from "../src/components/chat-loader/index.ts";

test("chat-loader SSR: loaders", async () => {
  const html = await renderToString(() => (
    <div>
      <ChatLoader.Dots />
      <ChatLoader.Pulse aria-label="Thinking" />
      <ChatLoader.Spinner />
      <ChatLoader.Skeleton lines={2} />
    </div>
  ));
  assert.equal(html.match(/role="status"/g)?.length, 4);
  assert.match(html, /aria-label="Loading"/);
  assert.match(html, /aria-label="Thinking"/);
  assert.match(html, /class="chat-loader__dots"/);
  assert.equal(html.match(/data-slot="chat-loader-line"/g)?.length, 2);
});
