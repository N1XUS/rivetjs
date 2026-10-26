// Lite resume end to end through the real Vite plugin (ZERO LITE-WIRE): `rivet({ resume })` emits a lite entry per
// module with lite residuals (compile `lite`) and the lite runtime (`@rivetjs/runtime/dom-lite`), all in a graph of their
// own (`?rivet-lite` copies: no chunk shared with the ordinary client graph). The server picks the lite runtime only for
// a page whose every record has a residual; a page with any other record loads the full runtime and the ordinary chunks
// as before. Chromium: the lite page adopts on its first click with the lite runtime + entry only; a residual that cannot
// adopt the markup falls back to the full runtime copy of the lite graph.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { chromium, type Browser } from "playwright";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";
import { expandTail } from "@rivetjs/runtime/resume-format";

// `Card`: a residual (keyed state, handler, live text; props static). `Stepper`: none (a handler reads a prop).
const CARDS = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { title: string }) {
  const n = signal(0);
  return (
    <div class="card">
      <h3>{props.title}</h3>
      <button type="button" class="inc" onClick={() => n.set(n() + 1)}>{n()}</button>
    </div>
  );
}
export function Stepper(props: { step: number }) {
  const n = signal(0);
  return <button type="button" id="step" onClick={() => n.set(n() + props.step)}>{n()}</button>;
}
`;
const LITE_PAGE = `import { Card } from "./cards.tsx";
export default function Lite() {
  return <main><Card title="a" /><Card title="b" /><Card title="c" /></main>;
}
`;
const FULL_PAGE = `import { Card, Stepper } from "./cards.tsx";
export default function Full() {
  return <main><Card title="a" /><Stepper step={2} /></main>;
}
`;
const SERVER = `import { createApp } from "@rivetjs/router/server";
import Lite from "./lite.tsx";
import Full from "./full.tsx";
const app = (manifest, Page) =>
  createApp({
    entry: {
      routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
      universal: {},
      page: () => () => Page({}),
      document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
    },
    manifest,
    csp: false,
  });
export const render = async (manifest, which) => (await app(manifest, which === "lite" ? Lite : Full)(new Request("http://x/"))).text();
`;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

interface Manifest {
  runtime: string;
  symbols: Record<string, string>;
  deps?: Record<string, string[]>;
  lite?: { runtime: string; symbols: Record<string, string> };
}
interface Built {
  root: string;
  manifest: Manifest;
  pages: { lite: string; full: string };
  /** Build warnings (the plugin warns when the two graphs share a chunk). */
  warnings: string[];
  /** Vite manifest: chunk file → the files it imports statically and dynamically. */
  graph: Map<string, string[]>;
}
async function buildApp(roots: string[]): Promise<Built> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-lite-"));
  roots.push(root);
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/cards.tsx"), CARDS);
  await writeFile(resolve(root, "src/lite.tsx"), LITE_PAGE);
  await writeFile(resolve(root, "src/full.tsx"), FULL_PAGE);
  await writeFile(resolve(root, "src/server.tsx"), SERVER);
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
  const plugin = () =>
    rivet({ serverExports: { modules: ["src/lite.tsx", "src/full.tsx"] }, resume: { modules: ["src/lite.tsx", "src/full.tsx", "src/cards.tsx"] } });
  const warnings: string[] = [];
  await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [plugin()],
    build: { outDir: "client-dist", manifest: true, rollupOptions: { onwarn: (warning) => void warnings.push(warning.message) } },
  });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
  const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8")) as Manifest;
  const vite = JSON.parse(await readFile(resolve(root, "client-dist/.vite/manifest.json"), "utf8")) as Record<
    string,
    { file: string; imports?: string[]; dynamicImports?: string[] }
  >;
  const graph = new Map(
    Object.values(vite).map((record) => ["/" + record.file, [...(record.imports ?? []), ...(record.dynamicImports ?? [])].map((key) => "/" + vite[key]!.file)]),
  );
  const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
  return { root, manifest, warnings, graph, pages: { lite: await render(manifest, "lite"), full: await render(manifest, "full") } };
}

const tailOf = (html: string) => expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!)) as any;
const attr = (html: string, name: string) => new RegExp(` ${name}="([^"]*)"`).exec(html)?.[1];
/** Every chunk reachable from `urls` through static and dynamic imports. */
const reach = (graph: Map<string, string[]>, urls: string[]) => {
  const seen = new Set<string>();
  for (const stack = [...urls]; stack.length;) {
    const url = stack.pop()!;
    if (!seen.has(url)) (seen.add(url), stack.push(...(graph.get(url) ?? [])));
  }
  return seen;
};
/** The chunk URLs a URL's static import closure holds (itself included). */
const closure = (manifest: Manifest, urls: string[]) => new Set(urls.flatMap((url) => [url, ...(manifest.deps?.[url] ?? [])]));

