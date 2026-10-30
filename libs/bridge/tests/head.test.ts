import assert from "node:assert/strict";
import { test } from "vitest";
import { headOf, headOfMarked } from "../head.ts";
const stripLifecycle = (html: string) => html.replace(/<script data-rivet-native-head[\s\S]*<\/script>$/, "");

test("framework head fields decode text/attributes and retain script content as rest", () => {
  const out = headOf(
    '<title>A &amp; B</title><meta name="description" content="&quot;x&quot;"><link rel="stylesheet" href="/a.css"><style data-href="x" media="print">a{color:red}</style><script>const s="<!--literal-->";</script>',
  );
  assert.deepEqual(out.head, {
    title: "A & B",
    meta: [{ name: "description", content: '"x"' }],
    links: [{ rel: "stylesheet", href: "/a.css" }],
    styles: [{ css: "a{color:red}", key: "x", media: "print" }],
  });
  assert.equal(out.rest, '<script>const s="<!--literal-->";</script>');
});
test("Vue/Svelte head anchor comments and whitespace do not hide head fields", () => {
  const out = headOfMarked(
    '<!--teleport start anchor-->\n<title>Hello</title>\n<!--[--><meta name="description" content="marked"><!--]--><!--teleport anchor-->',
  );
  assert.deepEqual(out, { head: { title: "Hello", meta: [{ name: "description", content: "marked" }] }, rest: "" });
});
test("marked head parsing does not strip marker-shaped strings inside scripts/styles or unknown markup", () => {
  assert.deepEqual(headOfMarked('<!--s--><script>const marker="<!--x-->";</script> <style>p:before{content:"<!--x-->"}</style>'), {
    head: { styles: [{ css: 'p:before{content:"<!--x-->"}' }] },
    rest: '<script>const marker="<!--x-->";</script>',
  });
  assert.deepEqual(headOf("<div>body</div><title>not hoisted</title>"), { head: null, rest: "<div>body</div><title>not hoisted</title>" });
});

test("native ranges survive rank merging exactly, replace lower route fields, and never enter wire payloads", async () => {
  const { nativeHead } = await import("../head.ts");
  const { headTags, rankMerge } = await import("../../router/shared/head.ts");
  const { encodeData } = await import("../../router/server/handler.ts");
  const raw = '<!--same-hash--><meta name="description" content="native"><link rel="canonical" href="/native"><!----><title>Native &amp; title</title>';
  const native = nativeHead("svelte", "i2", raw).head!;
  const merged = rankMerge([
    {
      level: 0,
      phase: 0,
      seq: 0,
      head: {
        title: "Route",
        meta: [
          { name: "description", content: "route" },
          { name: "theme-color", content: "blue" },
        ],
      },
    },
    { level: 0, phase: 1, seq: 1, head: native },
  ])!;
  const html = headTags(merged);
  assert.equal(stripLifecycle(html), '<meta name="theme-color" content="blue"><!--rivet-head:svelte:i2-->' + raw + "<!--/rivet-head:svelte:i2-->");
  assert.equal(html.match(/<title>/g)?.length, 1);
  assert.equal(merged.title, "Native & title");
  for (const wire of [JSON.stringify(merged), encodeData({ head: merged })]) {
    assert.doesNotMatch(wire, /rivet-head|same-hash|render|<!--/);
    assert.match(wire, /native/);
  }
});

test("native metadata ranges retain independent ownership even with identical hashes and dedupe keys", async () => {
  const { nativeHead } = await import("../head.ts");
  const { headTags, rankMerge } = await import("../../router/shared/head.ts");
  const first = '<!--same--><meta name="description" content="first"><!---->';
  const second = '<!--same--><meta name="description" content="second"><!---->';
  const merged = rankMerge([
    { level: 0, phase: 1, seq: 0, head: nativeHead("svelte", "i0", first).head! },
    { level: 0, phase: 1, seq: 1, head: nativeHead("svelte", "i1", second).head! },
  ])!;
  assert.equal(
    stripLifecycle(headTags(merged)),
    `<!--rivet-head:svelte:i0-->${first}<!--/rivet-head:svelte:i0--><!--rivet-head:svelte:i1-->${second}<!--/rivet-head:svelte:i1-->`,
  );
  assert.deepEqual(merged.meta, [{ name: "description", content: "second" }]);
});

