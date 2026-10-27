import { test } from "vitest";
import assert from "node:assert/strict";
import { _scriptBootstrap, headTags, inlineScript, rankMerge, scriptKey, type RankedHead } from "@rivetjs/router/head";
import { alternates, canonical, jsonLd, openGraph, seo, themeScript, twitterCard, unsafeInlineScript } from "../shared.ts";
import { imagePreloads } from "../image.ts";
import { parseFontId } from "../vite.ts";

const at = (level: number, phase: 0 | 1, seq: number, head: RankedHead["head"]): RankedHead => ({ level, phase, seq, head });

test("rank merge: deeper levels win, components after the route export, title template once", () => {
  const merged = rankMerge([
    at(1, 1, 0, { title: "Item", meta: [{ name: "description", content: "page" }] }),
    at(0, 0, 0, { titleTemplate: "%s | Site", title: "Site", meta: [{ name: "description", content: "layout" }] }),
    at(1, 0, 0, { title: "Route", meta: [{ property: "og:title", content: "x" }] }),
    at(-1, 0, 0, { html: { lang: "en" } }),
  ]);
  assert.equal(merged?.title, "Item | Site");
  assert.equal(merged?.titleTemplate, "%s | Site");
  assert.deepEqual(merged?.html, { lang: "en" });
  assert.deepEqual(
    merged?.meta?.map((m) => m.content),
    ["page", "x"],
  );
  assert.equal(rankMerge([]), undefined);
});

test("dedupe keys: canonical once, hreflang alternates by locale, JSON-LD only by id", () => {
  const merged = rankMerge([
    at(0, 0, 0, { links: [{ rel: "canonical", href: "https://a.test/" }, ...alternates({ locales: { en: "/en", de: "/de" }, baseUrl: "https://a.test" })] }),
    at(1, 0, 0, { links: [{ rel: "canonical", href: "https://a.test/x" }], scripts: [jsonLd({ a: 1 }), jsonLd({ b: 1 }), jsonLd({ c: 1 }, "org"), jsonLd({ d: 1 }, "org")] }),
  ]);
  assert.deepEqual(
    merged?.links?.map((l) => [l.rel, l.hreflang ?? "", l.href]),
    [
      ["canonical", "", "https://a.test/x"],
      ["alternate", "en", "https://a.test/en"],
      ["alternate", "de", "https://a.test/de"],
      ["alternate", "x-default", "https://a.test/en"],
    ],
  );
  assert.equal(merged?.scripts?.length, 3);
  assert.notEqual(scriptKey({ jsonLd: {} }), scriptKey({ jsonLd: {} }));
});

