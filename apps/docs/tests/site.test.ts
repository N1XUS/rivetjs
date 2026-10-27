// Checks on the built site (nx `docs:test` depends on `docs:build`): content complete, links,
// examples embedded and built, API pages, search index, no runtime boot on plain content pages. Homepage: tests/home.test.ts.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { generateContent } from "@rivetjs/docs-kit/tools/content/generate.ts";
import { checkLinks } from "@rivetjs/docs-kit/tools/check-links.ts";
import { stale } from "../scripts/home-perf.ts";
import { site } from "../site.config.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const client = resolve(root, "dist/client");
const html = (path: string) => readFileSync(resolve(client, "." + path, "index.html"), "utf8");

test("every page has real content (no TODO-CONTENT placeholders)", async () => {
  const { pages, todo } = await generateContent(root, { dryRun: true });
  assert.ok(pages.length > 90, `expected the full page set, got ${pages.length}`);
  assert.deepEqual(todo, []);
});

test("the build has every content page, and planned pages say so", async () => {
  const { pages } = await generateContent(root, { dryRun: true });
  for (const page of pages) {
    assert.ok(existsSync(resolve(client, "." + page.href, "index.html")), `missing ${page.href}`);
    if (page.status === "planned") assert.match(html(page.href), /status-planned/, page.href);
  }
});

test("internal links, anchors and example frames resolve", async () => {
  assert.deepEqual(await checkLinks(resolve(root, "dist")), []);
});

test("embedded examples are pages of the docs app, without the docs chrome", () => {
  const page = html("/guides/state/signals/");
  const src = /<iframe[^>]*\ssrc="([^"]+)"/.exec(page)?.[1];
  assert.ok(src, "the signals guide embeds a live example");
  assert.equal(src, "/examples/counter/frame/");
  const frame = html("/examples/counter/frame/");
  assert.match(frame, /<script id="rivet-docs-frame"/);
  assert.doesNotMatch(frame, /data-rivet-routes|top-bar|speculationrules/, "no docs router, chrome or document prefetch in a frame");
});

test("API reference: index, entry and symbol pages", () => {
  assert.match(html("/api/"), /@rivetjs\/reactivity/);
  assert.match(html("/api/rivetjs/reactivity/"), /href="\/api\/rivetjs\/reactivity\/signal\/"/);
  const signal = html("/api/rivetjs/reactivity/signal/");
  assert.match(signal, /function signal&lt;T&gt;|function signal<T>/);
  assert.match(signal, /import \{ signal \} from &quot;@rivetjs\/reactivity&quot;|import \{ signal \} from "@rivetjs\/reactivity"/);
});

test("search index is written and content pages are marked for indexing", () => {
  assert.ok(existsSync(resolve(client, "pagefind/pagefind.js")));
  assert.match(html("/learn/signals/"), /data-pagefind-body/);
});

test("content pages render on the server: article text is in the HTML", () => {
  const page = html("/reference/glossary/");
  assert.match(page, /<h2[^>]*id="signal"/);
  assert.match(page, /<link rel="canonical" href="[^"]+\/reference\/glossary\/"/);
});

test("starters are offered through StackBlitz form posts", () => {
  const page = html("/start/quick-start/");
  assert.match(page, /action="https:\/\/stackblitz\.com\/run\?file=/);
  assert.match(page, /name="project\[files\]\[package\.json\]"/);
});

test("top bar links the UI docs; old UI component pages are removed", () => {
  const home = html("/");
  // The UI link resolves `site.sites.ui` (production origin from `UI_DOCS_ORIGIN`, the local `:4327` origin otherwise).
  assert.match(home, new RegExp(`href="${site.sites.ui.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/"[^>]*>UI</a>`));
  assert.ok(!existsSync(resolve(client, "ui/components/button/index.html")), "old UI component pages are removed");
});

test("home: _home-perf.json matches the built loader and the cdk tests", () => {
  const perf = JSON.parse(readFileSync(resolve(root, "content/_home-perf.json"), "utf8"));
  assert.deepEqual(stale(perf, html("/"), resolve(root, "../..")), [], "stale content/_home-perf.json: run node apps/docs/scripts/home-perf.ts, then rebuild");
});
