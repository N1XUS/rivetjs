import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const lanes = process.argv.includes("--lanes") ? process.argv[process.argv.indexOf("--lanes") + 1]!.split(",") : ["rivet", "rivet-v2", "react", "solid", "solid-stable"];
for (const framework of lanes) {
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
              builder.onLoad({ filter: /\.jsx$/ }, async (args) => {
                const source = await readFile(args.path, "utf8");
                const result =
                  framework === "rivet"
                    ? compile(source, { target: "dom", filename: args.path, ...compileOptions })
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
  const entry = resolve(root, `adapters/${framework}.${framework === "rivet-v2" ? "js" : "jsx"}`),
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
      framework === "rivet" || framework === "rivet-v2"
        ? versions["@rivetjs/runtime"]
        : framework === "react"
          ? versions.react
          : versions[framework === "solid-stable" ? "solid-stable/solid-js" : "solid-js"],
    label: { rivet: "Rivet", "rivet-v2": "Rivet (DOM v2, hand-lowered)", react: "React", solid: "Solid (preview)", "solid-stable": "Solid (stable)" }[framework]!,
    releaseChannel: framework === "solid" ? "preview" : framework.startsWith("rivet") ? "experimental" : "stable",
    compiler: framework === "solid-stable"
      ? { name: "babel-preset-solid", version: versions["solid-stable/babel-preset-solid"]!, options: { generate: "dom", hydratable: false, dev: false } }
      : framework === "solid"
        ? { name: "@solidjs/compiler", version: versions["@solidjs/compiler"]!, options: { generate: "dom", hydratable: false, dev: false, sourceNames: false } }
        : framework === "rivet-v2" ? { name: "hand-lowered", version: versions["@rivetjs/runtime"]!, options: { target: "dom-v2" } }
        : { name: framework === "rivet" ? "@rivetjs/compiler" : "esbuild", version: versions[framework === "rivet" ? "@rivetjs/compiler" : "esbuild"]!, options: { target: "dom", production: true, ...compileOptions } },
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