async function serve(built: Built, html: string, browser: Browser, run: (page: import("playwright").Page, requests: string[]) => Promise<void>) {
  const requests: string[] = [];
  const http = createHttp(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    try {
      const body = path === "/" ? Buffer.from(html) : await readFile(resolve(built.root, "client-dist", "." + path));
      requests.push(path);
      res.setHeader("Content-Type", TYPES[extname(path)] ?? (path === "/" ? "text/html" : "application/octet-stream"));
      res.end(body);
    } catch {
      requests.push(path + " 404");
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  try {
    await page.goto(`http://127.0.0.1:${(http.address() as { port: number }).port}/`);
    await run(page, requests);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    http.close();
  }
}

(hasDerivedModel() ? test : test.skip)("lite resume: lite graph of its own, lite runtime only on all-lite pages, adopt + fallback in Chromium", async () => {
  const browser = await chromium.launch({ headless: true });
  const roots: string[] = [];
  try {
    const built = await buildApp(roots);
    const { manifest } = built;
    // Manifest: the lite runtime (the chunk holding dom-lite) and the lite entry of `Card` only.
    assert.ok(manifest.lite, JSON.stringify(manifest));
    assert.deepEqual(Object.keys(manifest.lite.symbols), ["src/cards.tsx#Card"]);
    assert.notEqual(manifest.lite.runtime, manifest.runtime);
    assert.notEqual(manifest.lite.symbols["src/cards.tsx#Card"], manifest.symbols["src/cards.tsx#Card"]);
    const liteRuntime = await readFile(resolve(built.root, "client-dist" + manifest.lite.runtime), "utf8");
    assert.match(liteRuntime, /as default\}/);
    // No chunk shared by the two graphs (the full runtime's chunks are what a build without lite modules makes).
    const full = closure(manifest, [manifest.runtime, ...Object.values(manifest.symbols)]);
    const lite = closure(manifest, [manifest.lite.runtime, ...Object.values(manifest.lite.symbols)]);
    assert.deepEqual(
      [...lite].filter((url) => full.has(url)),
      [],
    );
    // … not even through dynamic imports (a fallback's full runtime + `$c` modules are copies), and no build warning.
    const ordinary = reach(built.graph, [manifest.runtime, ...Object.values(manifest.symbols)]);
    const liteAll = reach(built.graph, [manifest.lite.runtime, ...Object.values(manifest.lite.symbols)]);
    assert.ok(liteAll.size > lite.size, [...liteAll].join(" "));
    assert.deepEqual(
      [...liteAll].filter((url) => ordinary.has(url)),
      [],
    );
    assert.deepEqual(
      built.warnings.filter((message) => message.includes("lite")),
      [],
    );
    assert.ok(lite.size <= 2, [...lite].join(" "));

    // All-lite page: lite runtime, lite entries, fetch-ahead of those only.
    const liteHtml = built.pages.lite;
    assert.equal(attr(liteHtml, "data-rt"), manifest.lite.runtime);
    const liteTail = tailOf(liteHtml);
    assert.deepEqual(
      liteTail.b.map((r: unknown[]) => r[3]),
      ["src/cards.tsx#Card", "src/cards.tsx#Card", "src/cards.tsx#Card"],
    );
    assert.deepEqual(liteTail.m, { "src/cards.tsx#Card": manifest.lite.symbols["src/cards.tsx#Card"] });
    assert.deepEqual(new Set(attr(liteHtml, "data-fo")!.split(" ")), lite);
    // A page with a record without a residual: exactly the ordinary runtime and chunks.
    const fullHtml = built.pages.full;
    assert.equal(attr(fullHtml, "data-rt"), manifest.runtime);
    const fullTail = tailOf(fullHtml);
    for (const [name, url] of Object.entries(fullTail.m as Record<string, string>)) assert.equal(url, manifest.symbols[name], name);
    assert.ok(!fullHtml.includes(manifest.lite.runtime) && !fullHtml.includes(manifest.lite.symbols["src/cards.tsx#Card"]!));

    await serve(built, liteHtml, browser, async (page, requests) => {
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.querySelectorAll(".card *").forEach((el, i) => ((el as unknown as { __t: number }).__t = i + 1)));
      await page.click(".card:nth-child(2) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[1]!.textContent === "1");
      await page.click(".card:nth-child(2) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[1]!.textContent === "2");
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".inc")].map((b) => b.textContent)), ["0", "2", "0"]);
      assert.ok(
        await page.evaluate(() => [...document.querySelectorAll(".card *")].every((el, i) => (el as unknown as { __t: number }).__t === i + 1)),
        "server nodes adopted in place",
      );
      // JS: the lite graph's static closure only (no full runtime, no ordinary chunk).
      assert.deepEqual(new Set(requests.filter((path) => path.endsWith(".js"))), lite);
    });
    await serve(built, fullHtml, browser, async (page, requests) => {
      await page.click("#step");
      await page.waitForFunction(() => document.querySelector("#step")!.textContent === "2");
      await page.click(".inc");
      await page.waitForFunction(() => document.querySelector(".inc")!.textContent === "1");
      for (const path of requests) assert.ok(!lite.has(path), path);
    });
    // Fallback: markup the residual cannot walk (the second card's button removed) → the full runtime of the lite graph
    // takes that boundary (its ordinary module renders it in the browser); the other cards stay lite.
    const broken = liteHtml.replace(/(<h3>b<\/h3>)<button[^>]*>[\s\S]*?<\/button>/, "$1");
    assert.notEqual(broken, liteHtml);
    await serve(built, broken, browser, async (page, requests) => {
      await page.click(".card:nth-child(1) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[0]!.textContent === "1");
      await page.click(".card:nth-child(2) h3");
      await page.waitForFunction(() => document.querySelectorAll(".card:nth-child(2) .inc").length === 1);
      await page.click(".card:nth-child(2) .inc");
      await page.waitForFunction(() => document.querySelector(".card:nth-child(2) .inc")!.textContent === "1");
      await page.click(".card:nth-child(1) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[0]!.textContent === "2");
      const js = requests.filter((path) => path.endsWith(".js"));
      assert.ok(!js.includes(manifest.runtime) && !js.some((path) => full.has(path)), js.join(" "));
      assert.ok(js.length > lite.size, "the fallback loaded the lite graph's full runtime copy");
    });
  } finally {
    await browser.close();
    for (const root of roots) await rm(root, { recursive: true, force: true });
  }
});
