// Large-DOM lanes → dist/<lane>.js + builds.json. node apps/dom-bench/build.ts [--lanes a,b] [--compile-options '<json>']
//   [--base <dir>] [--lane name=compiled.js] [--emit]
//   --base <dir>         lane `rivet-base`: adapters/rivet.jsx against another checkout's libs/{reactivity,runtime} (interleaved
//                        A/B of runtime changes; `git archive HEAD libs/runtime libs/reactivity | tar -x -C <dir>`), compiled with
//                        <dir>/libs/compiler/index.ts when present (A/B compiler emission too).
//   --lane name=file.js  lane `name`: hand-edited compiled output of adapters/rivet.jsx (prototype a compiler emission shape
//                        before a compiler patch; start from --emit).
//   --emit               write the compiler's output for adapters/rivet.jsx to dist/rivet.compiled.js.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { transform } from "@solidjs/compiler";
import { compile } from "@rivetjs/compiler";
import { assertStableSolidModules, stablePackage, stableRequire, stableSolidAliases } from "../resume-bench/stable-dependencies.ts";

const root = dirname(fileURLToPath(import.meta.url));
await mkdir(resolve(root, "dist"), { recursive: true });
interface Artifact {
  framework: string;
  version: string;
  label: string;
  releaseChannel: string;
  compiler: { name: string; version: string; options: Record<string, unknown> };
  raw: number;
  gzip: number;
  brotli: number;
  sha256: string;
  inputs: { path: string; sha256: string }[];
}
const artifacts: Artifact[] = [];
async function versionOf(name: string, entry = name): Promise<string> {
  let directory = dirname(fileURLToPath(import.meta.resolve(entry)));
  for (;;) {
    try {
      const pkg = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as { name?: string; version: string };
      if (pkg.name === name) return pkg.version;
    } catch {}
    const parent = dirname(directory);
    if (parent === directory) throw Error(`Cannot find version ${name}`);
    directory = parent;
  }
}
const versions: Record<string, string> = Object.fromEntries(
  await Promise.all(
    [
      "@rivetjs/runtime",
      "@rivetjs/reactivity",
      "@rivetjs/compiler",
      "react",
      "react-dom",
      "solid-js",
      "@solidjs/web",
      "@solidjs/compiler",
      "esbuild",
      "playwright",
    ].map(async (name) => [name, await versionOf(name, name === "@rivetjs/runtime" ? "@rivetjs/runtime/dom" : name)]),
  ),
);
for (const name of ["solid-js", "babel-preset-solid", "@babel/core"])
  versions[`solid-stable/${name}`] = stablePackage(name).version;
// Extra compiler options, e.g. `--compile-options '{"serverListMounts":false}'`.
const compileOptions: Record<string, unknown> = {
  ...(process.argv.includes("--compile-options") ? (JSON.parse(process.argv[process.argv.indexOf("--compile-options") + 1]!) as Record<string, unknown>) : {}),
};
const args = process.argv.slice(2);
const base = args.includes("--base") ? resolve(args[args.indexOf("--base") + 1]!) : null;
const baseCompiler = base ? resolve(base, "libs/compiler/index.ts") : null;
const compileBase: typeof compile =
  baseCompiler && existsSync(baseCompiler) ? ((await import(pathToFileURL(baseCompiler).href)) as { compile: typeof compile }).compile : compile;
