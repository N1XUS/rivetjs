import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";
import { transform } from "@solidjs/compiler";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { build as viteBuild } from "vite";
import { buildStableQwik, stablePackage, stableResolver, stableSolidCompiler, stableSolidStaticCompiler } from "./stable-build.ts";

const root = dirname(fileURLToPath(import.meta.url));
const protoHash = createHash("sha256")
  .update(await readFile(resolve(root, "proto/content.proto")))
  .digest("hex");
if (protoHash !== (await readFile(resolve(root, "proto/generated.sha256"), "utf8")).trim())
  throw new Error("Protobuf changed: regenerate C# sources and update proto/generated.sha256");
interface Artifact {
  framework: string;
  implementation: string;
  outputMode: string;
  version: string;
  sha256: string;
  raw: number;
  gzip: number;
  brotli: number;
  inputs: string[];
}
const artifacts: Artifact[] = [];
await mkdir(resolve(root, "dist"), { recursive: true });
const qwikOptions = {
  srcDir: resolve(root, "adapters"),
  lint: false,
  fileFilter: (id: string) => !id.includes("solid") && !id.includes("rivet-compiled") && !id.includes("qwik-stable"),
  client: { input: resolve(root, "adapters/qwik-page.jsx"), outDir: resolve(root, "dist/client") },
  ssr: { input: resolve(root, "adapters/qwik.jsx"), outDir: resolve(root, "dist/qwik-server") },
};
await viteBuild({ configFile: false, root, plugins: qwikVite(qwikOptions), build: { minify: true } });
await viteBuild({ configFile: false, root, plugins: qwikVite(qwikOptions), build: { ssr: true, minify: true } });
const stableQwikInputs = await buildStableQwik();
// Router lane: the file-routed app (`router-app/`) as a production client + SSR build; `rivet-router.mjs`
// (below) is its node-adapter entry that loads `dist/rivet-router/server/entry.server.js`.
const routerApp = resolve(root, "router-app");
for (const ssr of [false, true])
  await viteBuild({
    root: routerApp,
    configFile: resolve(routerApp, "vite.config.ts"),
    build: { ssr, outDir: resolve(root, `dist/rivet-router/${ssr ? "server" : "client"}`), emptyOutDir: true },
  });
// rivet-derived lane: the same app resumed with the derived model (`vite.derived.config.ts`,
// `resume.model: "derived"`) into `dist/rivet-derived/`; `rivet-derived.mjs` serves it.
for (const ssr of [false, true])
  await viteBuild({
    root: routerApp,
    configFile: resolve(routerApp, "vite.derived.config.ts"),
    build: { ssr, outDir: resolve(root, `dist/rivet-derived/${ssr ? "server" : "client"}`), emptyOutDir: true },
  });
