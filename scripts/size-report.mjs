// Size report: builds real apps (playground, kit fixture, starters, docs examples) as production
// builds, serves each with the router's node adapter, loads every listed route in headless Chromium
// and records what the page actually ships; also records the ssr-bench lane server bundles.
//
//   npm run size-report                   build + measure, print the table, write .artifacts/size-report/
//   npm run size-report -- --check        also compare with scripts/size-report/baseline.json (exit 1 on growth)
//   npm run size-report -- --update       rewrite scripts/size-report/baseline.{json,md}
//   npm run size-report -- --apps=playground,example:counter --no-lanes   (cdk docs examples: cdk-example:<id>)
//   --apps=... --update                   update only the selected apps, preserving other apps and lanes
//
// Per route: HTML (brotli), resume state bytes (`<script type="rivet/boundaries">` text), inline script
// bytes, the stylesheets the HTML links (count + bytes: CSS before first paint, the router's route sheet incl.), module requests and JS before the first interaction (idle prefetch included), the static
// import closure of the resume runtime (`rt`) and of the page (runtime + every component chunk the
// state names), and module requests/JS caused by the first scripted interaction. JS sizes are the
// emitted (minified) bytes and their brotli size, read from disk. Builds are deterministic, so the
// check is exact: any growth fails unless `--tolerance=<bytes>` allows it.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";
import { spawnSync } from "node:child_process";
import { baselineAfterUpdate } from "./size-report/baseline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = resolve(root, ".artifacts/size-report");
const baselineDir = resolve(root, "scripts/size-report");
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [k, v] = arg.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const { createBuilder } = await import("vite");
const { chromium } = await import("playwright");

const brotli = (bytes) => brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** Docs examples measured (static ones are exercised with their `test` steps). */
const EXAMPLES = [
  "counter",
  "todo-list",
  "loader-data",
  "search-with-debounce",
  "lazy-chunk-demo",
  "nested-layouts",
  "two-way-input",
  "route-transitions",
  "action-form",
  // @rivetjs/motion subpaths (core, gestures, /presence, /layout, /scroll + /in-view).
  "motion-basics",
  "motion-gestures",
  "motion-presence",
  "motion-layout",
  "motion-scroll",
  // ZERO small-page targets (residual / lite runtime candidates: `dom-lite` shows up in rt / eager files when picked).
  "resume-demo",
  "tutorial-03",
  "card-slots",
];

/** cdk docs examples measured (`apps/cdk-docs/examples`; `../assets/*` imports staged from its shared `_assets`). */
const CDK_EXAMPLES = ["masonry-expand", "masonry-feed", "scheduler-views-binding"];

/** App definitions: where the source is, how to stage it, which routes to load, interactions. */
function apps() {
  const list = [
    {
      name: "playground",
      dir: resolve(root, "apps/playground"),
      routes: [
        { path: "/", steps: [{ click: "button:has-text('Increase count')" }, { expect: ["#count", "1"] }] },
        { path: "/items/1" },
        { path: "/resume" },
        { path: "/slots" },
        { path: "/styles" },
        { path: "/nested/one" },
        { path: "/csr" },
      ],
    },
    { name: "kit-fixture", dir: resolve(root, "libs/kit/tests/fixture"), routes: [{ path: "/" }, { path: "/about" }] },
    { name: "router:nav-api", stage: "libs/router/tests/fixture-nav-api", routes: [{ path: "/" }] },
    { name: "router:nested", stage: "libs/router/tests/fixture-nested", routes: [{ path: "/" }] },
    { name: "starter-server", stage: "templates/starter-server", routes: [{ path: "/" }] },
    { name: "starter-static", stage: "templates/starter-static", routes: [{ path: "/", steps: [{ click: "button" }] }] },
    { name: "starter-minimal", stage: "templates/starter-minimal", routes: [{ path: "/" }] },
    { name: "starter-ui", stage: "templates/starter-ui", routes: [{ path: "/", steps: [{ click: "button" }] }] },
  ];
  for (const id of EXAMPLES) list.push({ name: "example:" + id, example: id, routes: [{ path: "/" }] });
  for (const id of CDK_EXAMPLES) list.push({ name: "cdk-example:" + id, example: id, examples: "apps/cdk-docs/examples", routes: [{ path: "/" }] });
  return list;
}

/** Starter files a docs example replaces or never uses. */
const TEMPLATE_SKIP = /^(src\/routes\/|src\/components\/|README\.md$|node_modules\/|dist\/|\.rivet\/)/;

