// Document shell gaps from the alpha.1 report (EXT-B items 9 / 19): any attribute on `<html>` / `<body>` from the
// route head, and a per-page end-of-body script slot (`strategy: "body"` + `bodyTags`).
// Run: `npx vitest run --project router libs/router/tests/document-shell.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { bodyAttributes, bodyTags, headTags, htmlAttributes, inlineScript, rankMerge } from "../shared/head.ts";
import { renderPage, type DocumentShell } from "../server/render.ts";
import type { Head } from "../shared/data.ts";

const shell: DocumentShell = (input) => ({
  start: `<!doctype html><html${htmlAttributes(input.head, { lang: "en" })}><head>${headTags(input.head, input)}</head><body${bodyAttributes(input.head)}>`,
  end: bodyTags(input.head, input) + "</body></html>",
});

test("html / body: any attribute, merged per attribute (layout → page), escaped; on* handlers and bad names refused", () => {
  const head = rankMerge([
    { level: 0, phase: 0, seq: 0, head: { html: { "data-theme": "dark", class: "a" }, body: { class: "layout", "data-layout": "main" } } },
    { level: 1, phase: 0, seq: 1, head: { html: { lang: "de" }, body: { class: "feed", style: 'margin:0;content:"x"' } } },
  ]);
  assert.equal(htmlAttributes(head, { lang: "en", dir: "ltr" }), ' lang="de" dir="ltr" data-theme="dark" class="a"');
  assert.equal(bodyAttributes(head), ' class="feed" data-layout="main" style="margin:0;content:&quot;x&quot;"');
  assert.equal(bodyAttributes(undefined), "");
  assert.throws(() => bodyAttributes({ body: { onload: "alert(1)" } }), /not allowed/);
  assert.throws(() => htmlAttributes({ html: { 'x"y': "1" } }), /not allowed/);
});

test("strategy: body scripts leave the head and go before </body> with the nonce, in order", () => {
  const head: Head = {
    scripts: [
      { src: "/head.js" },
      { src: "/end.js", strategy: "body" },
      { inline: inlineScript("frame()"), strategy: "body", data: { id: 1 } },
      { inline: inlineScript("early()"), strategy: "blocking" },
    ],
  };
  const tags = headTags(head, { nonce: "N1" });
  assert.match(tags, /<script defer src="\/head\.js" nonce="N1"><\/script>/);
  assert.match(tags, /early\(\)/);
  assert.doesNotMatch(tags, /end\.js|frame\(\)/);
  assert.equal(
    bodyTags(head, { nonce: "N1" }),
    '<script src="/end.js" nonce="N1"></script><script type="application/json">{"id":1}</script><script nonce="N1">frame()</script>',
  );
  assert.equal(bodyTags(undefined), "");
});

test("a page renders inside the shell with its body attributes and end-of-body script", async () => {
  const head: Head = { body: { "data-page": "feed" }, scripts: [{ inline: inlineScript("wire()"), strategy: "body" }] };
  const response = renderPage(
    () => "page body",
    { head, nonce: "N2", url: new URL("http://x/"), status: 200, styles: [] },
    { document: shell, nonce: "N2" },
    { status: 200, headers: new Headers() },
  );
  const html = await response.text();
  assert.match(html, /<body data-page="feed">/);
  assert.match(html, /page body.*<script nonce="N2">wire\(\)<\/script><\/body><\/html>$/s);
});

test("rankMerge gives the same result for rank-ordered and shuffled entries (sorted fast path)", () => {
  const entries = [
    { level: 0, phase: 0 as const, seq: 0, head: { title: "outer", meta: [{ name: "description", content: "a" }] } },
    {
      level: 1,
      phase: 0 as const,
      seq: 1,
      head: {
        meta: [
          { name: "description", content: "b" },
          { name: "robots", content: "x" },
        ],
      },
    },
    { level: 2, phase: 1 as const, seq: 2, head: { title: "inner" } },
  ];
  const ordered = rankMerge(entries);
  const shuffled = rankMerge([entries[2]!, entries[0]!, entries[1]!]);
  assert.deepEqual(shuffled, ordered);
  assert.equal(ordered?.title, "inner");
  assert.deepEqual(
    ordered?.meta?.find((m) => m.name === "description"),
    { name: "description", content: "b" },
  );
  assert.equal(rankMerge([]), undefined);
  assert.equal(entries[0]!.level, 0);
});
