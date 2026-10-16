// Server-target suite: `Markdown` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public Markdown docs): blocks,
// inline marks, safe links (javascript: dropped), raw HTML as text, fenced code → CodeBlock, tables, task lists, streaming
// repair + caret.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Markdown } from "../src/components/markdown/index.ts";

const SOURCE = [
  "# Title",
  "",
  "Some **bold**, *em*, `code` and [link](https://example.com) and [bad](javascript:alert(1)) <script>x</script>",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "| a | b |",
  "|:--|--:|",
  "| 1 | 2 |",
  "",
  "```js",
  "let x = 1;",
  "```",
].join("\n");

test("markdown SSR: blocks + safety", async () => {
  const html = await renderToString(() => <Markdown content={SOURCE} />);
  assert.match(html, /<h1 class="markdown__heading markdown__heading--1">Title<\/h1>/);
  assert.match(html, /<strong class="markdown__strong">bold<\/strong>/);
  assert.match(html, /<em class="markdown__em">em<\/em>/);
  assert.match(html, /<code class="markdown__inline-code">code<\/code>/);
  assert.match(html, /<a class="markdown__link" href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script>|&lt;script&gt;/);
  assert.match(html, /type="checkbox"[^>]*checked/);
  assert.match(html, /<table class="markdown__table">/);
  assert.match(html, /text-align:\s*right/);
  assert.match(html, /class="code-block markdown__code-block"|class="markdown__code-block code-block"|code-block[^"]*markdown__code-block/);
  assert.match(html, /JavaScript/);
});

test("markdown SSR: string child + streaming repair and caret", async () => {
  const child = await renderToString(() => <Markdown>{"Hello *there*"}</Markdown>);
  assert.match(child, /<p class="markdown__paragraph">Hello <em class="markdown__em">there<\/em><\/p>/);
  const streaming = await renderToString(() => <Markdown content={"Done.\n\nPartial **bol"} isStreaming />);
  assert.match(streaming, /data-streaming="true"/);
  // Live tail: finished blocks render whole, the streaming block renders word spans (the browser fades them in).
  assert.match(streaming, /<p class="markdown__paragraph">Done\.<\/p>/);
  assert.match(streaming, /<strong class="markdown__strong"><span><span class="markdown__word">bol<\/span><\/span><\/strong><span class="markdown__caret"/);
  assert.doesNotMatch(streaming, /\*\*/);
  assert.equal(streaming.match(/markdown__caret/g)?.length, 1);
});
