// Derived model end to end through the real Vite plugin (M2 C3): `rivet({ resume })` builds a
// two-module app (client + SSR builds), the server renders it through the router (`createApp`, which the plugin points at `renderDerived`) and the manifest, Chromium
// loads the page — nothing before input — and a cold click (independent boundary of another module) and a keyed write
// (the page boundary's own signal) adopt the server nodes in place (`RIVET_DERIVED_BYTES=1` prints the page / JS bytes).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync } from "node:zlib";
import { build } from "vite";
import { chromium, type Browser } from "playwright";
import { hasDerivedModel } from "../index.ts";
import { _lazyParts, rivet } from "../vite.ts";
import { expandTail } from "@rivetjs/runtime/resume-format";

const COUNTER = `import { signal } from "@rivetjs/reactivity";
export function Counter(props) {
  const n = signal(props.start);
  return (
    <div class="counter">
      <button type="button" id="inc" onClick={() => n.set(n() + 1)}>+</button>
      <span id="count">{n()}</span>
    </div>
  );
}
// Independent, never touched: it must never run in the browser (\`__componentRuns\`).
export function Other(props) {
  const g = globalThis as any;
  if (typeof g.HTMLElement === "function") g.__componentRuns = (g.__componentRuns ?? 0) + 1;
  const on = signal(false);
  return <p id="other" onClick={() => on.set(!on())}>{props.label}: {on() ? "on" : "off"}</p>;
}
`;
/** The page: `rows: "static"` renders plain rows, `"interactive"` rows with a handler + a class reading a keyed signal. */
const page = (rows: "static" | "interactive") => `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Counter, Other } from "./counter.tsx";
function Footer() {
  return <footer>static footer</footer>;
}
export default function Page(props) {
  const theme = signal("light");
  const selected = signal(0);
  return (
    <main>
      <h1 id="title">{props.data.title}</h1>
      <Counter start={5} />
      <button type="button" id="dark" onClick={() => theme.set("dark")}>Dark</button>
      <p id="theme">{theme()}</p>
      <ul>
        <For each={() => props.data.rows} by={(row) => row.id}>
          {(row) => ${rows === "static" ? "<li>{row().name}</li>" : '<li class={selected() === row().id ? "on" : "off"} onClick={() => selected.set(row().id)}>{row().name}</li>'}}
        </For>
      </ul>
      <Other label="other" />
      <Footer />
    </main>
  );
}
`;
// The server entry renders through the router (`createApp`): on a derived build the plugin resolves the router's
// `@rivetjs/runtime/server-resume` import to the derived renderer.
const SERVER = `import { createApp } from "@rivetjs/router/server";
import Page from "./page.tsx";
const data = { title: "Records", rows: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: "row " + (i + 1) })) };
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => () => Page({ data }),
  document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
};
export const render = async (manifest) => (await createApp({ entry, manifest, csp: false })(new Request("http://x/"))).text();
`;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

interface Built {
  root: string;
  html: string;
  manifest: {
    runtime: string;
    symbols: Record<string, string>;
    builtins?: string;
    deps?: Record<string, string[]>;
    domData?: boolean;
    lazy?: Record<string, string[]>;
  };
}
async function buildApp(rows: "static" | "interactive", roots: string[], domData = false, files: Record<string, string> = {}): Promise<Built> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-derived-" + rows + "-"));
  roots.push(root);
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/counter.tsx"), COUNTER);
  await writeFile(resolve(root, "src/page.tsx"), page(rows));
  await writeFile(resolve(root, "src/server.tsx"), SERVER);
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
  for (const [file, text] of Object.entries(files)) await writeFile(resolve(root, file), text);
  // Two builds (client, then SSR), each with its own plugin instance, like `vite build` + `vite build --ssr`.
  // `serverExports`: the page is a route module (its default export is a route root: an independent boundary).
  const plugin = () =>
    rivet({
      serverExports: { modules: ["src/page.tsx"] },
      resume: { modules: ["src/page.tsx", "src/counter.tsx"], ...(domData ? { domData } : {}) },
    });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
  const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
  const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
  const html: string = await render(manifest);
  return { root, html, manifest };
}

