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
import { editorialLoss, homeFacts, homeStrip } from "../content/_charts.ts";
import { stale } from "../scripts/home-perf.ts";
import { site } from "../site.config.ts";
import { buttonVariants } from "../../../libs/ui/styles/src/components/button/index.ts";

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

test("home: benchmarks with losses and their source, real compiler output, how to start", () => {
  const home = html("/");
  assert.match(home, /data-verdict="loss"/, "metrics where Rivet loses stay on the page");
  assert.match(home, /href="\/about\/benchmarks\/"/);
  assert.match(home, /data-layout="stacked"/);
  assert.match(home, /data-pane="dom"[^]*__rivet/);
  assert.match(home, /<pre>npm create rivet@latest<\/pre>/);
  assert.doesNotMatch(home, /not on npm yet|not published|coming soon/i, "no obsolete unpublished-package warnings");
  assert.equal(home.match(/0\.1\.0-alpha\.1 · on npm/g)?.length, home.match(/<pre>npm create rivet@latest<\/pre>/g)?.length, "the published alpha version beside every npm create command");
  assert.doesNotMatch(home, /npm publish pending/);
  // The UI link resolves `site.sites.ui` (production origin from `UI_DOCS_ORIGIN`, the local `:4327` origin otherwise).
  assert.match(home, new RegExp(`href="${site.sites.ui.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/"[^>]*>UI</a>`));
  assert.ok(!existsSync(resolve(client, "ui/components/button/index.html")), "old UI component pages are removed");
  assert.doesNotMatch(home, /<dialog/);
});

test("home: numbers strip = content/_charts.ts homeStrip, each chart linked to its chart and report; the editorial loss row", () => {
  // Hole markers (`<!--[-->…<!--]-->`, derived resume) split text runs: compared without comments.
  const home = html("/").replace(/<!--[^]*?-->/g, "");
  for (const chart of homeStrip) {
    assert.ok(home.includes(`>${chart.big}</data>`), `${chart.id}: big number ${chart.big}`);
    assert.ok(home.includes(`href="/about/benchmarks/#chart-${chart.chart}"`), `${chart.id}: chart link`);
    assert.ok(html("/about/benchmarks/").includes(`id="chart-${chart.chart}"`), `${chart.id}: the chart exists on /about/benchmarks/`);
    for (const point of chart.points) assert.ok(home.includes(`>${point.label}</span>`), `${chart.id}: bar ${point.label}`);
  }
  assert.ok(home.includes(homeStrip.find((c) => c.id === "dynamic")!.loss!.slice(0, 40)), "dynamic chart shows the plain-Solid loss");
  const loss = /<p class="lp-loss" data-verdict="loss">([^]*?)<\/p>/.exec(home)?.[1] ?? "";
  assert.match(loss, /Astro, Eleventy and Hugo ship 0 KB/);
  assert.ok(loss.includes((editorialLoss.rivetInlineJS / 1000).toFixed(1) + " KB") && loss.includes((editorialLoss.rivetFetchedJS / 1000).toFixed(0) + " KB"), loss);
  assert.ok(loss.includes(editorialLoss.source.href));
  assert.ok(!/class="bench-tokens bench-proof"/.test(home), "BenchProof (JS on visible) is not on the home page");
  assert.ok(!home.includes('class="bench-tokens bench-grid"'), "All numbers is a link to /about/benchmarks/, not hidden HTML");
  for (const chart of homeStrip) {
    assert.ok(home.includes(`href="#chart-${chart.id}"`) && home.includes(`id="chart-${chart.id}"`), `${chart.id}: proof strip links its chart`);
    assert.ok(home.includes(`>vs ${chart.peer}</span>`), `${chart.id}: the big number names its peer`);
  }
  assert.equal(home.match(/class="lp-chart-source"/g)?.length, homeStrip.length);
  assert.equal(home.match(/Fair comparison, 2026-10-19/g)?.length, 1, "one source line under the charts");
  const sources = /<p class="lp-charts-source">([^]*?)<\/p>/.exec(home)?.[1] ?? "";
  for (const chart of homeStrip) assert.ok(sources.includes(chart.source.href) && sources.includes(chart.source.text), `${chart.id}: its report is linked in the source line`);
});

test("home: the resume demo's literal button class is ui buttonVariants({ variant: \"primary\" }) (literal = data-only call site = independent boundary)", () => {
  const source = readFileSync(resolve(root, "src/routes/index.tsx"), "utf8");
  const literal = /<ResumeDemo buttonClass="([^"]+)" \/>/.exec(source)?.[1];
  assert.equal(literal, buttonVariants({ variant: "primary" }));
});

