// Render-cache benchmark (lane OPT-B, spec docs/design/specs/2026-10-07-render-cache-design.md): a docs-style
// page (`page.jsx`: static header / 144-link sidebar with the current page highlighted / footer around a
// per-request article) rendered in-process through the real Rivet server compiler + NodeStreamWriter, in
// three modes — `off` (Rivet without cache), `components` (cached SiteHeader / Sidebar / Footer, as the
// compiler's `_cached` call sites), `shell` (layout shell keyed by path, article = hole). Not a fair-comparison
// lane: those render unique data per request and never cache (apps/ssr-bench CLAUDE.md "No page or data
// caching"). Each mode runs in its own child process (same GC flags as the Docker Node lanes), modes
// interleaved per repeat; HTML is checked identical across modes.
//
//   node apps/ssr-bench/cache-bench/run.ts [--repeats 3] [--requests 3000] [--rounds 5] [--json out.json]
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { median } from "../../../scripts/bench/shared.ts";

const here = dirname(fileURLToPath(import.meta.url));
const MODES = ["off", "components", "shell"] as const;
type Mode = (typeof MODES)[number];
const arg = (name: string, fallback: number): number => {
  const at = process.argv.indexOf("--" + name);
  return at > 0 ? Number(process.argv[at + 1]) : fallback;
};
const flag = (name: string): string | undefined => {
  const at = process.argv.indexOf("--" + name);
  return at > 0 ? process.argv[at + 1] : undefined;
};

interface Sample {
  mode: Mode;
  cpuMs: number[];
  wallMs: number[];
  allocKB: number[];
  maxRssMB: number;
  heapUsedMB: number;
  htmlKB: number;
  hashes: string[];
  cache: Record<string, number> | null;
}

/** Compile page.jsx for `mode` (server target) and bundle it with the runtime + data (production condition). */
async function build(mode: Mode, out: string): Promise<string> {
  const { compile } = await import("@rivetjs/compiler");
  const { build: bundle } = await import("esbuild");
  const source = readFileSync(join(here, "page.jsx"), "utf8").replace('const MODE = "off";', `const MODE = ${JSON.stringify(mode)};`);
  const result = compile(source, { target: "server", filename: join(here, "page.jsx") });
  if (result.diagnostics.length) throw new Error(JSON.stringify(result.diagnostics));
  writeFileSync(join(out, `page-${mode}.mjs`), result.code);
  const runtime = (file: string) => JSON.stringify(join(here, "../../../libs/runtime", file));
  writeFileSync(
    join(out, `entry-${mode}.mjs`),
    [
      `export { Page } from "./page-${mode}.mjs";`,
      `export { renderToWriter } from ${runtime("server.ts")};`,
      `export { NodeStreamWriter } from ${runtime("node.ts")};`,
      `export { createRenderCache, withRenderCache } from ${runtime("server-cache.ts")};`,
      `export { doc } from ${JSON.stringify(join(here, "data.ts"))};`,
    ].join("\n"),
  );
  const file = join(out, `bundle-${mode}.mjs`);
  await bundle({
    entryPoints: [join(out, `entry-${mode}.mjs`)],
    outfile: file,
    bundle: true,
    format: "esm",
    platform: "node",
    conditions: ["production"],
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [join(here, "../../../node_modules")],
    logLevel: "error",
  });
  return file;
}

{
  const out = mkdtempSync(join(tmpdir(), "rivet-cache-bench-"));
  const files = Object.fromEntries(await Promise.all(MODES.map(async (mode) => [mode, await build(mode, out)] as const))) as Record<Mode, string>;
  const repeats = arg("repeats", 3);
  const samples: Sample[] = [];
  for (let r = 0; r < repeats; r++)
    for (const mode of r % 2 ? [...MODES].reverse() : MODES) {
      const run = spawnSync(
        process.execPath,
        [
          "--single-threaded-gc",
          "--max-semi-space-size=8",
          join(here, "child.mjs"),
          files[mode],
          mode,
          String(arg("requests", 3000)),
          String(arg("rounds", 5)),
          String(arg("warm", 3000)),
        ],
        { encoding: "utf8", maxBuffer: 1 << 26 },
      );
      if (run.status !== 0) throw new Error(run.stderr);
      samples.push(JSON.parse(run.stdout) as Sample);
      process.stderr.write(".");
    }
  process.stderr.write("\n");
  const reference = samples.find((s) => s.mode === "off")!.hashes.join();
  for (const sample of samples) if (sample.hashes.join() !== reference) throw new Error(`HTML differs in mode ${sample.mode}`);
  const rows = MODES.map((mode) => {
    const of = samples.filter((s) => s.mode === mode);
    const all = (key: "cpuMs" | "wallMs" | "allocKB") => of.flatMap((s) => s[key]);
    return {
      mode,
      cpuMs: median(all("cpuMs")),
      wallMs: median(all("wallMs")),
      allocKB: median(all("allocKB")),
      maxRssMB: median(of.map((s) => s.maxRssMB)),
      htmlKB: of[0]!.htmlKB,
      cache: of[0]!.cache,
    };
  });
  const base = rows[0]!;
  console.log(
    `Node ${process.version}, ${repeats} repeats × ${arg("rounds", 5)} rounds × ${arg("requests", 3000)} requests per mode; HTML ${base.htmlKB.toFixed(1)} KB, identical across modes`,
  );
  console.log("| mode | CPU ms/page | wall ms/page | alloc KB/page | peak RSS MB | vs off (CPU) | cache entries / KB |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows)
    console.log(
      `| ${row.mode} | ${row.cpuMs.toFixed(3)} | ${row.wallMs.toFixed(3)} | ${row.allocKB.toFixed(1)} | ${row.maxRssMB.toFixed(0)} | ${((row.cpuMs / base.cpuMs - 1) * 100).toFixed(0)}% | ${row.cache ? `${row.cache.entries} / ${(row.cache.bytes / 1024).toFixed(0)}` : "—"} |`,
    );
  const json = flag("json");
  if (json) writeFileSync(resolve(json), JSON.stringify({ node: process.version, rows, samples }, null, 2));
}