/** Every file below `dir` (relative POSIX paths), skipping node_modules / dist / .rivet. */
async function filesOf(dir, prefix = "") {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (/^(node_modules|dist|\.rivet)$/.test(entry.name)) continue;
    const rel = prefix + entry.name;
    if (entry.isDirectory()) out.push(...(await filesOf(resolve(dir, entry.name), rel + "/")));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

/**
 * Copy a template, or stage a docs example as a standalone app (its starter + its files; components outside
 * src/routes listed as resume modules, as the starter needs), into the work dir. The docs render examples inside
 * the docs app (libs/docs-kit frame routes); this standalone build measures what an app made of the example ships.
 */
async function stage(app) {
  const dir = resolve(work, "apps", app.name.replace(":", "-"));
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  if (app.stage) {
    await cp(resolve(root, app.stage), dir, { recursive: true, filter: (src) => !/(^|\/)(node_modules|dist|\.rivet)(\/|$)/.test(relative(root, src)) });
    return dir;
  }
  const examples = resolve(root, app.examples ?? "apps/docs/examples");
  const source = resolve(examples, app.example);
  const config = (await import(pathToFileURL(resolve(source, "example.ts")).href)).default;
  const template = resolve(root, "templates", config.mode === "server" ? "starter-server" : "starter-static");
  const files = {};
  for (const file of await filesOf(template)) if (!TEMPLATE_SKIP.test(file)) files[file] = await readFile(resolve(template, file));
  const own = (await filesOf(source)).filter((file) => file !== "example.ts");
  for (const file of own) files[file] = await readFile(resolve(source, file));
  const components = own.filter((file) => /^src\/(?!routes\/).*\.tsx$/.test(file));
  if (!own.includes("vite.config.ts") && components.length) {
    const vite = files["vite.config.ts"].toString();
    files["vite.config.ts"] = vite.includes("resume: { modules: [")
      ? vite.replace(/resume: \{ modules: \[[^\]]*\] \}/, `resume: { modules: ${JSON.stringify(components)} }`)
      : vite.replace(/rivetRouter\(\{/, `rivetRouter({ resume: { modules: ${JSON.stringify(components)} },`);
  }
  // Shared example assets (`../assets/<file>` the example does not have): staged from `<examples>/_assets`.
  for (const file of own.filter((f) => f.endsWith(".tsx")))
    for (const [, name] of files[file].toString().matchAll(/from "\.\.\/assets\/([^"?]+)/g))
      if (!files[`src/assets/${name}`] && existsSync(resolve(examples, "_assets", name)))
        files[`src/assets/${name}`] = await readFile(resolve(examples, "_assets", name));
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(dirname(resolve(dir, file)), { recursive: true });
    await writeFile(resolve(dir, file), contents);
  }
  app.routes[0].steps = config.test;
  app.mode = config.mode ?? "static";
  return dir;
}

/** Production client + server build, the way the playground and docs examples build. */
async function build(dir) {
  await rm(resolve(dir, "dist"), { recursive: true, force: true });
  const builder = await createBuilder({
    root: dir,
    configFile: resolve(dir, "vite.config.ts"),
    logLevel: "error",
    builder: {},
    build: { minify: true },
    environments: { ssr: { build: { outDir: "dist/server", manifest: false, rollupOptions: { input: resolve(dir, ".rivet/entry.server.tsx") } } } },
  });
  await builder.buildApp();
}

