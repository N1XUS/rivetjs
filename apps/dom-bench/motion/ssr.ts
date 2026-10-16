// Motion suite SSR scenario (`ssr-1000`, plan T14): in-process CPU of rendering 1000 Motion elements, rivet
// (server compile, production conditions) vs React 19 `renderToString` + `motion/react`. Bundles both lanes with
// esbuild for node, then interleaves samples (warm-up first). Run under the bench lock.
// node apps/dom-bench/motion/ssr.ts [--samples 25] [--out <file.json>]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "esbuild";
import { compile } from "@rivetjs/compiler";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const samples = Number(arg("samples", "25"));
const dist = resolve(here, "../../../.artifacts/dom-bench/motion/ssr");
await mkdir(dist, { recursive: true });
const rivet: Plugin = {
  name: "rivet-tsx-server",
  setup(builder) {
    builder.onLoad({ filter: /\.tsx$/ }, async (a) => {
      const result = compile(await readFile(a.path, "utf8"), { target: "server", filename: a.path }) as {
        code: string;
        diagnostics?: { severity?: string; message: string }[];
      };
      const errors = result.diagnostics?.filter((d) => d.severity === "error") ?? [];
      if (errors.length) throw new Error(`${a.path}: ${errors.map((d) => d.message).join("\n")}`);
      return { contents: result.code, loader: "ts", resolveDir: dirname(a.path) };
    });
  },
};
type Lane = Record<string, () => string>;
const lanes: Record<string, Lane> = {};
for (const [lane, entry] of [
  ["rivet", "ssr-rivet.tsx"],
  ["react", "ssr-react.jsx"],
] as const) {
  const outfile = resolve(dist, `${lane}.mjs`);
  await build({
    entryPoints: [resolve(here, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    conditions: ["node", "production"],
    jsx: "automatic",
    jsxImportSource: "react",
    tsconfigRaw: {},
    plugins: [rivet],
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: "warning",
  });
  lanes[lane] = ((await import(pathToFileURL(outfile).href)) as { ssr: Lane }).ssr;
}
const cases = Object.entries(lanes).flatMap(([lane, l]) => Object.keys(l).map((s) => [`${lane} ssr-1000 ${s}`, l[s]!] as const));
const html: Record<string, number> = {};
const times: Record<string, number[]> = {};
for (const [name, run] of cases) ((html[name] = String(run()).length), (times[name] = []));
for (let w = 0; w < 20; w++) for (const [, run] of cases) run();
for (let r = 0; r < samples; r++)
  for (const [name, run] of cases) {
    const t = performance.now();
    run();
    times[name]!.push(performance.now() - t);
  }
const rows = cases.map(([name]) => {
  const s = times[name]!.sort((a, b) => a - b);
  return { scenario: name, min: s[0]!, median: s[s.length >> 1]!, html: html[name]! };
});
console.log(`ssr, ${samples} interleaved samples, ms`);
for (const r of rows) console.log(`${r.scenario.padEnd(30)} min ${r.min.toFixed(2).padStart(7)}  median ${r.median.toFixed(2).padStart(7)}  html ${r.html} B`);
const out = arg("out", "");
if (out) await writeFile(out, JSON.stringify({ suite: "motion-ssr", samples, rows }, null, 2) + "\n");