test("home: every tab group has exactly one checked radio in the server HTML", () => {
  const home = html("/");
  const radios = [...home.matchAll(/<input type="radio" name="([^"]+)" id="([^"]+)"[^>]*?( checked)?\s*\/?>/g)];
  assert.ok(radios.length > 0);
  const ids = radios.map((m) => m[2]!);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
    "duplicate radio ids (two blocks share a group name)",
  );
  const checked = new Map<string, number>();
  for (const m of radios) checked.set(m[1]!, (checked.get(m[1]!) ?? 0) + (m[3] ? 1 : 0));
  assert.deepEqual(
    [...checked].filter(([, n]) => n !== 1),
    [],
    "radio groups without exactly one checked input",
  );
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
      const blocks = await page.$$eval(".code-compiled", (figures) =>
        figures.map((figure) => {
          const panes = [...figure.querySelectorAll("pre")]
            .filter((pre) => (pre as HTMLElement).offsetHeight > 0)
            .map((pre) => (pre as HTMLElement).dataset.pane);
          const tabs = [...figure.querySelectorAll<HTMLInputElement>(".code-tabs input, .code-out-tabs input")];
          return { layout: figure.getAttribute("data-layout"), panes, checked: tabs.filter((t) => t.checked).map((t) => t.value) };
        }),
      );
      assert.ok(blocks.length >= 1, `expected the tour code block, got ${blocks.length}`);
      for (const block of blocks) {
        assert.equal(block.checked.length, 1, `${block.layout} block: one checked tab (js=${javaScriptEnabled}), got ${block.checked}`);
        if (block.layout === "tabs") assert.deepEqual(block.panes, [block.checked[0]], `tabs block shows the checked pane (js=${javaScriptEnabled})`);
        else assert.ok(block.panes.includes("source"), `stacked block shows its source (js=${javaScriptEnabled})`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("home: _home-perf.json matches the built loader and the cdk tests, the compiled fence is the demo's code", () => {
  const perf = JSON.parse(readFileSync(resolve(root, "content/_home-perf.json"), "utf8"));
  assert.deepEqual(stale(perf, html("/"), resolve(root, "../..")), [], "stale content/_home-perf.json: run node apps/docs/scripts/home-perf.ts, then rebuild");
  const demo = readFileSync(resolve(root, "src/components/home/ResumeDemo.tsx"), "utf8");
  const fence = readFileSync(resolve(root, "content/_home-demo.md"), "utf8");
  for (const line of ["const likes = signal(0);", "likes.update((n) => n + 1)", '{likes()} {likes() === 1 ? "like" : "likes"}'])
    assert.ok(demo.includes(line) && fence.includes(line), `fence and ResumeDemo.tsx both contain: ${line}`);
  const page = html("/");
  assert.match(page, /<span class="rd-where" data-where="">the server only<\/span>/);
  assert.match(page, /class="code-block code-compiled"/);
});

test("home feature grid, AI tooling and get started: links exist, commands are the guides' own", async () => {
  const page = html("/");
  const { pages } = await generateContent(root, { dryRun: true });
  const hrefs = new Set(pages.map((p) => p.href));
  const section = (name: string) => page.slice(page.indexOf(`class="lp-section ${name}"`), page.indexOf("</section>", page.indexOf(`class="lp-section ${name}"`)));
  const cells = [...section("lp-features").matchAll(/<li class="lp-cell">[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?href="([^"]+)"/g)];
  assert.equal(cells.length, 8, "8 feature cells");
  for (const [, title, href] of cells) assert.ok(hrefs.has(href!), `${title} links to a docs page: ${href}`);
  assert.match(section("lp-features"), new RegExp(`1,000-row DOM update: ${homeFacts.domUpdate1000.replace(".", "\\.")}`));
  assert.match(section("lp-features"), new RegExp(`p99 ${homeFacts.streamP99.replace(".", "\\.")} at 5,000 rows vs Razor ${homeFacts.razorP99.replace(".", "\\.")}`));
  const ai = readFileSync(resolve(root, "content/guides/tooling/ai.md"), "utf8");
  const pres = [...section("lp-ai").matchAll(/<pre>([^<]+)<\/pre>/g)].map((m) => m[1]!.replaceAll("&gt;", ">"));
  assert.equal(pres.length, 2);
  for (const command of pres) assert.ok(ai.includes("\n" + command + "\n"), `ai.md has ${command}`);
  const quick = readFileSync(resolve(root, "content/start/quick-start.md"), "utf8");
  const start = [...section("lp-start").matchAll(/<pre>([^<]+)<\/pre>/g)].map((m) => m[1]);
  assert.deepEqual(start.slice(-3), ["npm create rivet@latest my-app", "cd my-app", "npm run dev"]);
  for (const command of start.slice(-3)) assert.ok(quick.includes(command!), `quick start has ${command}`);
});
