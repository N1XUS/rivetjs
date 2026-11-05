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
  // Finished blocks render whole; live inline text uses StreamingText's character renderer.
  assert.match(streaming, /<p class="markdown__paragraph">Done\.<\/p>/);
  const bold = /<strong class="markdown__strong">([\s\S]*?)<\/strong>/.exec(streaming)![1]!;
  assert.equal(bold.replace(/<[^>]+>/g, ""), "bol");
  assert.match(bold, /data-slot="streaming-text-run"/);
  assert.equal(bold.match(/streaming-text__character/g)?.length, 3);
  assert.doesNotMatch(streaming, /data-new/);
  assert.doesNotMatch(streaming, /\*\*/);
  assert.equal(streaming.match(/markdown__caret/g)?.length, 1);
});

test("markdown SSR: images send no referrer (untrusted model output must not leak the page URL to image hosts)", async () => {
  const html = await renderToString(() => <Markdown remoteImages content={"![chart](https://img.example.com/c.png)"} />);
  assert.match(html, /<img [^>]*src="https:\/\/img.example.com\/c.png"[^>]*referrerpolicy="no-referrer"/i);
});

test("markdown SSR: remote images are off by default, their alt text stands in; relative images and an img override still render", async () => {
  for (const url of ["https://t.example/p.gif", "http://t.example/p.gif", "//t.example/p.gif"]) {
    const html = await renderToString(() => <Markdown content={`![pixel](${url})`} />);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /data-slot="markdown-image-blocked"[^>]*>pixel</);
  }
  assert.match(await renderToString(() => <Markdown content={"![a](/a.png)"} />), /<img [^>]*src="\/a.png"/);
  // Text that is not a URL to another host until the browser normalizes it, and what the regex alone used to let through.
  const evasions = [
    "/\\\\t.example/p",
    "\\\\\\\\t.example/p",
    "\\\\/t.example/p",
    "</\t/t.example/p>",
    "< //t.example/p>",
    "< https://t.example/p>",
    "/\\\\[/p",
  ];
  for (const url of evasions) {
    const html = await renderToString(() => <Markdown content={`![pixel](${url})`} />);
    assert.doesNotMatch(html, /<img/, url);
    assert.match(html, /data-slot="markdown-image-blocked"[^>]*>pixel</, url);
  }
  assert.match(await renderToString(() => <Markdown content={"![a](img/a.png) ![b](../b.png)"} />), /src="img\/a.png"[\s\S]*src="..\/b.png"/);
  const custom = await renderToString(() => (
    <Markdown content={"![a](/a.png) ![b](https://t.example/b.png)"} components={{ img: (props) => <em>{props.src}</em> }} />
  ));
  assert.match(custom, /<em[^>]*>\/a.png/);
  assert.doesNotMatch(custom, /<em[^>]*>https:/);
});
