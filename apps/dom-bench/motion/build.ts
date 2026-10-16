// Motion suite build (`@rivetjs/motion` plan T14): lanes `rivet` (Rivet compiler for every .tsx, production
// conditions), `react` (React 19 + `motion/react`, automatic JSX), `vanilla` (`motion` by hand) →
// .artifacts/dom-bench/motion/dist/<lane>.js (esbuild; pages from ../server.ts). Sizes (min / gzip / brotli) → builds.json.
// node apps/dom-bench/motion/build.ts [--no-minify] [--out <dir>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const out = resolve(arg("out", resolve(here, "../../../.artifacts/dom-bench/motion/dist")));
await mkdir(out, { recursive: true });
const lanes = [
  ["rivet", "rivet.tsx"],
  ["react", "react.jsx"],
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
const artifacts: { lane: string; raw: number; gzip: number; brotli: number }[] = [];
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
    jsx: "automatic",
    jsxImportSource: "react",
    // The repo tsconfig sets the Rivet JSX source; lanes use esbuild defaults (dom-bench build.ts does the same).
    tsconfigRaw: {},
    plugins: [rivet],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
  const bytes = await readFile(outfile);
  artifacts.push({ lane, raw: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length });
}
await writeFile(resolve(out, "builds.json"), JSON.stringify({ suite: "motion", artifacts }, null, 2) + "\n");
console.log(artifacts.map((a) => `${a.lane}: ${a.raw} B (${a.gzip} gzip, ${a.brotli} br)`).join("\n"));
