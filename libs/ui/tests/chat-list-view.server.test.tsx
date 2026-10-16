// Server-target suite: `ChatListView` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public ChatListView docs):
// link vs button items, current item, compact variant, parts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatListView } from "../src/components/chat-list-view/index.ts";

test("chat-list-view SSR", async () => {
  const html = await renderToString(() => (
    <ChatListView variant="compact" aria-label="History">
      <ChatListView.Item href="/c/1" isCurrent>
        <ChatListView.ItemContent>
          <ChatListView.Title>Trip plan</ChatListView.Title>
          <ChatListView.Preview>Day one…</ChatListView.Preview>
        </ChatListView.ItemContent>
        <ChatListView.Meta>2h</ChatListView.Meta>
      </ChatListView.Item>
      <ChatListView.Item>Other</ChatListView.Item>
    </ChatListView>
  ));
  assert.match(html, /data-variant="compact"/);
  assert.match(html, /<a[^>]*href="\/c\/1"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /data-current="true"/);
  assert.match(html, /<button[^>]*chat-list-view__item/);
  assert.match(html, /chat-list-view__title[^>]*>Trip plan</);
});