test("headTags: capo order, nonce on scripts, JSON-LD without nonce, escaping", () => {
  const html = headTags(
    {
      title: "A <b> & c",
      meta: [{ name: "description", content: 'say "hi"' }],
      links: [
        { rel: "preload", href: "/f.woff2", as: "font", type: "font/woff2", crossorigin: "anonymous" },
        { rel: "stylesheet", href: "/own.css" },
        { rel: "preconnect", href: "https://cdn.test" },
        { rel: "canonical", href: "https://a.test/" },
      ],
      scripts: [
        { src: "https://cdn.test/a.js", strategy: "eager" },
        { src: "/defer.js" },
        { jsonLd: { name: "</script><x>" } },
        { inline: inlineScript("1"), strategy: "blocking" },
      ],
    },
    { styles: ["/route.css"], nonce: "n0nce" },
  );
  const order = ["<title>", "preconnect", "a.js", "<script nonce", "route.css", "own.css", "preload", "defer.js", "description", "canonical", "ld+json"].map((s) => html.indexOf(s));
  assert.ok(order.every((index) => index >= 0), html);
  assert.deepEqual([...order].sort((a, b) => a - b), order, html);
  assert.match(html, /<title>A &lt;b&gt; &amp; c<\/title>/);
  assert.match(html, /content="say &quot;hi&quot;"/);
  assert.match(html, /<script async src="https:\/\/cdn.test\/a.js" nonce="n0nce">/);
  assert.match(html, /<script defer src="\/defer.js" nonce="n0nce">/);
  assert.match(html, /<script type="application\/ld\+json">[^<]*\\u003c\/script/);
  assert.doesNotMatch(html, /ld\+json" nonce/);
});

const SCRIPT_BOOTSTRAP = _scriptBootstrap(["load", "idle", "interaction"]);

test("deferred strategies: one inline bootstrap with the list, only the used strategies, ≤ 400 B gzip", async () => {
  const { gzipSync } = await import("node:zlib");
  const html = headTags({ scripts: [{ src: "https://t.test/a.js", strategy: "idle" }, { src: "/b.js", strategy: "interaction", type: "module" }] }, { nonce: "n" });
  assert.match(html, /<script id="rivet-scripts" nonce="n">\{let l=\[\{"u":"https:\/\/t.test\/a.js","k":1\},\{"u":"\/b.js","k":2,"type":"module"\}\],d=document,/);
  assert.doesNotMatch(html, /src="https:\/\/t.test/);
  assert.doesNotMatch(html, /r\(0\)/);
  assert.match(headTags({ scripts: [{ src: "/c.js", strategy: "load" }] }), /r\(0\)/);
  assert.doesNotMatch(headTags({ scripts: [{ src: "/c.js", strategy: "load" }] }), /pointerdown|requestIdleCallback/);
  // Worst case (every strategy), code without the list.
  assert.ok(gzipSync(SCRIPT_BOOTSTRAP, { level: 9 }).length <= 400, String(gzipSync(SCRIPT_BOOTSTRAP, { level: 9 }).length));
});

test("inline scripts must be branded", () => {
  assert.throws(() => headTags({ scripts: [{ inline: { code: "alert(1)" } }] }), /InlineScript/);
  assert.match(headTags({ scripts: [{ inline: unsafeInlineScript("x()</script>") }] }), /x\(\)<\\\/script><\/script>/);
  const theme = themeScript({ storageKey: "t" });
  assert.equal((theme as { strategy?: string }).strategy, "blocking");
  assert.match(headTags({ scripts: [theme] }), /localStorage.getItem\("t"\)/);
});

test("managed marks: data-rh, persistent root entries data-rh=0", () => {
  const keep = { name: "theme-color", content: "#000" };
  const html = headTags({ meta: [keep, { name: "description", content: "d" }] }, { managed: { persistent: new Set([keep]) } });
  assert.match(html, /name="theme-color" content="#000" data-rh="0"/);
  assert.match(html, /name="description" content="d" data-rh=""/);
  assert.doesNotMatch(headTags({ meta: [keep] }), /data-rh/);
});

test("inline styles: deduped by key / text, nonce, after stylesheets, closing tag escaped, never managed", () => {
  const merged = rankMerge([
    at(0, 1, 0, { styles: [{ css: "a{}", key: "x" }, { css: "b{}" }] }),
    at(1, 1, 1, { styles: [{ css: "c{}", key: "x" }, { css: "b{}" }] }),
  ]);
  assert.deepEqual(
    merged?.styles?.map((s) => s.css),
    ["c{}", "b{}"],
  );
  const html = headTags({ styles: [{ css: "p{}</style><b>", media: "print" }], links: [{ rel: "stylesheet", href: "/a.css" }] }, { nonce: "n1", managed: true });
  assert.equal(html, '<link rel="stylesheet" href="/a.css" data-rh=""><style media="print" nonce="n1">p{}<\\/style><b></style>');
});

test("builders: canonical, open graph, twitter, seo", () => {
  assert.equal(canonical("https://a.test/x/?utm=1&page=2#h", { query: ["page"], trailingSlash: "never" }).href, "https://a.test/x?page=2");
  assert.equal(canonical("/x", { baseUrl: "https://a.test", trailingSlash: "always" }).href, "https://a.test/x/");
  assert.throws(() => canonical("/x"), /absolute/);
  const og = openGraph({ title: "T", url: "https://a.test/p", image: { src: "/i.webp", width: 10, height: 5, sources: [] } as never });
  assert.deepEqual(
    og.map((m) => [m.property, m.content]),
    [
      ["og:title", "T"],
      ["og:url", "https://a.test/p"],
      ["og:type", "website"],
      ["og:image", "https://a.test/i.webp"],
      ["og:image:width", "10"],
      ["og:image:height", "5"],
      ["og:image:type", "image/webp"],
    ],
  );
  assert.equal(twitterCard()[0]?.content, "summary_large_image");
  const head = seo({ title: "T", description: "D", url: "https://a.test/p?q=1" });
  assert.equal(head.title, "T");
  assert.equal(head.links?.[0]?.href, "https://a.test/p");
  assert.equal(head.meta?.[0]?.content, "D");
});

test("image preloads: one per art-direction media, mutually exclusive", () => {
  const descriptor = (src: string) => ({ src, width: 10, height: 10, sources: [{ type: "image/avif", srcset: src + " 10w" }] }) as never;
  const links = imagePreloads({ "(max-width: 600px)": descriptor("/s.jpg"), default: descriptor("/l.jpg") } as never);
  assert.equal(links.length, 2);
  assert.equal(links[0]?.media, "(max-width: 600px)");
  assert.equal(links[1]?.media, "(not ((max-width: 600px)))");
  assert.ok(links.every((link) => link.rel === "preload" && link.as === "image"));
});

test("?font ids", () => {
  const request = parseFontId("/f/Inter-Variable.woff2?font&weight=100..900&fallback=Arial");
  assert.deepEqual(request, { file: "/f/Inter-Variable.woff2", family: "Inter", weight: "100 900", style: "normal", display: "swap", fallback: "Arial", format: "woff2" });
  assert.equal(parseFontId("/f/a.woff2?url"), null);
  assert.throws(() => parseFontId("/f/a.png?font"), /woff2/);
  assert.throws(() => parseFontId("/f/a.woff2?font&family=a%22b"), /invalid font family/);
});

test("server <Title> / <Meta>: translated values (server t() outside JSX) resolve through the head sink for the request locale", async () => {
  const { renderToString, Provider, _variantValue } = await import("@rivetjs/runtime/server");
  const { ServerData } = await import("@rivetjs/router/route-context");
  const { Title, Meta, childText } = await import("../index.ts");
  const pushed: unknown[] = [];
  const resolve = (value: unknown) => (value && typeof value === "object" && Symbol.for("rivet.variantValue") in value ? "Hallo" : value);
  const sink = { nonce: undefined, resolve, push: (_level: number, head: unknown) => (pushed.push(head), undefined) };
  const hello = _variantValue(["Hello", "Hallo"]);
  await renderToString(
    Provider({
      token: ServerData,
      value: { data: [], url: new URL("https://x.test/"), head: undefined, headSink: sink } as never,
      children: () => [Title({ children: ["» ", hello] }), Meta({ name: "description", content: hello as unknown as string })],
    }),
  );
  assert.deepEqual(pushed[0], { title: "» Hallo" });
  // Meta values stay as given: the router's sink resolves whole heads on push.
  assert.equal((pushed[1] as { meta: { content: unknown }[] }).meta[0]!.content, hello);
  assert.equal(childText(["a", 1, null, () => "b"]), "a1b");
});
