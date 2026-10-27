// Story harness build (LAZY-COST-2, derived since M6): cdk story pages (`stories/`: the cdk stories `/list-data`,
// `/virtualized-collections`, `/dom-data` as is + 1000-row `/list-data-1000`, `/dom-data-1000`, `/resume-1000`) built into
// `--dist` (default `stories/.artifacts/dist[-nodomdata]`); `--no-dom-data` sets `resume: { domData: false }` (on by default). Measured by `client.ts`
// (browser) and `cpu.ts` (server CPU per request).
//
//   node apps/ssr-bench/spikes/lazy-cost/stories.ts --build [--no-dom-data] [--dist <dir>]
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}
const root = resolve(import.meta.dirname, "stories");
const domData = !process.argv.includes("--no-dom-data");
// Default output under `.artifacts/` (gitignored).
const dist = resolve(arg("dist", resolve(root, ".artifacts", domData ? "dist" : "dist-nodomdata")));
if (!process.argv.includes("--build")) throw new Error("stories.ts: pass --build (measure with client.ts / cpu.ts)");
const env = { ...process.env, ...(domData ? {} : { RIVET_DOM_DATA: "0" }) };
const script = `
  import { build } from "vite";
  const root = ${JSON.stringify(root)}, dist = ${JSON.stringify(dist)};
  await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { outDir: dist + "/client", emptyOutDir: true } });
  await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { ssr: true, outDir: dist + "/server", emptyOutDir: true } });`;
execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "inherit", env, cwd: root });
console.log(`built ${dist} · domData ${domData}`);
