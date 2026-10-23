// T5 build: `rivet({ bridges })` on the fixture app (fake framework, two islands). Facades replace the framework
// modules for Rivet importers and resume-compile (server + client boundary names agree), island chunks share one
// runtime chunk and appear in the manifest (`islands` + `sizes` / `deps`: lean records and fetch-ahead name them), the
// per-page bytes line is logged, and RV2146 warns for a framework hook used in browser code.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createLogger, type Logger } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { fixtureApp } from "./app.ts";

interface Manifest {
  symbols: Record<string, string>;
  sizes: Record<string, number>;
  deps?: Record<string, string[]>;
  islands?: Record<string, string>;
}

/** A logger that records info + warn lines. */
const recorder = (): { logger: Logger; lines: string[] } => {
  const lines: string[] = [];
  const logger = createLogger("info");
  logger.info = (msg) => void lines.push(msg);
  logger.warn = (msg) => void lines.push(msg);
  logger.warnOnce = (msg) => void lines.push(msg);
  return { logger, lines };
};

test("two islands: facades, one runtime chunk, manifest islands + closures, server preload, bytes report", async () => {
  const app = await fixtureApp("build");
  try {
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [app.fake()] })];
    const client = recorder();
    await build({ configFile: false, root: app.root, customLogger: client.logger, plugins: plugins(), build: { outDir: "dist", minify: false } });
    const manifest = JSON.parse(await readFile(resolve(app.root, "dist/.vite/rivet-resume.json"), "utf8")) as Manifest;
    // Island keys → chunk URLs (one per component export — `export default Badge` is Badge's island; a resume build emits
    // every facade loader); each is sized and its static closure listed (the shared runtime chunk).
    assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Counter.fake.js#Counter", "src/Hooks.fake.js#Badge"]);
    const runtimes: string[] = [];
    for (const file of await readdir(resolve(app.root, "dist/assets")))
      if (file.endsWith(".js") && (await readFile(resolve(app.root, "dist/assets", file), "utf8")).includes("FAKE_RUNTIME 1")) runtimes.push(file);
    assert.equal(runtimes.length, 1, "one fake runtime chunk: " + runtimes.join(" "));
    for (const url of Object.values(manifest.islands!)) {
      assert.ok(manifest.sizes[url]! > 0, url);
      const closure = manifest.deps?.[url] ?? [];
      assert.ok(closure.some((dep) => dep.endsWith(runtimes[0]!)) || url.endsWith(runtimes[0]!), url + " closure: " + closure.join(" "));
    }
    // Bytes report, one line per page (resumed-only pages: per island module).
    const report = client.lines.filter((line) => line.startsWith("[rivet:bridge] "));
    assert.ok(report.length >= 1, client.lines.join("\n"));
    for (const line of report) assert.match(line, /^\[rivet:bridge\] \S+: fake \d+\.\d KB br$/);
    // The framework plugin saw the framework modules; the Rivet compiler never compiled them.
    assert.ok([...app.seen].some((file) => file.endsWith("Counter.fake.js")));

    // Server: the facade renders through the server adapter; the chunk preload resolves the island key to its URL.
    await build({
      configFile: false,
      root: app.root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry-server.tsx", minify: false },
    });
    const { render } = (await import(pathToFileURL(resolve(app.root, "dist-server/entry-server.js")).href)) as { render(m: Manifest): Promise<string> };
    const html = await render(manifest);
    assert.match(
      html,
      /<rivet-island data-ri="i0" style="display:contents"><div class="counter"><span class="count">1<\/span><button>\+<\/button><\/div><\/rivet-island>/,
    );
    assert.match(html, /<rivet-island data-ri="i1"[^>]*><b class="badge">badge<\/b><\/rivet-island>/);
    // Every boundary the server recorded exists in the client manifest (same facade text both sides).
    const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)?.[1] ?? '{"b":[]}') as {
      b: [number, number, number, string][];
    };
    for (const [, , , name] of tail.b) assert.ok(name in manifest.symbols, name + " not in client manifest");
    // The `load` island's chunk is named (its lean record or the fetch-ahead list).
    assert.ok(html.includes(manifest.islands!["src/Counter.fake.js#Counter"]!.slice(1)), "island chunk planned: " + html);
  } finally {
    await app.remove();
  }
});

