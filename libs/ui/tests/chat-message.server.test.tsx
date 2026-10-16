// Server-target suite: `ChatMessage` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public ChatMessage docs):
// assistant / user roots, avatar fallback, hidden avatar column, parts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatMessage } from "../src/components/chat-message/index.ts";

test("chat-message SSR: assistant + user", async () => {
  const html = await renderToString(() => (
    <div>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <ChatMessage.Content>Hello</ChatMessage.Content>
          <ChatMessage.Actions>a</ChatMessage.Actions>
        </ChatMessage.Body>
      </ChatMessage.Assistant>
      <ChatMessage.User>
        <ChatMessage.Bubble>Hi</ChatMessage.Bubble>
      </ChatMessage.User>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar show={false} />
      </ChatMessage.Assistant>
    </div>
  ));
  assert.match(html, /data-role="assistant" data-actions="always"/);
  assert.match(html, /data-role="user" data-actions="hover"/);
  assert.match(html, />AI</);
  assert.match(html, /data-slot="chat-message-avatar" data-hidden="true" aria-hidden="true"/);
  assert.match(html, /class="chat-message__bubble"[^>]*>Hi</);
});