const br = (text: string) => brotliCompressSync(Buffer.from(text)).length;
/** Serve the built client and the rendered page; record every request (path, bytes) in order. */
async function serve(built: Built, browser: Browser, run: (page: import("playwright").Page, requests: { path: string; bytes: number }[]) => Promise<void>) {
  const requests: { path: string; bytes: number }[] = [];
  const http = createHttp(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    try {
      const body = path === "/" ? Buffer.from(built.html) : await readFile(resolve(built.root, "client-dist", "." + path));
      requests.push({ path, bytes: body.length });
      res.setHeader("Content-Type", TYPES[extname(path)] ?? (path === "/" ? "text/html" : "application/octet-stream"));
      res.end(body);
    } catch {
      requests.push({ path, bytes: 0 });
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

/** Page bytes: whole HTML, the resume tail / state script, the inline loader. */
function pageBytes(html: string) {
  const tail = /<script type="rivet\/(?:boundaries|state)"[^>]*>[\s\S]*?<\/script>/.exec(html)?.[0] ?? "";
  const loader =
    /<script(?: nonce="[^"]*")?>\(function\(\)\{[\s\S]*?<\/script>|<script>[\s\S]*?<\/script>/.exec(html.slice(html.indexOf(tail) + tail.length))?.[0] ?? "";
  return { html: html.length, htmlBr: br(html), tail: tail.length, tailBr: br(tail), loader: loader.length, loaderBr: br(loader) };
}

/** JS bytes fetched after the page (every request is on or after the first input: nothing loads before it). */
const jsAfterPage = (requests: { path: string; bytes: number }[]) => requests.slice(1).reduce((sum, r) => sum + (r.path.endsWith(".js") ? r.bytes : 0), 0);
const TAGGED = ["main", "#count", "#inc", "#theme", "#title", "ul li:nth-child(3)"];

(hasDerivedModel() ? test : test.skip)("rivet({ resume }): build, derived tail, boot from the inline loader, cold click + keyed write adopt", async () => {
  const browser = await chromium.launch({ headless: true });
  const roots: string[] = [];
  const bytes: Record<string, unknown> = {};
  try {
    for (const rows of ["interactive", "static"] as const) {
      const derived = await buildApp(rows, roots);
      // Manifest: the derived runtime (the chunk holding it, no re-export facade: B1), boundary names (`<module>#<export>`)
      // → the chunk of their module.
      assert.match(derived.manifest.runtime, /^\/assets\/derived-runtime-.*\.js$/);
      const runtimeChunk = await readFile(resolve(derived.root, "client-dist" + derived.manifest.runtime), "utf8");
      assert.match(runtimeChunk, /as default\}/);
      assert.ok(runtimeChunk.length > 10_000, "the runtime itself, not a facade");
      // The built-in decoders' chunk (DERIVED-S): route payloads with RegExp / binary / errors / registered classes name it.
      assert.match(derived.manifest.builtins!, /^\/assets\/resume-builtins-.*\.js$/);
      assert.deepEqual(Object.keys(derived.manifest.symbols).sort(), ["src/counter.tsx#Counter", "src/counter.tsx#Other", "src/page.tsx#default"]);
      assert.equal(derived.manifest.symbols["src/counter.tsx#Counter"], derived.manifest.symbols["src/counter.tsx#Other"]);
      assert.notEqual(derived.manifest.symbols["src/counter.tsx#Counter"], derived.manifest.symbols["src/page.tsx#default"]);
      const counterChunk = await readFile(resolve(derived.root, "client-dist" + derived.manifest.symbols["src/counter.tsx#Counter"]!), "utf8");
      assert.match(counterChunk, /src\/counter\.tsx#Counter/);
      // Server: the derived tail (module-qualified names, `m` from the manifest; the route root and both counters are
      // independent ATTR boundaries), no serialized state.
      const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>([\s\S]*?)<\/script>/.exec(derived.html)![1]!)) as any;
      assert.deepEqual(
        tail.b.map((r: unknown[]) => [r[3], r[2]]),
        [
          ["src/page.tsx#default", 3],
          ["src/counter.tsx#Counter", 3],
          ["src/counter.tsx#Other", 3],
        ],
      );
      assert.equal(tail.m["src/page.tsx#default"], derived.manifest.symbols["src/page.tsx#default"]);
      assert.ok(!derived.html.includes('type="rivet/state"'));
      // Fetch-ahead (DERIVED-C): the tail lists the runtime + the page's boundary chunks + their static closures
      // (manifest `deps`); the loader modulepreloads them after `load`, nothing evaluates before input.
      const ahead = /data-fo="([^"]*)"/.exec(derived.html)![1]!.split(" ");
      assert.equal(ahead[0], derived.manifest.runtime);
      for (const url of Object.values(tail.m as Record<string, string>)) assert.ok(ahead.includes(url), url);
      for (const url of [derived.manifest.runtime, ...Object.values(tail.m as Record<string, string>)])
        for (const dep of derived.manifest.deps?.[url] ?? []) assert.ok(ahead.includes(dep), dep);
      let derivedInput = 0,
        derivedBefore = 0;
      await serve(derived, browser, async (page, requests) => {
        await page.waitForLoadState("networkidle");
        assert.deepEqual(requests.map((r) => r.path).sort(), ["/", ...ahead].sort(), "only the fetch-ahead list loads before input");
        assert.equal(await page.evaluate(() => (window as { __componentRuns?: number }).__componentRuns), undefined, "nothing evaluated before input");
        derivedBefore = jsAfterPage(requests);
        const fetched = requests.length;
        await page.evaluate((list) => list.forEach((s, i) => ((document.querySelector(s) as any).__t = i + 1)), TAGGED);
        // Cold click on an independent boundary of another module: the loader boots the runtime, Counter adopts alone.
        await page.click("#inc");
        await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
        // Keyed write on the page boundary's own signal: Page adopts (Counter is live already, Other stays deferred).
        await page.click("#dark");
        await page.waitForFunction(() => document.querySelector("#theme")!.textContent === "dark");
        await page.click("#inc");
        await page.waitForFunction(() => document.querySelector("#count")!.textContent === "7");
        if (rows === "interactive") {
          // A row event materialises its row over the server nodes; the keyed write updates every row's class.
          await page.click("ul li:nth-child(3)");
          await page.waitForFunction(() => document.querySelector("ul li:nth-child(3)")!.className === "on");
          assert.equal(await page.evaluate(() => document.querySelectorAll("ul li.on").length), 1);
        }
        const kept = await page.evaluate((list) => list.map((s, i) => (document.querySelector(s) as any)?.__t === i + 1), TAGGED);
        assert.deepEqual(kept, [true, true, true, true, true, true], "server nodes adopted in place");
        assert.equal(await page.evaluate(() => (window as { __componentRuns?: number }).__componentRuns), undefined, "Other never ran in the browser");
        derivedInput = jsAfterPage(requests.slice(fetched - 1));
        assert.equal(requests.length, fetched, "the first input fetches nothing more");
      });
      bytes[rows] = {
        derived: { ...pageBytes(derived.html), jsBeforeInput: derivedBefore, jsOnInput: derivedInput },
      };
    }
    if (process.env.RIVET_DERIVED_BYTES) console.info(JSON.stringify(bytes));
  } finally {
    await browser.close();
    for (const root of roots) await rm(root, { recursive: true, force: true });
  }
});