test("RV2146: a framework hook used in a browser handler of a Rivet module warns (client build)", async () => {
  const app = await fixtureApp("rv2146");
  try {
    const client = recorder();
    await build({
      configFile: false,
      root: app.root,
      customLogger: client.logger,
      plugins: [rivet({ resume: { modules: ["src/hooks.tsx"] }, bridges: [app.fake()] })],
      build: { outDir: "dist", minify: false },
    });
    const warning = client.lines.find((line) => line.includes("RV2146"));
    assert.ok(warning, client.lines.join("\n"));
    assert.match(warning!, /Non-component export useThing from a fake module used in browser code of a Rivet file/);
  } finally {
    await app.remove();
  }
});

test("islands: function / extending class / wrapper values only; islands.include + exclude overrides; unused island chunks reported", async () => {
  const app = await fixtureApp("islands");
  try {
    await writeFile(
      resolve(app.root, "src/More.fake.js"),
      `import { component, h } from "../fake/runtime.js";
const view = (cls) => component({ html: () => h("i", cls, cls), attach: () => ({ update() {}, destroy() {} }) });
export const Used = view("used");
export const Spare = view("spare");
export const Widget = { html: () => h("i", "widget", "w"), attach: () => ({ update() {}, destroy() {} }) };
export const Config = { size: 2 };
export const Schema = Object.freeze({ kind: "schema" });
export class Store { size = 1; }
class Base {}
export class Panel extends Base {}
export { Panel as Board };
`,
    );
    await writeFile(
      resolve(app.root, "src/page2.tsx"),
      `import { Used, Widget, Config, Board } from "./More.fake.js";
export function Page() {
  return <main><Used client="load" /><Widget client="load" /><p>{Config.size}</p><p>{typeof Board}</p></main>;
}
`,
    );
    const run = async (islands?: { include?: string[]; exclude?: string[] }) => {
      const out = recorder();
      await build({
        configFile: false,
        root: app.root,
        customLogger: out.logger,
        plugins: [rivet({ resume: { modules: ["src/page2.tsx"] }, bridges: [app.fake(islands ? { islands } : {})] })],
        build: { outDir: "dist-" + (islands ? "override" : "plain"), minify: false },
      });
      const manifest = JSON.parse(
        await readFile(resolve(app.root, "dist-" + (islands ? "override" : "plain") + "/.vite/rivet-resume.json"), "utf8"),
      ) as Manifest;
      return { islands: Object.keys(manifest.islands ?? {}).sort(), lines: out.lines };
    };
    // `view(…)` results are not wrapper calls by name, so only an override makes them islands — here they are made with
    // `component(…)` inside `view`: plain values. The override names them.
    // A class counts only when it `extends` something (`Panel`); a plain class (`Store`) is a model, not a component.
    const plain = await run();
    assert.deepEqual(plain.islands, ["src/More.fake.js#Panel"]);
    // `exclude` wins over detection and over `include`; an alias of an excluded export (`Board` = `Panel`) is a plain
    // re-export too (the build would fail on a facade aliasing a removed local).
    const forced = await run({ include: ["Widget", "src/More.fake.js#U*", "src/More.fake.js#Spare", "Store"], exclude: ["Panel", "src/More.fake.js#St*"] });
    assert.deepEqual(forced.islands, ["src/More.fake.js#Spare", "src/More.fake.js#Used", "src/More.fake.js#Widget"]);
    assert.ok(
      forced.lines.includes("[rivet:bridge] unused islands (chunk emitted, no Rivet module imports it): src/More.fake.js#Spare"),
      forced.lines.join("\n"),
    );
  } finally {
    await app.remove();
  }
});

