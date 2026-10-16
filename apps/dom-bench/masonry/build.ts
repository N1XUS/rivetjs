// Masonry suite build: lanes `rivet` (@rivetjs/cdk/masonry, Rivet compiler for every .tsx incl. the cdk sources,
// production conditions) and `vanilla` (DOM baselines) → .artifacts/dom-bench/masonry/dist/<lane>.js (esbuild).
// node apps/dom-bench/masonry/build.ts [--no-minify] [--out <dir>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const out = resolve(arg("out", resolve(here, "../../../.artifacts/dom-bench/masonry/dist")));
await mkdir(out, { recursive: true });
const lanes = [
  ["rivet", "rivet.tsx"],
  ["vanilla", "vanilla.ts"],
] as const;
const rivet: Plugin = {
  name: "rivet-tsx",
  setup(builder) {
    builder.onLoad({ filter: /\.tsx$/ }, async (a) => {
      const result = compile(await readFile(a.path, "utf8"), { target: "dom", filename: a.path }) as {
        code: string;
        diagnostics?: { severity?: string; message: string }[];
      };
      const errors = result.diagnostics?.filter((d) => d.severity === "error") ?? [];
      if (errors.length) throw new Error(`${a.path}: ${errors.map((d) => d.message).join("\n")}`);
      return { contents: result.code, loader: "ts", resolveDir: dirname(a.path) };
    });
  },
};
const artifacts: { lane: string; raw: number; gzip: number }[] = [];
for (const [lane, entry] of lanes) {
  const outfile = resolve(out, `${lane}.js`);
  await build({
    entryPoints: [resolve(here, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["browser", "production"],
    minify: !process.argv.includes("--no-minify"),
    plugins: [rivet],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
  const bytes = await readFile(outfile);
  artifacts.push({ lane, raw: bytes.length, gzip: gzipSync(bytes).length });
}
await writeFile(resolve(out, "builds.json"), JSON.stringify({ suite: "masonry", artifacts }, null, 2) + "\n");
console.log(artifacts.map((a) => `${a.lane}: ${a.raw} B (${a.gzip} gzip)`).join("\n"));
