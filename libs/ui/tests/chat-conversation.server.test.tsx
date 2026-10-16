// Server-target suite: `ChatConversation` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatConversation docs): log role, server-rendered at-bottom state, stack + content, scroll button + anchor.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatConversation } from "../src/components/chat-conversation/index.ts";

test("chat-conversation SSR", async () => {
  const html = await renderToString(() => (
    <ChatConversation isStreaming>
      <ChatConversation.Content>m</ChatConversation.Content>
      <ChatConversation.ScrollAnchor />
      <ChatConversation.ScrollButton />
    </ChatConversation>
  ));
  assert.match(html, /role="log"/);
  assert.match(html, /aria-label="Conversation"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /data-chat-viewport=""/);
  assert.match(html, /data-at-bottom="true"/);
  assert.match(html, /chat-conversation__stack/);
  assert.match(html, /chat-conversation__content[^>]*>m</);
  assert.match(html, /chat-conversation__scroll-button-container/);
  assert.match(html, /aria-label="Scroll to bottom"/);
  assert.match(html, /chat-conversation__scroll-anchor/);
});
