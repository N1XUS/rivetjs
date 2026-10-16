// Server-target suite: `ChatSource` / `ChatSources` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatSource docs): URL pill (domain title, initial fallback), favicon, document source, grouped disclosure, favicons stack.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ChatSource, ChatSources } from "../src/components/chat-source/index.ts";

test("chat-source SSR: url + document", async () => {
  const html = await renderToString(() => (
    <div>
      <ChatSource href="https://www.example.com/a" />
      <ChatSource href="https://rivet.dev" title="Rivet" faviconUrl="/f.png" />
      <ChatSource title="brief.pdf" />
    </div>
  ));
  assert.match(
    html,
    /<a[^>]*class="chat-source__trigger-link"[^>]*href="https:\/\/www.example.com\/a"|<a[^>]*href="https:\/\/www.example.com\/a"[^>]*chat-source__trigger-link/,
  );
  assert.match(html, /chat-source__title[^>]*>example.com</);
  assert.match(html, /chat-source__icon-fallback[^>]*>E</);
  assert.match(html, /<img[^>]*src="\/f.png"/);
  assert.match(html, /data-source-type="document"/);
  assert.match(html, /chat-source__document-icon/);
});

test("chat-sources SSR: group", async () => {
  const html = await renderToString(() => (
    <ChatSources>
      <ChatSources.Trigger>
        <ChatSources.Favicons sources={[{ href: "https://a.dev" }, { href: "https://b.dev" }]} />2 sources
      </ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          <ChatSource href="https://a.dev" />
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
  ));
  assert.match(html, /chat-sources/);
  assert.match(html, /aria-expanded="false"/);
  assert.equal(html.match(/chat-sources__favicon\b/g)?.length, 2);
  assert.match(html, /chat-sources__list/);
});
