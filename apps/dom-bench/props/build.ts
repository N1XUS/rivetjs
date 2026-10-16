// Props suite build: Rivet (compiler, DOM v2 production lowering) vs Solid stable (babel-preset-solid) →
// dist/props/<lane>.js + builds.json. Run: node apps/dom-bench/props/build.ts [--base <dir>] [--lane name=compiled.js] [--emit]
//   --base <dir>         lane `rivet-base` built against another checkout's libs/{reactivity,runtime} (A/B runtime changes);
//                        compiled with <dir>/libs/compiler/index.ts when present (A/B compiler emission + runtime ABI).
//   --lane name=file.js  lane `name`: hand-edited compiled output of rivet.jsx (prototype a compiler emission shape).
//   --emit               write the compiler's output for rivet.jsx to dist/props/rivet.compiled.js (starting point for --lane).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";
import { assertStableSolidModules, stablePackage, stableRequire, stableSolidAliases } from "../../resume-bench/stable-dependencies.ts";

const here = dirname(fileURLToPath(import.meta.url)),
  out = resolve(here, "../dist/props");
await mkdir(out, { recursive: true });
const args = process.argv.slice(2);
const base = args.includes("--base") ? resolve(args[args.indexOf("--base") + 1]!) : null;
const baseCompiler = base ? resolve(base, "libs/compiler/index.ts") : null;
const compileBase: typeof compile =
  baseCompiler && existsSync(baseCompiler) ? ((await import(pathToFileURL(baseCompiler).href)) as { compile: typeof compile }).compile : compile;
const prebuilt = new Map<string, string>();
args.forEach((a, i) => {
  if (a !== "--lane") return;
  const [name, file] = args[i + 1]!.split("=");
  prebuilt.set(name!, resolve(file!));
});
const lanes = ["rivet", "solid-stable", ...(base ? ["rivet-base"] : []), ...prebuilt.keys()];
if (args.includes("--emit")) {
  const source = await readFile(resolve(here, "rivet.jsx"), "utf8");
  await writeFile(resolve(out, "rivet.compiled.js"), compile(source, { target: "dom", filename: resolve(here, "rivet.jsx") }).code);
}
const artifacts: { lane: string; file: string; raw: number; gzip: number; sha256: string }[] = [];
for (const lane of lanes) {
  const solid = lane === "solid-stable";
  const plugin: Plugin = {
    name: lane,
    setup(builder) {
      if (lane === "rivet-base")
        builder.onResolve({ filter: /^@rivetjs\/(reactivity|runtime)(\/.*)?$/ }, async (a) => {
          const [, pkg, sub = ""] = /^@rivetjs\/(reactivity|runtime)(\/.*)?$/.exec(a.path)!;
          const dir = resolve(base!, "libs", pkg!),
            exports = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8")).exports as Record<string, string | { default: string }>;
          const entry = exports["." + sub]!;
          return { path: resolve(dir, typeof entry === "string" ? entry : entry.default) };
        });
      if (solid) {
        const aliases = stableSolidAliases(false);
        builder.onResolve({ filter: /^solid-js(?:\/(?:web|store))?$/ }, (a) => {
          const alias = aliases.find(({ find }) => find.test(a.path));
          if (!alias) throw Error(`Unresolved stable Solid import ${a.path}`);
          return { path: alias.replacement };
        });
      }
      builder.onLoad({ filter: /\.jsx$/ }, async (a) => {
        if (prebuilt.has(lane)) return { contents: await readFile(prebuilt.get(lane)!, "utf8"), loader: "js", resolveDir: dirname(a.path) };
        const source = await readFile(a.path, "utf8");
        const result = solid
          ? stableRequire("@babel/core").transformSync(source, {
              filename: a.path,
              babelrc: false,
              configFile: false,
              presets: [[stableRequire.resolve("babel-preset-solid"), { generate: "dom", hydratable: false, dev: false }]],
            })
          : (lane === "rivet-base" ? compileBase : compile)(source, { target: "dom", filename: a.path });
        const { diagnostics } = result as { diagnostics?: { severity?: string }[] };
        if (diagnostics?.some((d) => d.severity === "error")) throw new Error(JSON.stringify(diagnostics));
        return { contents: result.code, loader: "js", resolveDir: dirname(a.path) };
      });
    },
  };
  const file = `${lane}.js`,
    outfile = resolve(out, file);
  const result = await build({
    entryPoints: [resolve(here, `${solid ? "solid" : "rivet"}-dom.js`)],
    nodePaths: base ? [resolve(here, "../../../node_modules")] : [],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "production"],
    minify: !args.includes("--no-minify"),
    metafile: true,
    tsconfigRaw: {},
    plugins: [plugin],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (solid) assertStableSolidModules(Object.keys(result.metafile.inputs));
  const bytes = await readFile(outfile);
  artifacts.push({ lane, file, raw: bytes.length, gzip: gzipSync(bytes).length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
await writeFile(resolve(out, "builds.json"), JSON.stringify({ suite: "props", solid: stablePackage("solid-js").version, artifacts }, null, 2) + "\n");
console.log(artifacts.map((a) => `${a.lane}: ${a.raw} B (${a.gzip} gzip)`).join("\n"));
