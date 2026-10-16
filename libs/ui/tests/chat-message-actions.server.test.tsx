// Server-target suite: `ChatMessageActions` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatMessageActions docs): group role + label, icon-only ghost actions, copy button with both icons.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatMessageActions } from "../src/components/chat-message-actions/index.ts";

test("chat-message-actions SSR", async () => {
  const html = await renderToString(() => (
    <ChatMessageActions>
      <ChatMessageActions.Copy text="hello" />
      <ChatMessageActions.Action aria-label="Retry">r</ChatMessageActions.Action>
    </ChatMessageActions>
  ));
  assert.match(html, /role="group" aria-label="Message actions"/);
  assert.match(html, /aria-label="Copy"/);
  assert.match(html, /data-copy-button=""/);
  assert.match(html, /chat-message-actions__copy-icon/);
  assert.match(html, /chat-message-actions__copied-icon/);
  assert.match(html, /button--ghost/);
  assert.match(html, /aria-label="Retry"/);
});
