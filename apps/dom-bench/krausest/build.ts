// Build the krausest-style lanes into <out>/<lane>/{index.html,main.js} plus <out>/manifest.json.
// Usage: node apps/dom-bench/krausest/build.ts [--repo <checkout>] [--out <dir>] [--lanes rivet,vanilla]
//          [--compile-options '{"experimentalDomCompact":true}']
// --repo builds the Rivet lane against another checkout/worktree: its compiler, its runtime and, when that
// checkout has one, its own apps/dom-bench/krausest/rivet.jsx adapter (so API changes travel with the branch).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import { minify } from "rolldown/experimental";
import remapping from "@jridgewell/remapping";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
for (let i = 0; i < args.length; i += 2)
  if (!["--repo", "--out", "--lanes", "--compile-options"].includes(args[i]!) || args[i + 1] === undefined) throw Error(`Unknown or incomplete option ${args[i]}`);
const repo = resolve(option("repo", resolve(here, "../../..")));
const out = resolve(option("out", resolve(here, "../dist/krausest")));
const lanes = option("lanes", "rivet,vanilla").split(",");
// Extra compiler options (`--compile-options '{…}'`).
const compileOptions = { ...(JSON.parse(option("compile-options", "{}")) as Record<string, unknown>) };
const git = (...command: string[]) => {
  try {
    return execFileSync("git", ["-C", repo, ...command], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};
/** Prefer the target checkout's adapter; fall back to this harness's copy for older branches. */
const adapter = (file: string) => {
  const own = resolve(repo, "apps/dom-bench/krausest", file);
  return existsSync(own) ? own : resolve(here, file);
};
const header = (title: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8"/>\n<title>${title}</title>\n<link href="/css/currentStyle.css" rel="stylesheet"/>\n</head>\n<body>\n`;
const buttons = [
  ["run", "Create 1,000 rows"],
  ["runlots", "Create 10,000 rows"],
  ["add", "Append 1,000 rows"],
  ["update", "Update every 10th row"],
  ["clear", "Clear"],
  ["swaprows", "Swap Rows"],
]
  .map(([id, text]) => `<div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="${id}">${text}</button></div>`)
  .join("");
const pages: Record<string, string> = {
  vanilla: `${header('VanillaJS-"keyed"')}<div id="main"><div class="container"><div class="jumbotron"><div class="row"><div class="col-md-6"><h1>VanillaJS-"keyed"</h1></div><div class="col-md-6"><div class="row">${buttons}</div></div></div></div><table class="table table-hover table-striped test-data"><tbody id="tbody"></tbody></table><span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span></div></div>\n<script type="module" src="main.js"></script>\n</body>\n</html>\n`,
  rivet: `${header('Rivet-"keyed"')}<div id="main"></div>\n<script type="module" src="main.js"></script>\n</body>\n</html>\n`,
};
const entries: Record<string, string> = { vanilla: adapter("vanilla.js"), rivet: adapter("rivet.jsx") };

const ACTIVE = new Set(["browser", "production", "import", "default"]);
const pick = (target: unknown): string | null => {
  if (typeof target === "string") return target;
  if (target && typeof target === "object")
    for (const [key, value] of Object.entries(target)) if (ACTIVE.has(key)) {
      const found = pick(value);
      if (found) return found;
    }
  return null;
};
const packages = new Map<string, string>();
for (const entry of readdirSync(resolve(repo, "libs"), { withFileTypes: true }))
  if (entry.isDirectory() && existsSync(resolve(repo, "libs", entry.name, "package.json")))
    packages.set((JSON.parse(readFileSync(resolve(repo, "libs", entry.name, "package.json"), "utf8")) as { name: string }).name, resolve(repo, "libs", entry.name));
function resolveRivet(specifier: string): string {
  const match = /^(@rivetjs\/[^/]+)(\/.*)?$/.exec(specifier)!;
  const directory = packages.get(match[1]!);
  if (!directory) throw Error(`${match[1]} not found under ${repo}/libs`);
  const pkg = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8")) as { exports?: Record<string, unknown>; main?: string };
  const subpath = "." + (match[2] ?? "");
  const target = pick(pkg.exports?.[subpath] ?? (subpath === "." ? pkg.main ?? "./index.ts" : null));
  if (!target) throw Error(`${specifier}: no export ${subpath} for conditions ${[...ACTIVE].join(",")}`);
  return resolve(directory, target);
}

async function rivetPlugin(): Promise<Plugin> {
  const { compile } = (await import(pathToFileURL(resolve(repo, "libs/compiler/index.ts")).href)) as {
    compile: (source: string, options: Record<string, unknown>) => { code: string; diagnostics?: unknown[] };
  };
  return {
    name: "rivet-krausest",
    setup(builder) {
      // Resolve Rivet packages to the target checkout's libs/ directly (package.json exports, browser+production
      // conditions). Never through node_modules: a worktree without its own node_modules would silently fall
      // back to the main checkout's symlinks and measure the wrong sources.
      builder.onResolve({ filter: /^@rivetjs\// }, (args) => ({ path: resolveRivet(args.path) }));
      builder.onLoad({ filter: /\.jsx$/ }, async (args) => {
        const result = compile(await readFile(args.path, "utf8"), { target: "dom", filename: args.path, ...compileOptions });
        if (result.diagnostics?.length) throw Error(JSON.stringify(result.diagnostics));
        return { contents: result.code, loader: "js", resolveDir: dirname(args.path) };
      });
    },
  };
}

const manifest: Record<string, unknown> = {};
for (const lane of lanes) {
  if (!pages[lane]) throw Error(`Unknown lane ${lane}; known: ${Object.keys(pages).join(",")}`);
  const directory = resolve(out, lane);
  await mkdir(directory, { recursive: true });
  const result = await build({
    entryPoints: [entries[lane]!],
    outfile: resolve(directory, "main.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "production"],
    minify: true,
    // External map (no sourceMappingURL comment): bundle bytes unchanged; trace-report.ts symbolizes with it.
    sourcemap: "external",
    metafile: true,
    tsconfigRaw: {},
    plugins: lane === "rivet" ? [await rivetPlugin()] : [],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
  // Second pass with the oxc minifier (what Vite production builds use), source map composed.
  const mainFile = resolve(directory, "main.js");
  const minified = await minify("main.js", await readFile(mainFile, "utf8"), { compress: { target: "es2022" }, mangle: { toplevel: true }, module: true, sourcemap: true });
  // Rivet lane: the V8 eager-compile hint the Vite plugin prepends to every client entry chunk (`libs/compiler/vite.ts`
  // `hintEagerCompile`), so the lane ships what a Rivet app build ships; the map shifts one line.
  const hint = lane === "rivet" ? "//# allFunctionsCalledOnLoad\n" : "";
  const map = remapping([minified.map as never, await readFile(mainFile + ".map", "utf8")], () => null);
  if (hint) map.mappings = ";" + map.mappings;
  await writeFile(mainFile, hint + minified.code);
  await writeFile(mainFile + ".map", map.toString());
  await writeFile(resolve(directory, "index.html"), pages[lane]!);
  const js = await readFile(resolve(directory, "main.js")),
    html = Buffer.from(pages[lane]!);
  manifest[lane] = {
    entry: relative(repo, entries[lane]!).startsWith("..") ? entries[lane] : relative(repo, entries[lane]!),
    compileOptions: lane === "rivet" ? compileOptions : null,
    // krausest 41/42: all implementation files (here index.html + main.js), excluding /css and headers.
    uncompressedBytes: js.length + html.length,
    brotliBytes: brotliCompressSync(js).length + brotliCompressSync(html).length,
    js: { raw: js.length, gzip: gzipSync(js).length, brotli: brotliCompressSync(js).length, sha256: createHash("sha256").update(js).digest("hex") },
    inputs: Object.keys(result.metafile.inputs),
  };
}
await writeFile(
  resolve(out, "manifest.json"),
  JSON.stringify({ built: new Date().toISOString(), repo, commit: git("rev-parse", "HEAD"), dirty: !!git("status", "--porcelain", "--", "libs", "apps/dom-bench"), lanes: manifest }, null, 2) + "\n",
);
for (const [lane, info] of Object.entries(manifest)) console.log(`${lane}: ${(info as { js: { raw: number; brotli: number } }).js.raw} B js (${(info as { js: { brotli: number } }).js.brotli} brotli)`);
