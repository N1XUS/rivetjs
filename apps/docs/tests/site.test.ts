// Checks on the built site (nx `docs:test` depends on `docs:build`): content complete, links,
// examples embedded and built, API pages, search index, no runtime boot on plain content pages.
import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { generateContent } from "@rivetjs/docs-kit/tools/content/generate.ts";
import { checkLinks } from "@rivetjs/docs-kit/tools/check-links.ts";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { homeStrip } from "../content/_charts.ts";
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

test("home: benchmarks with losses and their source, server-rendered component and how to start", () => {
  const home = html("/");
  assert.match(home, /data-verdict="loss"/, "metrics where Rivet loses stay on the page");
  assert.match(home, /href="\/about\/benchmarks\/"/);
  assert.match(home, /id="home-code-component"[^]*?const count = signal\(7\)/);
  assert.match(home, /id="home-code-server"[^]*?&lt;output aria-live=(?:&quot;|")polite(?:&quot;|")&gt;07&lt;\/output&gt;/);
  assert.match(home, /id="home-counter-value"[^>]*>[^]*?07/);
  assert.match(home, /<pre>npm create rivet@latest<\/pre>/);
  assert.doesNotMatch(home, /not on npm yet|not published|coming soon/i, "no obsolete unpublished-package warnings");
  assert.equal(home.match(/0\.1\.0-alpha\.1 · on npm/g)?.length, home.match(/<pre>npm create rivet@latest<\/pre>/g)?.length, "the published alpha version beside every npm create command");
  assert.doesNotMatch(home, /npm publish pending/);
  // The UI link resolves `site.sites.ui` (production origin from `UI_DOCS_ORIGIN`, the local `:4327` origin otherwise).
  assert.match(home, new RegExp(`href="${site.sites.ui.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/"[^>]*>UI</a>`));
  assert.ok(!existsSync(resolve(client, "ui/components/button/index.html")), "old UI component pages are removed");
  assert.doesNotMatch(home, /<dialog/);
});

test("home: numbers strip = content/_charts.ts homeStrip, each summary linked to its chart and report; the dynamic loss row", () => {
  // Hole markers (`<!--[-->…<!--]-->`, derived resume) split text runs: compared without comments.
  const home = html("/").replace(/<!--[^]*?-->/g, "");
  for (const chart of homeStrip) {
    assert.ok(home.includes(`>${chart.big}</data>`), `${chart.id}: big number ${chart.big}`);
    assert.ok(home.includes(`href="/about/benchmarks/#chart-${chart.chart}"`), `${chart.id}: chart link`);
    assert.ok(html("/about/benchmarks/").includes(`id="chart-${chart.chart}"`), `${chart.id}: the chart exists on /about/benchmarks/`);
    assert.ok(home.includes(chart.strip), `${chart.id}: the summary names its peer and measurement`);
  }
  assert.ok(home.includes(homeStrip.find((c) => c.id === "dynamic")!.loss!.slice(0, 40)), "dynamic chart shows the plain-Solid loss");
  const loss = /<p class="hs-proof-caveat" data-verdict="loss">([^]*?)<\/p>/.exec(home)?.[1] ?? "";
  assert.ok(loss.includes(homeStrip.find((c) => c.id === "dynamic")!.loss!), "complete source-derived loss caveat");
  assert.ok(!/class="bench-tokens bench-proof"/.test(home), "BenchProof (JS on visible) is not on the home page");
  assert.ok(!home.includes('class="bench-tokens bench-grid"'), "All numbers is a link to /about/benchmarks/, not hidden HTML");
  assert.equal(home.match(/class="hs-proof-sources"/g)?.length, 1, "one source line under the summaries");
  const sources = /<p class="hs-proof-sources">([^]*?)<\/p>/.exec(home)?.[1] ?? "";
  for (const chart of homeStrip) assert.ok(sources.includes(chart.source.href) && sources.includes(chart.source.text), `${chart.id}: its report is linked in the source line`);
  for (const source of new Set(homeStrip.map((chart) => chart.source.href))) {
    assert.equal(sources.split(`href="${source}"`).length - 1, 1, `${source}: one link per distinct report`);
  }
});

