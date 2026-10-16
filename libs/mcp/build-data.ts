// Bundled data of the server: `node libs/mcp/build-data.ts [--out file] [--check]`.
// Default: build from the docs sites and write `libs/mcp/data/rivet.json` (gitignored; the package build writes it
// into dist via bundle.ts). `--check`: no writes; fails when two builds differ, when a docs page of a site's llms
// output is missing from the data (they must stay the same documents), or when an existing data file is stale.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildData, dataFile, dataProblems, workspaceRoot, writeData, type McpData } from "./data.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
const file = at >= 0 ? resolve(args[at + 1]!) : dataFile();
const repo = workspaceRoot() ?? resolve(import.meta.dirname, "../..");
const started = performance.now();
const data = await buildData(repo);
const summary = `${data.docs.length} docs, ${data.components.length} components, ${(Buffer.byteLength(JSON.stringify(data)) / 1024 / 1024).toFixed(1)} MB, digest ${data.digest.slice(0, 12)}`;
if (args.includes("--check")) {
  const problems = await dataProblems(data, repo);
  if ((await buildData(repo)).digest !== data.digest) problems.push("two builds differ (not deterministic)");
  if (existsSync(file)) {
    const current = JSON.parse(await readFile(file, "utf8")) as McpData;
    if (current.digest !== data.digest) problems.push(`${file} is stale (run node libs/mcp/build-data.ts)`);
  }
  if (problems.length) {
    console.error(`mcp data --check: ${problems.length} problem(s)\n  ${problems.slice(0, 50).join("\n  ")}`);
    process.exit(1);
  }
  console.log(`mcp data --check: ok, ${summary} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
} else {
  await writeData(data, file);
  console.log(`mcp data: ${summary} → ${file}`);
}