/** Static import closure of a built chunk (by URL path), resolved on disk under `client`. */
function closure(client, entries) {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    const file = resolve(client, "." + path);
    if (!existsSync(file)) return;
    seen.add(path);
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(/(?:\bimport|\bexport)\s*(?:[^"'();]*?\bfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g)) visit(posix.resolve(posix.dirname(path), m[1]));
  };
  for (const entry of entries) visit(entry);
  return [...seen];
}

function jsSize(client, paths, sizes) {
  let min = 0, br = 0;
  for (const path of paths) {
    const file = resolve(client, "." + path);
    if (!existsSync(file)) continue;
    const s = sizes.get(file) ?? (() => { const bytes = readFileSync(file); const v = { min: bytes.length, br: brotli(bytes) }; sizes.set(file, v); return v; })();
    min += s.min;
    br += s.br;
  }
  return { min, br };
}

/** `/assets/dom-BDObof9X.js` -> `dom.js`: stable names for the committed baseline. */
const unhash = (path) => posix.basename(path).replace(/-[\w-]{8}\.js$/, ".js");

async function run(page, step) {
  if (step.click) await page.click(step.click, { timeout: 5000 });
  else if (step.fill) await page.fill(step.fill[0], step.fill[1], { timeout: 5000 });
  else if (step.press) await page.press(step.press[0], step.press[1], { timeout: 5000 });
  else if (step.expect)
    await page.waitForFunction(([s, t]) => document.querySelector(s)?.textContent?.includes(t) ?? false, step.expect, { timeout: 5000 });
}

const stable = (text) => text.replace(/127\.0\.0\.1:\d+/g, "127.0.0.1:4173");

/** Load one route in Chromium and measure it. */
async function measure(browser, url, client, route, sizes, saveAs) {
  const page = await browser.newPage();
  const scripts = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const pending = new Set();
  page.on("request", (request) => {
    pending.add(request);
    const u = new URL(request.url());
    if (u.origin === new URL(url).origin && (request.resourceType() === "script" || u.pathname.endsWith(".js"))) scripts.push(u.pathname);
  });
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => pending.delete(request));
  // `networkidle` never arrives when a request hangs (seen on CI: 30 s timeout on router:nav-api, 2026-10-20); a bounded
  // wait names what is still in flight and measures what has loaded, so one stuck request does not fail the report.
  const idle = () =>
    page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
      console.warn(`size-report: ${route.path}: not network-idle after 15 s; still pending: ${[...pending].map((r) => r.url()).join(", ") || "(none)"}`);
    });
  // Eager = requested before any interaction. Headless Chromium on Linux (CI) dispatches trusted pointer / mouse
  // events at the virtual cursor (0, 0) after layout; a page whose first link sits there (router fixtures: `body {
  // margin: 0 }`, "Home" at the origin) got a link intent — router table chunk + a `?_rivet=data` prefetch whose
  // unread body kept the network busy — counted as eager on CI only (CI-RED 2026-10-20). Pointer events are
  // swallowed at the window (capture, before every page listener) until the measurement is taken.
  await page.addInitScript(() => {
    const w = /** @type {any} */ (window);
    w.__sizeReportHold = true;
    for (const type of ["pointerover", "pointerenter", "pointermove", "pointerout", "pointerleave", "mouseover", "mouseenter", "mousemove", "mouseout", "mouseleave"])
      addEventListener(type, (event) => w.__sizeReportHold && event.stopImmediatePropagation(), { capture: true });
  });
  try {
    const response = await page.goto(url + route.path, { waitUntil: "load" });
    await idle();
    // The loader's idle prefetch (`data-fo`, `requestIdleCallback`) decides what counts as eager: wait for an idle
    // callback to have run, then for the network again, so a slow runner and a fast laptop see the same request set
    // (CI measured one more eager request than the baseline before this settle, 2026-10-20).
    await page.evaluate(() => new Promise((done) => (window.requestIdleCallback || setTimeout)(() => setTimeout(done, 50))));
    await idle();
    await page.waitForTimeout(300);
    const before = [...new Set(scripts)];
    const doc = await page.evaluate(() => ({
      state: [...document.querySelectorAll('script[type="rivet/boundaries"]')].map((s) => s.textContent ?? ""),
      rt: [...document.querySelectorAll('script[type="rivet/boundaries"][data-rt]')].map((s) => s.dataset.rt),
      inline: [...document.querySelectorAll("script:not([src])")].filter((s) => !s.type || s.type === "module" || s.type === "text/javascript").reduce((n, s) => n + new TextEncoder().encode(s.textContent ?? "").length, 0),
    }));
    // Per-request CSP nonces and the ephemeral port (resume state carries the URL) would make sizes
    // flicker: measure with nonces blanked and a fixed port.
    const html = Buffer.from(stable((await (await fetch(url + route.path)).text()).replace(/nonce="[^"]*"/g, 'nonce=""')));
    if (saveAs) await writeFile(saveAs, html);
    const parsed = doc.state.map((text) => { try { return JSON.parse(text); } catch { return {}; } });
    const rt = [...new Set(doc.rt.filter(Boolean))];
    // Boundary chunks: tail v2 (ZERO S2) URL table `u` (names table `n` indexes it); v1 `m` name → URL.
    const chunks = [...new Set(parsed.flatMap((s) => (s.v === 2 ? (s.u ?? []) : Object.values(s.m ?? {}))))];
    // Render-blocking CSS: the stylesheets the HTML links (app entry + the router's merged route sheet).
    const sheets = [...html.toString().matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)].map((m) => /\bhref="([^"]+)"/.exec(m[0])?.[1]).filter((h) => h?.startsWith("/"));
    const row = {
      status: response?.status() ?? 0,
      htmlBr: brotli(html),
      cssSheets: sheets.length,
      css: jsSize(client, sheets, sizes),
      stateBytes: doc.state.reduce((n, s) => n + Buffer.byteLength(stable(s)), 0),
      inlineBytes: doc.inline,
      eagerRequests: before.length,
      eagerJS: jsSize(client, before, sizes),
      eagerFiles: before.map(unhash),
      runtimeJS: jsSize(client, closure(client, rt), sizes),
      pageJS: jsSize(client, closure(client, [...rt, ...chunks]), sizes),
    };
    // Scripted interactions below are real ones: pointer events reach the page again.
    await page.evaluate(() => void (/** @type {any} */ (window).__sizeReportHold = false));
    if (route.steps?.length) {
      const start = scripts.length;
      try {
        for (const step of route.steps) await run(page, step);
        await idle();
        await page.waitForTimeout(200);
        const after = [...new Set(scripts.slice(start))].filter((p) => !before.includes(p));
        row.interactionRequests = after.length;
        row.interactionJS = jsSize(client, after, sizes);
        row.interactionFiles = after.map(unhash);
      } catch (error) {
        row.interactionError = String(error.message ?? error).split("\n")[0];
      }
    }
    if (errors.length) row.errors = errors;
    return row;
  } finally {
    await page.close();
  }
}

