// Context suite build: Rivet (compiler, DOM v2 production lowering / server) vs Solid stable (babel-preset-solid)
// → dist/context/<lane>-{dom,server}.js + builds.json. Run: node apps/dom-bench/context/build.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";
import { assertStableSolidModules, stablePackage, stableRequire, stableSolidAliases } from "../../resume-bench/stable-dependencies.ts";

const here = dirname(fileURLToPath(import.meta.url)),
  out = resolve(here, "../dist/context");
await mkdir(out, { recursive: true });
// `--base <dir>`: also build `rivet-base` against another checkout's libs/{reactivity,runtime} (e.g. a
// `git archive HEAD libs/runtime libs/reactivity` extract) — an interleaved A/B lane for runtime changes.
const base = process.argv.includes("--base") ? resolve(process.argv[process.argv.indexOf("--base") + 1]!) : null;
const lanes = ["rivet", "solid-stable", ...(base ? ["rivet-base"] : [])],
  targets = ["dom", "server"] as const;
const artifacts: { lane: string; target: string; file: string; raw: number; gzip: number; sha256: string }[] = [];
for (const lane of lanes)
  for (const target of targets) {
    const solid = lane === "solid-stable";
    const plugin: Plugin = {
      name: `${lane}-${target}`,
      setup(builder) {
        if (lane === "rivet-base")
          builder.onResolve({ filter: /^@rivetjs\/(reactivity|runtime)(\/.*)?$/ }, async (args) => {
            const [, pkg, sub = ""] = /^@rivetjs\/(reactivity|runtime)(\/.*)?$/.exec(args.path)!;
            const dir = resolve(base!, "libs", pkg!),
              exports = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8")).exports as Record<string, string | { default: string }>;
            const entry = exports["." + sub]!;
            return { path: resolve(dir, typeof entry === "string" ? entry : entry.default) };
          });
        if (solid) {
          const aliases = stableSolidAliases(target === "server");
          builder.onResolve({ filter: /^solid-js(?:\/(?:web|store))?$/ }, (args) => {
            const alias = aliases.find(({ find }) => find.test(args.path));
            if (!alias) throw Error(`Unresolved stable Solid import ${args.path}`);
            return { path: alias.replacement };
          });
        }
        builder.onLoad({ filter: /\.jsx$/ }, async (args) => {
          const source = await readFile(args.path, "utf8");
          const result = solid
            ? stableRequire("@babel/core").transformSync(source, {
                filename: args.path,
                babelrc: false,
                configFile: false,
                presets: [[stableRequire.resolve("babel-preset-solid"), { generate: target === "dom" ? "dom" : "ssr", hydratable: false, dev: false }]],
              })
            : compile(source, { target, filename: args.path });
          const { diagnostics } = result as { diagnostics?: { severity?: string }[] };
          if (diagnostics?.some((d) => d.severity === "error")) throw new Error(JSON.stringify(diagnostics));
          return { contents: result.code, loader: "js", resolveDir: dirname(args.path) };
        });
      },
    };
    const file = `${lane}-${target}.js`,
      outfile = resolve(out, file);
    const result = await build({
      entryPoints: [resolve(here, `${solid ? "solid" : "rivet"}-${target}.js`)],
      // The base lane resolves its own runtime files; dependencies of those still resolve from this repo.
      nodePaths: base ? [resolve(here, "../../../node_modules")] : [],
      outfile,
      bundle: true,
      format: "esm",
      platform: target === "dom" ? "browser" : "node",
      target: "es2022",
      conditions: target === "dom" ? ["browser", "production"] : ["node", "production"],
      minify: !process.argv.includes("--no-minify"),
      metafile: true,
      tsconfigRaw: {},
      plugins: [plugin],
      define: { "process.env.NODE_ENV": '"production"' },
    });
    if (solid) assertStableSolidModules(Object.keys(result.metafile.inputs));
    if (process.argv.includes("--metafile")) await writeFile(resolve(out, `${lane}-${target}.meta.json`), JSON.stringify(result.metafile));
    const bytes = await readFile(outfile);
    artifacts.push({ lane, target, file, raw: bytes.length, gzip: gzipSync(bytes).length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
await writeFile(resolve(out, "builds.json"), JSON.stringify({ suite: "context", solid: stablePackage("solid-js").version, artifacts }, null, 2) + "\n");
console.log(artifacts.map((a) => `${a.lane}-${a.target}: ${a.raw} B (${a.gzip} gzip)`).join("\n"));
