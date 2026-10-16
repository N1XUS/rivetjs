// Data-grid suite build: lanes `data-grid` (@rivetjs/cdk/data-grid) and `cdk-table` (@rivetjs/cdk/table, RAC port) →
// dist/data-grid/<lane>.js (esbuild, Rivet compiler for every .tsx incl. the cdk sources, production conditions).
// node apps/dom-bench/data-grid/build.ts [--no-minify]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";

const here = dirname(fileURLToPath(import.meta.url)),
  out = resolve(here, "../dist/data-grid");
await mkdir(out, { recursive: true });
const lanes = ["data-grid", "cdk-table"];
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
for (const lane of lanes) {
  const outfile = resolve(out, `${lane}.js`);
  await build({
    entryPoints: [resolve(here, `${lane}.tsx`)],
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
await writeFile(resolve(out, "builds.json"), JSON.stringify({ suite: "data-grid", artifacts }, null, 2) + "\n");
console.log(artifacts.map((a) => `${a.lane}: ${a.raw} B (${a.gzip} gzip)`).join("\n"));
