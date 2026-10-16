// @rivetjs/ui bytes per component + per page (identity lane, spec docs/design/specs/2026-10-11-ui-identity-design.md §8.2).
// - JS: every runtime `exports` entry of libs/ui bundled like zero-cost/packages-hashes.mjs (own code; other packages
//   external; `.tsx` compiled for `dom` and `server`), minified + brotli.
// - CSS: the component's stylesheet. Per-component files (`libs/ui/styles/out/<name>.css`, after the CSS split; a folded
//   crumb counts its parent's file, build-css.ts `FOLDS`) when
//   built, else its share of the single compiled bundle (rules whose first class is one of the file's BEM blocks).
// - Pages: client builds of `fixtures/ui-pages/<name>.tsx` (one route each, the starter-ui setup) → the CSS linked
//   before first paint (app styles + route sheet) + every JS chunk.
// Writes scripts/size-report/ui-components.json + ui-components.md; `--check` compares with them (exact) instead.
// Usage: node scripts/size-report/ui-components.mjs [--check] [--no-pages] [--only=button,select]
import { createRequire } from "node:module";
import { brotliCompressSync } from "node:zlib";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const require = createRequire(root + "/package.json");
const { rolldown } = await import(require.resolve("rolldown"));
const { compile } = await import(`${root}/libs/compiler/index.ts`);
const tw = await import(require.resolve("@tailwindcss/node"));
const postcss = (await import(require.resolve("postcss"))).default;
const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const outJson = `${root}/scripts/size-report/ui-components.json`;
const outMd = `${root}/scripts/size-report/ui-components.md`;
const ui = `${root}/libs/ui`;

const br = (s) => brotliCompressSync(Buffer.from(s)).length;
const pair = (s) => [Buffer.byteLength(s), br(s)];

function rivet(target, seen) {
  return {
    name: "rivet-compile",
    transform(source, id) {
      if (!id.endsWith(".tsx")) return null;
      seen.tsx = true;
      const result = compile(source, { target, filename: id });
      if (result.diagnostics.length) throw new Error(`${id}: ${result.diagnostics.map((d) => d.message).join("; ")}`);
      return { code: result.code, moduleType: "ts" };
    },
  };
}

async function bundle(input, target) {
  const seen = { tsx: false };
  const b = await rolldown({
    input,
    platform: "node",
    logLevel: "silent",
    external: (id) => id.startsWith("node:") || id.endsWith(".css") || !(id.startsWith(".") || id.startsWith("/") || id.startsWith("\0") || id.startsWith("#")),
    resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    plugins: [rivet(target, seen)],
  });
  const { output } = await b.generate({ format: "esm", minify: true });
  return { code: output[0].code, tsx: seen.tsx };
}