test("home: the workbench is an independent no-prop boundary with labelled increment and decrement controls", () => {
  const source = readFileSync(resolve(root, "src/routes/index.tsx"), "utf8");
  assert.match(source, /<HomeWorkbench\s*\/>/);
  const page = html("/");
  for (const label of ["Increment counter", "Decrement counter"]) assert.match(page, new RegExp(`<button[^>]*aria-label="${label}"`));
});

test("home: every tab group has exactly one selected tab in the server HTML", () => {
  const home = html("/");
  const tabs = [...home.matchAll(/<button\s[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
  assert.equal(tabs.length, 5);
  const ids = tabs.map((tag) => /\bid="([^"]+)"/.exec(tag)![1]!);
  assert.equal(new Set(ids).size, ids.length, "unique tab ids");
  for (const prefix of ["home-tab-", "home-stage-"]) {
    const group = tabs.filter((tag) => tag.includes(`id="${prefix}`));
    assert.equal(group.filter((tag) => tag.includes('aria-selected="true"')).length, 1, `${prefix}: one selected tab`);
  }
  for (const tab of tabs) assert.ok(home.includes(`id="${/aria-controls="([^"]+)"/.exec(tab)![1]}"`), "controlled panel exists");
});

test("home: code panes and tabs agree at first paint (with and without JS)", async () => {
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
  const server = createServer((req, res) => {
    let path = resolve(client, "." + decodeURIComponent(new URL(req.url!, "http://x").pathname));
    if (existsSync(path) && !path.includes(".", path.lastIndexOf("/"))) path = resolve(path, "index.html");
    if (!existsSync(path)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    for (const javaScriptEnabled of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, javaScriptEnabled });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
      const blocks = await page.$$eval(".hs-workbench", (figures) =>
        figures.map((figure) => {
          const panes = [...figure.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((pre) => pre.offsetHeight > 0).map((pre) => pre.id);
          const tabs = [...figure.querySelectorAll('[role="tab"]')];
          return { panes, checked: tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.getAttribute("aria-controls")) };
        }),
      );
      assert.equal(blocks.length, 1, "one component workbench");
      for (const block of blocks) {
        assert.equal(block.checked.length, 1, `one selected tab (js=${javaScriptEnabled})`);
        assert.deepEqual(block.panes, block.checked, `only the selected pane is visible (js=${javaScriptEnabled})`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("home: _home-perf.json matches the built loader and the cdk tests; the workbench source agrees with the counter", () => {
  const perf = JSON.parse(readFileSync(resolve(root, "content/_home-perf.json"), "utf8"));
  assert.deepEqual(stale(perf, html("/"), resolve(root, "../..")), [], "stale content/_home-perf.json: run node apps/docs/scripts/home-perf.ts, then rebuild");
  const demo = readFileSync(resolve(root, "src/components/home/HomeWorkbench.tsx"), "utf8");
  assert.equal(demo.split("const count = signal(7);").length - 1, 2, "displayed source and live component begin with the same signal value");
  const page = html("/");
  assert.match(page, /id="home-counter-value"[^>]*>[^]*?07/);
  assert.match(page, /id="home-code-component"/);
});

test("home docs directory and get started: destinations exist, install command is the guide's own", async () => {
  const page = html("/");
  const { pages } = await generateContent(root, { dryRun: true });
  const hrefs = new Set(pages.map((p) => p.href));
  const directory = /<div class="hs-doc-links">([^]*?)<p class="hs-end-note"/.exec(page)?.[1] ?? "";
  const links = [...directory.matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, ["/start/what-is-rivet/", site.sites.ui + "/", site.sites.cdk + "/"]);
  for (const href of links.filter((link) => link!.startsWith("/"))) assert.ok(hrefs.has(href!), `directory links to a docs page: ${href}`);
  assert.ok(hrefs.has("/learn/resuming/"), "the architecture explanation links to the resumability guide");
  assert.match(page, /href="\/learn\/resuming\/"/);
  const quick = readFileSync(resolve(root, "content/start/quick-start.md"), "utf8");
  const start = /<pre>(npm create rivet@latest)<\/pre>/.exec(page)?.[1];
  assert.ok(start && quick.includes(start), "quick start documents the homepage install command");
  assert.match(page, /href="\/start\/quick-start\/"/);
});