async function measureApp(browser, app) {
  const dir = app.dir ?? (await stage(app));
  const started = performance.now();
  await build(dir);
  const { start } = await import("@rivetjs/router/node");
  const serving = await start({ dist: resolve(dir, "dist"), port: 0, host: "127.0.0.1", onError: () => {} });
  const client = resolve(dir, "dist/client");
  const sizes = new Map();
  const allJS = (await readdir(client, { recursive: true })).filter((f) => f.endsWith(".js")).map((f) => "/" + f.split("\\").join("/"));
  const server = resolve(dir, "dist/server");
  const serverJS = (await readdir(server, { recursive: true })).filter((f) => /\.m?js$/.test(f)).map((f) => "/" + f.split("\\").join("/"));
  const result = { totalJS: { files: allJS.length, ...jsSize(client, allJS, sizes) }, serverJS: jsSize(server, serverJS, sizes), routes: {} };
  try {
    for (const route of app.routes) result.routes[route.path] = await measure(browser, serving.url, client, route, sizes, resolve(work, "html", `${app.name.replace(":", "-")}${route.path.replace(/\//g, "_")}.html`));
  } finally {
    await serving.close();
  }
  console.error(`size-report: ${app.name} measured in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  return result;
}

/** ssr-bench lanes: server bundle per framework (and Qwik's client build). */
function lanes() {
  const r = spawnSync(process.execPath, ["apps/ssr-bench/build.ts"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error("ssr-bench build failed:\n" + r.stderr);
  const builds = JSON.parse(readFileSync(resolve(root, "apps/ssr-bench/dist/builds.json"), "utf8"));
  const out = {};
  for (const a of builds.artifacts) out[a.framework] = { min: a.raw, br: brotli(readFileSync(resolve(root, `apps/ssr-bench/dist/${a.framework}.mjs`))) };
  return out;
}

const kb = (n) => (n === undefined ? "" : n >= 1000 ? (n / 1000).toFixed(2) + " k" : String(n));
const js = (s) => (s ? `${kb(s.min)} / ${kb(s.br)}` : "");

function table(report) {
  const lines = [
    "# Size report",
    "",
    "Generated by `npm run size-report`. JS sizes are `minified / brotli` bytes (k = 1000 B). Eager = requested before the first interaction (idle prefetch included); runtime = static import closure of the resume runtime; page = runtime plus every boundary chunk the page's boundaries tail names (`m`); 1st = new module requests caused by the first scripted interaction.",
    "",
    "| app | route | HTML br | state | inline JS | eager req | eager JS | runtime JS | page JS | 1st req | 1st JS |",
    "|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|",
  ];
  for (const [name, app] of Object.entries(report.apps)) {
    for (const [path, r] of Object.entries(app.routes))
      lines.push(`| ${name} | ${path} | ${kb(r.htmlBr)} | ${kb(r.stateBytes)} | ${kb(r.inlineBytes)} | ${r.eagerRequests} | ${js(r.eagerJS)} | ${js(r.runtimeJS)} | ${js(r.pageJS)} | ${r.interactionRequests ?? (r.interactionError ? "err" : "")} | ${js(r.interactionJS)} |`);
  }
  lines.push("", "CSS before first paint = the stylesheets the route's HTML links (`minified / brotli`).", "", "| app | route | sheets | CSS before first paint |", "|---|---|--:|--:|");
  for (const [name, app] of Object.entries(report.apps)) for (const [path, r] of Object.entries(app.routes)) lines.push(`| ${name} | ${path} | ${r.cssSheets ?? ""} | ${js(r.css)} |`);
  lines.push("", "| app | client JS files | all client JS | server build JS |", "|---|--:|--:|--:|");
  for (const [name, app] of Object.entries(report.apps)) lines.push(`| ${name} | ${app.totalJS.files} | ${js(app.totalJS)} | ${js(app.serverJS)} |`);
  if (report.lanes) {
    lines.push("", "| ssr-bench lane | server bundle |", "|---|--:|");
    for (const [name, s] of Object.entries(report.lanes)) lines.push(`| ${name} | ${js(s)} |`);
  }
  return lines.join("\n") + "\n";
}

/** Numeric leaves that grew (current > baseline + tolerance). */
function growth(base, now, tolerance, at = "") {
  const out = [];
  for (const [key, value] of Object.entries(now ?? {})) {
    const path = at ? at + "." + key : key;
    const old = base?.[key];
    if (typeof value === "number" && typeof old === "number" && !/status|Requests$/.test(key) && value > old + tolerance) out.push(`${path}: ${old} -> ${value} (+${value - old})`);
    else if (typeof value === "number" && typeof old === "number" && /Requests$/.test(key) && value > old) out.push(`${path}: ${old} -> ${value}`);
    else if (value && typeof value === "object" && !Array.isArray(value)) out.push(...growth(old, value, tolerance, path));
  }
  return out;
}

const only = typeof args.apps === "string" ? args.apps.split(",") : undefined;
const report = { apps: {} };
await mkdir(resolve(work, "html"), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const app of apps()) if (!only || only.includes(app.name)) report.apps[app.name] = await measureApp(browser, app);
} finally {
  await browser.close();
}
if (!args["no-lanes"] && !only) report.lanes = lanes();
const md = table(report);
await mkdir(work, { recursive: true });
await writeFile(resolve(work, "report.json"), JSON.stringify(report, null, 2) + "\n");
await writeFile(resolve(work, "report.md"), md);
process.stdout.write(md);
if (args.update) {
  const previous = only ? JSON.parse(await readFile(resolve(baselineDir, "baseline.json"), "utf8")) : null;
  const updated = baselineAfterUpdate(previous, report, Boolean(only));
  await mkdir(baselineDir, { recursive: true });
  await writeFile(resolve(baselineDir, "baseline.json"), JSON.stringify(updated, null, 2) + "\n");
  await writeFile(resolve(baselineDir, "baseline.md"), table(updated));
  console.error("size-report: baseline updated");
}
if (args.check) {
  const base = JSON.parse(await readFile(resolve(baselineDir, "baseline.json"), "utf8"));
  const grew = growth(base, report, Number(args.tolerance ?? 0));
  if (grew.length) {
    console.error("size-report: grew vs scripts/size-report/baseline.json:\n  " + grew.join("\n  "));
    // A different eager request set names the files (a slow runner can prefetch one more chunk before the measurement).
    for (const [name, app] of Object.entries(report.apps))
      for (const [path, route] of Object.entries(app.routes ?? {})) {
        const was = base.apps?.[name]?.routes?.[path]?.eagerFiles;
        // Compared as sets: request order varies run to run (prefetch timing) without changing the measurement.
        if (was && route.eagerFiles && JSON.stringify([...was].sort()) !== JSON.stringify([...route.eagerFiles].sort()))
          console.error(`  ${name} ${path} eager files: ${was.join(" ")} -> ${route.eagerFiles.join(" ")}`);
      }
    process.exit(1);
  }
  console.error("size-report: no growth vs baseline");
}
process.exit(0);
