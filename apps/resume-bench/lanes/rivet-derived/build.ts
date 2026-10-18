// Spike S2 lane `rivet-derived` (docs/design/research/2026-10-18-beyond-resume-hydration.md §8): the resume-bench
// fixture as a hand-written *derived client* — the server emits the static page + a values tail (loader data + keyed
// signal values) and no structure (no handler / binding records, no per-element ids); the browser gets an inline
// loader (holds events, fetches the slice ahead at idle, evaluates it on the first input / trigger) and a route slice
// written the way a compiler would emit it (src/d.js). Stands in for compiler output; no framework code runs.
import { build as esbuild, transform } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { items } from "../../data.ts";
import { writeBuildManifest } from "../../provenance.ts";

const root = fileURLToPath(new URL("./", import.meta.url));
const work = resolve(root, "../../.build/rivet-derived");

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The page's static HTML, as the compiled server target renders it (same DOM as lanes/rivet/page.tsx). */
function html(loader: string): string {
  let rows = "";
  for (const item of items)
    rows += `<li class="row" data-id="${item.id}"><a class="open" href="/item/${item.id}">${escape(item.label)}</a><button class="pick">pick</button></li>`;
  const values = JSON.stringify({ items, v: { count: 0, open: false, query: "", picked: 0, scrolled: false } });
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>bench</title><style>#bar{position:sticky;top:0;background:#fff}</style></head><body>' +
    '<main><header id="bar"><button id="inc">+</button><output id="count">0</output><span id="scrolled">top</span></header>' +
    '<button id="toggle">toggle</button><div id="panel"><p id="closed">closed</p></div>' +
    `<section><input id="filter" type="search" value=""><ul id="rows">${rows}</ul></section>` +
    '<canvas id="chart" width="300" height="150"></canvas></main>' +
    `<script type="application/json" id="rv">${values.replace(/</g, "\\u003c")}</script>` +
    `<script>${loader}</script></body></html>`
  );
}

export async function build(outDir: string): Promise<void> {
  await rm(work, { recursive: true, force: true });
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await esbuild({
    entryPoints: ["d.js", "detail.js", "a.js"].map((f) => resolve(root, "src", f)),
    outdir: outDir,
    bundle: false,
    minify: true,
    format: "esm",
    sourcemap: false,
    logLevel: "warning",
  });
  const loader = (await transform(await readFile(resolve(root, "src/loader.js"), "utf8"), { minify: true, format: "iife" })).code.trim();
  await writeFile(resolve(outDir, "index.html"), html(loader));
  await writeBuildManifest("rivet-derived", outDir);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) await build(resolve(work, "out"));