(hasDerivedModel() ? test : test.skip)(
  "rivet({ resume: { domData: true } }): manifest domData, rows left out of the route payload, read back from the page",
  async () => {
    const browser = await chromium.launch({ headless: true });
    const roots: string[] = [];
    try {
      const plain = await buildApp("interactive", roots);
      assert.equal(plain.manifest.domData, undefined);
      const built = await buildApp("interactive", roots, true);
      assert.equal(built.manifest.domData, true);
      const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>([\s\S]*?)<\/script>/.exec(built.html)![1]!)) as any;
      assert.equal(tail.d?.length, 1, "one d entry: the 50 rows");
      assert.equal(tail.d[0][3], 50);
      assert.ok(!JSON.stringify(tail.b).includes("row 17"), "row names are in the page only");
      assert.ok(pageBytes(built.html).tailBr < pageBytes(plain.html).tailBr);
      // The derived client carries the DOM data reader (its row anchor scan).
      const js = (
        await Promise.all(
          Object.values(built.manifest.deps ?? {})
            .flat()
            .concat(built.manifest.runtime)
            .map((url) => readFile(resolve(built.root, "client-dist" + url), "utf8")),
        )
      ).join("");
      assert.match(js, /r0\(\\d\+\)/);
      await serve(built, browser, async (page) => {
        await page.click("ul li:nth-child(3)");
        await page.waitForFunction(() => document.querySelector("ul li:nth-child(3)")!.className === "on");
        assert.equal(await page.evaluate(() => document.querySelectorAll("ul li.on").length), 1);
        await page.click("#dark");
        await page.waitForFunction(() => document.querySelector("#theme")!.textContent === "dark");
      });
    } finally {
      await browser.close();
      for (const root of roots) await rm(root, { recursive: true, force: true });
    }
  },
);

