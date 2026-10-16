// Typecheck runner for the repo gates (nx `typecheck` targets): TypeScript 7 native (`tsgo`, devDependency
// `@typescript/native-preview`) by default, `RIVET_TSC=tsc` = TypeScript 5.9 (`typescript`, JS) as the escape hatch.
// Arguments pass through (`node scripts/tsc.ts -p libs/cdk`); tsgo-only flags (`--checkers N`, `--singleThreaded`)
// are dropped for tsc. tsgo gets a soft Go heap limit (`GOMEMLIMIT`, default 2304MiB) so the biggest projects
// (libs/ui, apps/ui-docs: ~2.1 GB live with one checker) stay under the 3 GB per-tree RAM cap instead of growing
// to 3.5–4 GB; an explicit `GOMEMLIMIT` wins.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const which = process.env.RIVET_TSC ?? "tsgo";
if (which !== "tsgo" && which !== "tsc") {
  console.error(`scripts/tsc.ts: RIVET_TSC must be "tsgo" or "tsc", got ${JSON.stringify(which)}`);
  process.exit(2);
}
let args = process.argv.slice(2);
if (which === "tsc") {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--checkers" || args[i] === "--builders") i++;
    else if (args[i] !== "--singleThreaded") out.push(args[i]!);
  }
  args = out;
}
const bin = which === "tsgo" ? resolve(root, "node_modules/@typescript/native-preview/bin/tsgo") : resolve(root, "node_modules/typescript/bin/tsc");
const env = which === "tsgo" ? { ...process.env, GOMEMLIMIT: process.env.GOMEMLIMIT ?? "2304MiB" } : process.env;
const run = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit", env });
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