const prebuilt = new Map<string, string>();
args.forEach((a, i) => {
  if (a !== "--lane") return;
  const [name, file] = args[i + 1]!.split("=");
  if (!/^[a-z][a-z0-9-]*$/.test(name!) || !file) throw Error(`--lane name=file.js (lowercase name): ${args[i + 1]}`);
  prebuilt.set(name!, resolve(file));
});
if (args.includes("--emit")) {
  const path = resolve(root, "adapters/rivet.jsx");
  await writeFile(resolve(root, "dist/rivet.compiled.js"), compile(await readFile(path, "utf8"), { target: "dom", filename: path, ...compileOptions }).code);
}
const lanes = [
  ...(args.includes("--lanes") ? args[args.indexOf("--lanes") + 1]!.split(",") : ["rivet", "rivet-v2", "react", "solid", "solid-stable"]),
  ...(base ? ["rivet-base"] : []),
  ...prebuilt.keys(),
].filter((lane, i, all) => all.indexOf(lane) === i);
for (const framework of lanes) {
  // A Rivet variant lane (A/B): the rivet adapter, another runtime (`rivet-base`) or prebuilt compiled output (`--lane`).
  const isPrebuilt = prebuilt.has(framework),
    variant = framework === "rivet-base" || isPrebuilt,
    // Lanes the Rivet compiler builds (the rivet adapter through this or another runtime); `rivet-v2` / prebuilt are hand-lowered.
    rivetCompiled = framework === "rivet" || variant;
  const plugins: Plugin[] =
    framework === "react"
      ? []
      : [
          {
            name: `${framework}-dom`,
            setup(builder) {
              if (framework === "solid-stable") {
                const aliases = stableSolidAliases();
                builder.onResolve({ filter: /^solid-js(?:\/(?:web|store))?$/ }, (args) => {
                  const alias = aliases.find(({ find }) => find.test(args.path));
                  if (!alias) throw Error(`Unresolved stable Solid import ${args.path}`);
                  return { path: alias.replacement };
                });
              }
              if (framework === "rivet-base")
                builder.onResolve({ filter: /^@rivetjs\/(reactivity|runtime)(\/.*)?$/ }, async (a) => {
                  const [, pkg, sub = ""] = /^@rivetjs\/(reactivity|runtime)(\/.*)?$/.exec(a.path)!;
                  const dir = resolve(base!, "libs", pkg!),
                    exports = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8")).exports as Record<string, string | { default: string }>;
                  const entry = exports["." + sub]!;
                  return { path: resolve(dir, typeof entry === "string" ? entry : entry.default) };
                });
              builder.onLoad({ filter: /\.jsx$/ }, async (args) => {
                if (isPrebuilt) return { contents: await readFile(prebuilt.get(framework)!, "utf8"), loader: "js", resolveDir: dirname(args.path) };
                const source = await readFile(args.path, "utf8");
                const result =
                  framework === "rivet" || framework === "rivet-base"
                    ? (framework === "rivet" ? compile : compileBase)(source, { target: "dom", filename: args.path, ...compileOptions })
                    : framework === "solid-stable"
                      ? stableRequire("@babel/core").transformSync(source, {
                          filename: args.path,
                          babelrc: false,
                          configFile: false,
                          presets: [[stableRequire.resolve("babel-preset-solid"), { generate: "dom", hydratable: false, dev: false }]],
                        })
                      : transform(source, {
                        filename: args.path,
                        generate: "dom",
                        hydratable: false,
                        dev: false,
                        sourceNames: false,
                      });
                const { diagnostics } = result as { diagnostics?: unknown[] };
                if (diagnostics?.length) throw new Error(JSON.stringify(diagnostics));
                return { contents: result.code, loader: "js", resolveDir: dirname(args.path) };
              });
            },
          },
        ];
  const entry = resolve(root, variant ? "adapters/rivet.jsx" : `adapters/${framework}.${framework === "rivet-v2" ? "js" : "jsx"}`),
    outfile = resolve(root, `dist/${framework}.js`);
  const result = await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "production"],
    minify: true,
    // External map (no sourceMappingURL comment): bundle bytes unchanged; trace-report.ts symbolizes with it.
    sourcemap: "external",
    metafile: true,
    jsx: "automatic",
    // The app tsconfig.json types these Node scripts only; fixtures use esbuild defaults, not its JSX settings.
    tsconfigRaw: {},
    plugins,
    nodePaths: base ? [resolve(root, "../../node_modules")] : [],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (framework === "solid-stable") assertStableSolidModules(Object.keys(result.metafile.inputs));
  const bytes = await readFile(outfile);
  const inputs = await Promise.all(
    Object.keys(result.metafile.inputs).map(async (path) => ({
      path,
      sha256: createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    })),
  );
  artifacts.push({
    framework,
    version:
      rivetCompiled || framework === "rivet-v2"
        ? versions["@rivetjs/runtime"]
        : framework === "react"
          ? versions.react
          : versions[framework === "solid-stable" ? "solid-stable/solid-js" : "solid-js"],
    label: variant
      ? `Rivet (${framework === "rivet-base" ? `base ${base}` : `prebuilt ${prebuilt.get(framework)}`})`
      : { rivet: "Rivet", "rivet-v2": "Rivet (DOM v2, hand-lowered)", react: "React", solid: "Solid (preview)", "solid-stable": "Solid (stable)" }[framework]!,
    releaseChannel: framework === "solid" ? "preview" : framework.startsWith("rivet") || variant ? "experimental" : "stable",
    compiler: framework === "solid-stable"
      ? { name: "babel-preset-solid", version: versions["solid-stable/babel-preset-solid"]!, options: { generate: "dom", hydratable: false, dev: false } }
      : framework === "solid"
        ? { name: "@solidjs/compiler", version: versions["@solidjs/compiler"]!, options: { generate: "dom", hydratable: false, dev: false, sourceNames: false } }
        : framework === "rivet-v2" || isPrebuilt ? { name: "hand-lowered", version: versions["@rivetjs/runtime"]!, options: { target: "dom-v2" } }
        : { name: rivetCompiled ? "@rivetjs/compiler" : "esbuild", version: versions[rivetCompiled ? "@rivetjs/compiler" : "esbuild"]!, options: { target: "dom", production: true, ...compileOptions } },
    raw: bytes.length,
    gzip: gzipSync(bytes).length,
    brotli: brotliCompressSync(bytes).length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    inputs,
  });
}
await writeFile(
  resolve(root, "dist/builds.json"),
  JSON.stringify({ mode: "production-dom", stableRegistryCheckedAt: "2026-10-04", stableDependencyWorkspace: "apps/bench-stable", versions, artifacts }, null, 2) + "\n",
);
console.log(artifacts.map((a) => `${a.framework}: ${a.raw} bytes (${a.gzip} gzip)`).join("\n"));