/** BEM blocks of the top-level rules of a component stylesheet (`.button {`, `.modal__backdrop {` → `modal`). */
function blocks(file) {
  const set = new Set();
  for (const m of readFileSync(file, "utf8").matchAll(/^\.([a-z][a-z0-9_-]*)(?=[\s{,:[.>])/gm)) set.add(m[1].split(/__|--/)[0]);
  return set;
}

/** Compiled single bundle (today's `@rivetjs/ui/styles` with no app utilities), minified, split into rules per block. */
async function bundleShares(names) {
  const c = await tw.compile(readFileSync(`${ui}/styles/index.css`, "utf8"), { base: `${ui}/styles`, onDependency() {} });
  const css = tw.optimize(c.build([]), { minify: true }).code;
  const owner = new Map(); // block → component
  for (const name of names) {
    const file = `${ui}/styles/components/${name}.css`;
    if (existsSync(file)) for (const b of blocks(file)) if (!owner.has(b)) owner.set(b, name);
  }
  const byBlockLength = [...owner.keys()].sort((a, b) => b.length - a.length);
  const share = {};
  postcss.parse(css).walkRules((rule) => {
    const first = /\.([a-z][\w-]*)/.exec(rule.selector)?.[1];
    if (!first) return;
    const block = byBlockLength.find((b) => first === b || first.startsWith(b + "__") || first.startsWith(b + "--"));
    if (!block) return;
    const name = owner.get(block);
    (share[name] ??= []).push(rule.toString());
  });
  return { total: pair(css), share: Object.fromEntries(Object.entries(share).map(([k, v]) => [k, pair(v.join(""))])) };
}

/** Per-component compiled files (CSS split): own file + every ui component stylesheet its JS graph imports. */
function splitFiles() {
  const out = `${ui}/styles/out`;
  if (!existsSync(out)) return null;
  const files = {};
  for (const f of readdirSync(out).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(join(out, f), "utf8");
    files[f.slice(0, -4)] = pair(css);
    // A folded crumb (build-css.ts `FOLDS`, header `from …/components/{child,parent}.css`) is linked as its parent's file.
    const folded = /^\/\* Generated by [^ ]+ from libs\/ui\/styles\/components\/\{([\w,-]+)\}\.css/.exec(css);
    for (const name of folded?.[1].split(",") ?? []) files[name] = files[f.slice(0, -4)];
  }
  return files;
}

const pkg = JSON.parse(readFileSync(`${ui}/package.json`, "utf8"));
const entries = Object.entries(pkg.exports)
  .filter(([key, value]) => typeof value !== "string" && !(value.default ?? "").endsWith(".css") && key !== ".")
  .map(([key, value]) => ({ name: key.slice(2), file: value.default }))
  .filter((e) => !only || only.includes(e.name));

const result = { components: {}, pages: {}, bundle: null };
const split = splitFiles();
const shares = split ? null : await bundleShares(entries.map((e) => e.name));
if (shares) result.bundle = shares.total;
for (const { name, file } of entries) {
  const dom = await bundle(`${ui}/${file}`, "dom");
  const row = { dom: pair(dom.code) };
  if (dom.tsx) row.server = pair((await bundle(`${ui}/${file}`, "server")).code);
  row.css = split ? (split[name] ?? [0, 0]) : (shares.share[name] ?? [0, 0]);
  result.components[name] = row;
}

if (!args.includes("--no-pages")) {
  const { build } = await import(require.resolve("vite"));
  const { rivetRouter } = await import(require.resolve("@rivetjs/router/vite"));
  const tailwindcss = (await import(require.resolve("@tailwindcss/vite"))).default;
  const fixtures = `${root}/scripts/size-report/fixtures/ui-pages`;
  for (const f of readdirSync(fixtures).filter((f) => f.endsWith(".tsx"))) {
    const name = f.slice(0, -4);
    if (only && !only.includes(name)) continue;
    const app = `${root}/.artifacts/ui-pages/${name}`;
    rmSync(app, { recursive: true, force: true });
    mkdirSync(`${app}/src/routes`, { recursive: true });
    cpSync(`${fixtures}/${f}`, `${app}/src/routes/index.tsx`);
    cpSync(`${fixtures}/styles.css`, `${app}/src/styles.css`);
    cpSync(`${root}/templates/starter-ui/src/document.ts`, `${app}/src/document.ts`);
    await build({
      root: app,
      configFile: false,
      logLevel: "warn",
      plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
      build: { outDir: `${app}/dist/client` },
    });
    const client = `${app}/dist/client`;
    const assets = `${client}/assets`;
    let js = "";
    for (const a of readdirSync(assets)) if (a.endsWith(".js") && statSync(join(assets, a)).isFile()) js += readFileSync(join(assets, a), "utf8");
    // CSS = the stylesheets the page links before first paint: the app entry's (router `styles`) + the route sheet
    // (`.vite/rivet-route-css.json`; the router merges a route's component stylesheets into one).
    const manifest = JSON.parse(readFileSync(`${client}/.vite/manifest.json`, "utf8"));
    const global = Object.values(manifest)
      .filter((r) => r.isEntry && !r.src?.includes("rivet-resume-chunk:"))
      .flatMap((r) => (r.file.endsWith(".css") ? [r.file] : (r.css ?? [])));
    const routeCss = existsSync(`${client}/.vite/rivet-route-css.json`) ? JSON.parse(readFileSync(`${client}/.vite/rivet-route-css.json`, "utf8")) : {};
    const linked = [...new Set([...global, ...(routeCss.index ?? []).map((href) => href.replace(/^\//, ""))])];
    const css = linked.map((file) => readFileSync(`${client}/${file}`, "utf8")).join("");
    result.pages[name] = { css: pair(css), sheets: linked.length, js: pair(js) };
  }
}

const k = (n) => (n >= 1000 ? (n / 1000).toFixed(2) + " k" : String(n));
const cell = (p) => (p ? `${k(p[0])} / ${k(p[1])}` : "");
function markdown(r) {
  const lines = [
    "# @rivetjs/ui bytes per component",
    "",
    "Generated by `node scripts/size-report/ui-components.mjs`. Sizes are `minified / brotli` bytes (k = 1000 B). JS = the subpath's own code (other packages external), `dom` / `server` compile targets. CSS = " +
      (split
        ? "its compiled per-component stylesheet (`libs/ui/styles/out/<name>.css`)."
        : "its share of the single compiled `@rivetjs/ui/styles` bundle (rules of the file's BEM blocks)") +
      (r.bundle ? `; whole bundle ${cell(r.bundle)}.` : ""),
    "",
    "## Pages (fixtures/ui-pages, starter-ui setup, client build)",
    "",
    "CSS = the stylesheets the page links before first paint (app styles + the router's route sheet); JS = every client chunk.",
    "",
    "| page | CSS | sheets | JS |",
    "|---|--:|--:|--:|",
    ...Object.entries(r.pages).map(([n, p]) => `| ${n} | ${cell(p.css)} | ${p.sheets ?? ""} | ${cell(p.js)} |`),
    "",
    "## Components",
    "",
    "`@rivetjs/cdk` stays external here, so a cdk import kept for a fold (the server slot probe `@rivetjs/cdk/slot-probe`: ~70 B per importing subpath) shows up as an import; real browser bundles resolve it to constants and fold it away (0 B).",
    "",
    "| subpath | dom JS | server JS | CSS |",
    "|---|--:|--:|--:|",
    ...Object.entries(r.components).map(([n, c]) => `| ${n} | ${cell(c.dom)} | ${cell(c.server)} | ${cell(c.css)} |`),
    "",
  ];
  return lines.join("\n");
}

if (check) {
  const pinned = JSON.parse(readFileSync(outJson, "utf8"));
  const diffs = [];
  for (const [n, c] of Object.entries(result.components))
    if (JSON.stringify(c) !== JSON.stringify(pinned.components[n])) diffs.push(`${n}: ${JSON.stringify(pinned.components[n])} → ${JSON.stringify(c)}`);
  for (const [n, p] of Object.entries(result.pages))
    if (JSON.stringify(p) !== JSON.stringify(pinned.pages[n])) diffs.push(`page ${n}: ${JSON.stringify(pinned.pages[n])} → ${JSON.stringify(p)}`);
  if (diffs.length) {
    console.error("ui-components: bytes changed:\n  " + diffs.join("\n  "));
    process.exit(1);
  }
  console.log(`ui-components: identical (${Object.keys(result.components).length} subpaths, ${Object.keys(result.pages).length} pages)`);
} else if (only) {
  console.log(markdown(result));
} else {
  writeFileSync(outJson, JSON.stringify(result, null, 1) + "\n");
  writeFileSync(outMd, markdown(result));
  console.log(markdown(result).split("\n").slice(0, 14).join("\n"));
}