test("_lazyParts: inline lazyComponent importers only", () => {
  assert.deepEqual(
    _lazyParts(`const A = lazyComponent(() => import("./a.tsx"));
const B = /*#__PURE__*/ lazyComponent<Props>(
  (): Promise<M> => import('./b.tsx'),
  (m) => m.B,
);
const C = lazyComponent(load);
const D = lazyComponent<P>(PAGES[i]!);
const E = () => import("./e.ts");
const F = clientOnly(() => import("./f.tsx"));`),
    ["./a.tsx", "./b.tsx"],
  );
  assert.deepEqual(_lazyParts("no lazy parts here"), []);
});

// IDLE-PREFETCH: a `lazyComponent(() => import(…))` part is its own chunk, listed in the manifest's `lazy` under the chunk of
// the module that imports it (+ its closure in `deps`); the server's tail lists it in `data-fl` (not `data-fo`), the
// browser fetches it after the fetch-ahead list without running it, and opening the part fetches nothing more. A plain
// `import()` is no lazy part.
const LAZY_COUNTER = `import { signal } from "@rivetjs/reactivity";
import { Show, lazyComponent } from "@rivetjs/runtime/dom";
const Panel = lazyComponent(() => import("./panel.tsx"), (module) => module.Panel);
const later = () => import("./later.ts");
export function Counter(props) {
  const n = signal(props.start);
  const open = signal(false);
  return (
    <div class="counter">
      <button type="button" id="inc" onClick={() => (n.set(n() + 1), open.set(true))}>+</button>
      <span id="count">{n()}</span>
      <button type="button" id="later" onClick={() => later().then((m) => m.run())}>later</button>
      <Show when={open}>{() => <Panel label="panel" />}</Show>
    </div>
  );
}
export function Other(props) {
  const on = signal(false);
  return <p id="other" onClick={() => on.set(!on())}>{props.label}: {on() ? "on" : "off"}</p>;
}
`;
const PANEL = `import { signal } from "@rivetjs/reactivity";
(globalThis as any).__panelRuns = ((globalThis as any).__panelRuns ?? 0) + 1;
export function Panel(props) {
  const shown = signal(props.label);
  return <section id="panel">{shown()}</section>;
}
`;

(hasDerivedModel() ? test : test.skip)(
  "rivet({ resume }): lazy parts → manifest lazy + deps, tail data-fl, fetched after the list, opened without a request",
  async () => {
    const browser = await chromium.launch({ headless: true });
    const roots: string[] = [];
    try {
      const built = await buildApp("static", roots, false, {
        "src/counter.tsx": LAZY_COUNTER,
        "src/panel.tsx": PANEL,
        "src/later.ts": "export const run = () => {};\n",
      });
      const counter = built.manifest.symbols["src/counter.tsx#Counter"]!;
      const lazy = built.manifest.lazy!;
      assert.deepEqual(Object.keys(lazy), [counter], "one importer: the counter's chunk");
      assert.equal(lazy[counter]!.length, 1);
      const part = lazy[counter]![0]!;
      assert.match(part, /^\/assets\/panel-.*\.js$/);
      assert.ok(built.manifest.deps![part], "the part's static closure is in deps");
      const ahead = /data-fo="([^"]*)"/.exec(built.html)![1]!.split(" "),
        later = /data-fl="([^"]*)"/.exec(built.html)![1]!.split(" ");
      assert.ok(ahead.includes(counter) && !ahead.includes(part));
      assert.equal(later[0], part);
      for (const url of later) assert.ok(!ahead.includes(url), url);
      assert.ok(!later.some((url) => /later-/.test(url)), "a plain import() is no lazy part");
      await serve(built, browser, async (page, requests) => {
        await page.waitForLoadState("networkidle");
        await page.waitForFunction((n) => document.querySelectorAll('link[rel="modulepreload"]').length === n, ahead.length + later.length);
        await page.waitForLoadState("networkidle");
        const paths = requests.map((r) => r.path);
        assert.ok(paths.indexOf(part) > Math.max(...ahead.map((url) => paths.indexOf(url))), "after the fetch-ahead list");
        assert.equal(await page.evaluate(() => (globalThis as { __panelRuns?: number }).__panelRuns), undefined, "fetched, not evaluated");
        const fetched = requests.length;
        await page.click("#inc");
        await page.waitForFunction(() => document.querySelector("#panel")?.textContent === "panel");
        assert.equal(requests.length, fetched, "opening the part fetches nothing");
      });
      // Without lazy parts (the plain app): no manifest field, no data-fl.
      const plain = await buildApp("static", roots);
      assert.equal(plain.manifest.lazy, undefined);
      assert.doesNotMatch(plain.html, /data-fl=/);
    } finally {
      await browser.close();
      for (const root of roots) await rm(root, { recursive: true, force: true });
    }
  },
);
