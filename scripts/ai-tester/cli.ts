import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AREAS } from "./policy.ts";
import { runCampaign } from "./run.ts";
import { safeFile } from "./workspace.ts";
import type { Area, RunRecord } from "./types.ts";
const help = `Rivet autonomous tester
  node scripts/ai-tester/cli.ts run --area reactivity|router|resume [--no-commit] [--timeout minutes<=30] [--rss-limit MiB<=3072]
  node scripts/ai-tester/cli.ts status [run-id]
One foreground campaign; verified fixes commit by default. No push or deployment.`;
type Parsed = { command: "run"; area: Area; noCommit: boolean; wallMs: number; rssLimitMB: number } | { command: "status"; id?: string } | { command: "help" };
export function parseArgs(args: string[]): Parsed {
  const [command, ...rest] = args;
  if (command === "--help" || command === "-h" || !command) return { command: "help" };
  if (command === "status") {
    if (rest.length > 1 || (rest[0] && !/^[\w-]+$/.test(rest[0]))) throw new Error("Invalid run id");
    return { command, id: rest[0] };
  }
  if (command !== "run") throw new Error("Unknown tester command");
  const result: Parsed = { command: "run", area: "" as Area, noCommit: false, wallMs: 1800000, rssLimitMB: 3072 };
  const seen = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (seen.has(flag)) throw new Error(`Repeated ${flag}`);
    seen.add(flag);
    if (flag === "--no-commit") {
      result.noCommit = true;
      continue;
    }
    if (!["--area", "--timeout", "--rss-limit"].includes(flag)) throw new Error(`Unknown option ${flag}`);
    const value = rest[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--area") {
      if (!Object.hasOwn(AREAS, value)) throw new Error("Unknown area");
      result.area = value as Area;
    } else {
      const n = Number(value);
      const max = flag === "--timeout" ? 30 : 3072;
      if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`Invalid ${flag}`);
      if (flag === "--timeout") result.wallMs = n * 60000;
      else result.rssLimitMB = n;
    }
  }
  if (!result.area) throw new Error("--area is required");
  return result;
}
export function readStatus(root: string, id?: string): RunRecord[] {
  if (id && !/^[\w-]+$/.test(id)) throw new Error("Invalid run id");
  const parent = join(root, ".artifacts/ai-tester");
  if (!existsSync(parent)) {
    if (id) throw new Error("Run not found");
    return [];
  }
  const ids = id
    ? [id]
    : readdirSync(parent, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "campaign.lock")
        .map((e) => e.name)
        .sort();
  return ids
    .filter((name) => id || existsSync(join(parent, name, "run.json")))
    .map((name) => JSON.parse(readFileSync(safeFile(parent, name + "/run.json"), "utf8")) as RunRecord);
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolve(import.meta.dirname, "../..");
  if (options.command === "help") {
    console.log(help);
    return;
  }
  if (options.command === "status") {
    console.log(JSON.stringify(readStatus(root, options.id), null, 2));
    return;
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const result = await runCampaign({ ...options, root, signal: controller.signal });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = ["committed", "verified", "no-finding"].includes(result.status)
      ? 0
      : result.status === "interrupted"
        ? 130
        : result.status === "needs-attention"
          ? 1
          : 2;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(`ai-tester: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