test("T7b islands-only route: lean tail from the build manifest — island chunk + vendor only, no resume runtime; mixed route adopts its live island", async () => {
  const app = await fixtureApp("lean");
  try {
    await writeFile(
      resolve(app.root, "src/islands.tsx"),
      `import { Counter } from "./Counter.fake.js";
import { Badge } from "./Hooks.fake.js";
export function Islands() {
  return <main><h1>static</h1><Counter client="load" count={1} /><Badge client="visible" label="badge" /></main>;
}
`,
    );
    await writeFile(
      resolve(app.root, "src/entry-islands.tsx"),
      `import { resumableToString } from "@rivetjs/runtime/server-resume";
import { Islands } from "./islands.tsx";
import { Page } from "./page.tsx";
export const islands = (manifest: never) => resumableToString(() => <Islands />, { manifest });
export const mixed = (manifest: never) => resumableToString(() => <Page />, { manifest });
`,
    );
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx", "src/islands.tsx"] }, bridges: [app.fake()] })];
    await build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist", minify: true } });
    await build({
      configFile: false,
      root: app.root,
      logLevel: "silent",
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry-islands.tsx", minify: false },
    });
    const manifest = JSON.parse(await readFile(resolve(app.root, "dist/.vite/rivet-resume.json"), "utf8")) as Manifest & { runtime: string; loader?: string };
    const entry = (await import(pathToFileURL(resolve(app.root, "dist-server/entry-islands.js")).href)) as Record<
      "islands" | "mixed",
      (m: Manifest) => Promise<string>
    >;
    const lean = await entry.islands(manifest);
    assert.ok(!lean.includes('type="rivet/boundaries"') && lean.includes('type="rivet/islands"'), lean);
    // Every script URL the page preloads before input: the `load` island record's closure (chunk + its static imports,
    // the fake vendor), preloaded by the boot after the first paint entry (no link tags).
    assert.ok(!lean.includes("<link"), lean);
    const records = JSON.parse(/<script type="rivet\/islands">([^<]*)<\/script>/.exec(lean)![1]!) as unknown[][];
    const urls = records.filter((r) => r[3] === "load").flatMap((r) => (r[4] as string[] | undefined) ?? []);
    const counter = manifest.islands!["src/Counter.fake.js#Counter"]!;
    assert.deepEqual(urls.sort(), [counter, ...(manifest.deps?.[counter] ?? [])].sort());
    assert.ok(urls.length <= 3, "cold JS requests: " + urls.join(" "));
    // None of them is (or statically imports) the resume runtime / loader.
    const runtime = new Set([manifest.runtime, ...(manifest.deps?.[manifest.runtime] ?? []), manifest.loader].filter(Boolean));
    for (const url of urls) assert.ok(!runtime.has(url), url + " is resume runtime");
    for (const url of urls) {
      const code = await readFile(resolve(app.root, "dist", url.slice(1)), "utf8");
      assert.ok(!/rivet\/boundaries|\$rdp/.test(code), url + " carries resume runtime code");
    }
    assert.ok(!lean.includes(manifest.runtime) && (!manifest.loader || !lean.includes(manifest.loader)), lean);
    // Bytes the lean path adds to the HTML: records + the inline boot (< 2,304 B), no boundaries tail / loader.
    const tail = lean.slice(lean.indexOf("</main>") + 7);
    // Records (two islands, each with its chunk + merged shared chunk URLs: 2026-10-18 `merge` default 65536 names the
    // shared chunk `rivet-merge-…`, +8 B of URL) + the inline boot.
    assert.ok(tail.length < 2304, tail.length + " B tail");
    // The visible island is a record, loaded only when visible (not preloaded).
    assert.ok(lean.includes(JSON.stringify(manifest.islands!["src/Hooks.fake.js#Badge"])), lean);
    // Mixed route (live prop + callback writing a Rivet signal + a text binding): the page's boundary adopts and
    // hydrates the Counter island (no lean record for it); the static-props Badge stays a lean record.
    const mixed = await entry.mixed(manifest);
    assert.ok(mixed.includes('type="rivet/boundaries"'), mixed);
    const mixedRecords = JSON.parse(/<script type="rivet\/islands">([^<]*)<\/script>/.exec(mixed)?.[1] ?? "[]") as unknown[][];
    assert.deepEqual(
      mixedRecords.map((r) => r[1]),
      [manifest.islands!["src/Hooks.fake.js#Badge"]],
    );
  } finally {
    await app.remove();
  }
});