test("native title conflicts fail explicitly instead of emitting multiple document titles", async () => {
  const { nativeHead } = await import("../head.ts");
  const { rankMerge } = await import("../../router/shared/head.ts");
  const head = nativeHead("vue", "i0", "<!--teleport start anchor--><title>Native</title><!--teleport anchor-->").head!;
  const entry = { level: 0, phase: 1 as const, seq: 0, head };
  assert.throws(() => rankMerge([entry, { level: 1, phase: 0, seq: 1, head: { title: "higher route" } }]), /one title author/);
  assert.throws(() => rankMerge([{ level: 0, phase: 0, seq: 0, head: { titleTemplate: "%s | Site" } }, entry]), /one title author/);
  assert.throws(() => rankMerge([entry, { ...entry, seq: 1, head: nativeHead("svelte", "i1", "<title>Other</title>").head! }]), /one title author/);
  assert.throws(() => nativeHead("vue", "i0", "<title>A</title><title>B</title>"), /one title author/);
  assert.throws(() => nativeHead("vue", "i0--><script", "<title>A</title>"), /island id/);
});

test("server rendering extension survives translated/cloned heads; arbitrary JSON fields cannot inject raw HTML", async () => {
  const { nativeHead } = await import("../head.ts");
  const { copyHeadRendering } = await import("../../router/shared/head-native.ts");
  const { headTags } = await import("../../router/shared/head.ts");
  const native = nativeHead("vue", "i7", '<!--teleport start anchor--><meta name="x" content="native"><!--teleport anchor-->').head!;
  assert.equal(
    stripLifecycle(headTags(copyHeadRendering(native, { ...native }))),
    '<!--rivet-head:vue:i7--><!--teleport start anchor--><meta name="x" content="native"><!--teleport anchor--><!--/rivet-head:vue:i7-->',
  );
  const forged = JSON.parse('{"raw":"<script>bad()</script>","render":"<script>bad()</script>","rivet.head.render":{"html":"<script>bad()</script>"}}');
  assert.equal(headTags(forged), "");
});

test("late native head fails before emitting degraded HTML; ordinary body-valid fallback is unchanged", async () => {
  const { nativeHead } = await import("../head.ts");
  const { lateHeadTags } = await import("../../router/shared/head-native.ts");
  const { headTags } = await import("../../router/shared/head.ts");
  const head = nativeHead("svelte", "i0", '<!--hash--><link rel="stylesheet" href="/native.css"><!---->').head!;
  assert.throws(() => lateHeadTags(head, {}, headTags), /after the document head hold/);
  assert.equal(
    lateHeadTags({ title: "ignored", meta: [{ name: "x", content: "ignored" }], links: [{ rel: "stylesheet", href: "/a.css" }] }, {}, headTags),
    '<link rel="stylesheet" href="/a.css">',
  );
});

test("native lifecycle emits once per merged head with the request CSP nonce", async () => {
  const { nativeHead } = await import("../head.ts");
  const { rankMerge, headTags } = await import("../../router/shared/head.ts");
  const head = rankMerge(
    ["i0", "i1"].map((id, seq) => ({
      level: 0,
      phase: 1 as const,
      seq,
      head: nativeHead("svelte", id, '<!--hash--><meta name="x" content="x"><!---->', "nonce1.a").head!,
    })),
  );
  const html = headTags(head);
  assert.equal(html.match(/<script data-rivet-native-head/g)?.length, 1);
  assert.match(html, /data-rivet-native-head nonce="nonce1.a"/);
});