const compiledJSX = new Set(["rivet-compiled", "rivet-for"]);
for (const name of ["rivet", "solid", "qwik", "solid-stable", "qwik-stable", "solid-stable-string", "solid-stable-static", "solid-stable-interactive", "rivet-compiled", "rivet-for", "rivet-router", "rivet-derived"]) {
  const plugins: Plugin[] =
    name === "solid-stable-static" ? [stableResolver, stableSolidStaticCompiler]
      : name.startsWith("solid-stable") ? [stableResolver, stableSolidCompiler]
      : name === "qwik-stable" ? [stableResolver]
      : compiledJSX.has(name)
      ? [{ name: "rivet-reviewed-server-compiler", setup(builder) {
          builder.onLoad({ filter: /\.jsx$/ }, async args => {
            const result = compile(await readFile(args.path, "utf8"), { target: "server", filename: args.path });
            if (result.diagnostics.length) throw new Error(JSON.stringify(result.diagnostics));
            return { contents: result.code, loader: "js", resolveDir: dirname(args.path) };
          });
        } }]
      : name !== "solid"
      ? []
      : [
          {
            name: `${name}-production-ssr`,
            setup(builder) {
              builder.onLoad({ filter: /\.jsx$/ }, async (args) => {
                const code = await readFile(args.path, "utf8");
                let contents: string;
                contents = transform(code, {
                  filename: args.path,
                  generate: "ssr",
                  hydratable: true,
                  dev: false,
                  sourceNames: false,
                }).code;
                return { contents, loader: "js", resolveDir: dirname(args.path) };
              });
            },
          },
        ];
  const outfile = resolve(root, `dist/${name}.mjs`);
  const entry =
    name === "qwik" || name === "qwik-stable"
      ? resolve(root, `dist/${name}-server/${name}.js`)
      : name === "rivet-router"
        ? resolve(routerApp, "server.ts")
        : name === "rivet-derived"
          ? resolve(routerApp, "server-derived.ts")
        : resolve(root, `adapters/${name}.${name === "rivet" ? "ts" : "jsx"}`);
  const result = await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    conditions: ["node", "production"],
    minify: true,
    metafile: true,
    plugins,
    external: ["node:*"],
    alias: { "@rivetjs/runtime/server": resolve(root, "../../libs/runtime/server.ts") },
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const bytes = await readFile(outfile);
  const packageName = name.startsWith("rivet") ? "@rivetjs/runtime" : name.startsWith("solid") ? "solid-js" : name === "qwik-stable" ? "@builder.io/qwik" : "@qwik.dev/core";
  let version: string | undefined;
  if (name.startsWith("rivet")) version = "0.0.0-experimental";
  else if (name.startsWith("solid-stable") || name === "qwik-stable") version = (await stablePackage(packageName)).version;
  else {
    let directory = dirname(fileURLToPath(import.meta.resolve(packageName)));
    for (;;) {
      try {
        const p = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as { name?: string; version?: string };
        if (p.name === packageName) {
          version = p.version;
          break;
        }
      } catch {}
      const parent = dirname(directory);
      if (parent === directory) throw new Error(`Missing package version for ${packageName}`);
      directory = parent;
    }
  }
  artifacts.push({
    framework: name,
    implementation: name === "rivet-compiled" ? "JSX -> reviewed Rivet server compiler/runtime" : name === "rivet-for" ? "JSX + keyed <For> -> Rivet server compiler/runtime" : name === "rivet-router" ? "@rivetjs/router file routes (layout + loaders + head) on the node adapter" : name === "rivet-derived" ? "@rivetjs/router file routes, resume.model derived (boundary records + keyed signals), node adapter" : name === "solid-stable-string" ? "Solid stable production SSR (babel-preset-solid, renderToString)" : name === "solid-stable-static" ? "Solid stable static SSR (babel-preset-solid hydratable:false, renderToString)" : name === "solid-stable" ? "Solid stable production SSR (babel-preset-solid)" : name === "solid-stable-interactive" ? "Solid stable production SSR (babel-preset-solid), interactive rows + serialized page data" : name === "qwik-stable" ? "Qwik stable production SSR (Qwik optimizer + Vite 7)" : name,
    outputMode: name === "solid-stable-string" ? "buffered-renderToString" : name === "solid-stable-static" ? "buffered-static-renderToString" : name === "rivet-router" || name === "rivet-derived" ? "streaming-router" : "streaming-adapter",
    version: version!,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    raw: bytes.length,
    gzip: gzipSync(bytes).length,
    brotli: brotliCompressSync(bytes).length,
    inputs: [...new Set([...Object.keys(result.metafile.inputs), ...(name === "qwik-stable" ? stableQwikInputs : [])])],
  });
}
// The HTTP server as plain JS: containers run it without Node's type stripping (~24 MB RSS).
await build({
  entryPoints: [resolve(root, "server.ts")],
  outfile: resolve(root, "dist/server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["node:*", "marked"],
});
// UWS-SPIKE transport entries over the same lane bundles (not in builds.json: no new framework artifact):
// uWebSockets.js (resolved at runtime from the `Dockerfile.uws` image) for the router build and the static
// harness, and Bun's native `Bun.serve` for the router build.
for (const [entry, out] of [
  ["router-app/server-uws.ts", "rivet-router-uws.mjs"],
  ["router-app/server-bun.ts", "rivet-router-bunserve.mjs"],
  ["server-uws.ts", "server-uws.mjs"],
]) {
  await build({
    entryPoints: [resolve(root, entry!)],
    outfile: resolve(root, "dist", out!),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    conditions: ["node", "production"],
    minify: true,
    external: ["node:*", "marked", "uWebSockets.js"],
    define: { "process.env.NODE_ENV": '"production"' },
  });
}
await writeFile(
  resolve(root, "dist/builds.json"),
  JSON.stringify({ mode: "production-static-ssr", artifacts }, null, 2) + "\n",
);
console.log(artifacts.map((a) => `${a.framework} ${a.version}: ${a.raw} server bytes (${a.gzip} gzip)`).join("\n"));
// The optimizer's native worker pool can keep Node alive after awaited build completion.
process.exit(0);
