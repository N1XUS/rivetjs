// CI `test` matrix coverage: the shards in `scripts/ci/test-shards.json` (read by `.github/workflows/ci.yml`'s
// `test-shards` job) must cover every nx project with a `test` target exactly once — or, for a project split with
// `"args": "--shard=i/n"`, every i of 1..n once. A split shard holds that one project, and the project's `test`
// target must be a single `vitest run` or `node scripts/vitest-seq.ts` command (nx appends the args to the command line).
//   node scripts/ci/check-test-shards.ts      # status 1 + one line per problem
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface Shard {
  name: string;
  projects: string[];
  /** Extra arguments for every target of the shard; only `--shard=i/n` (vitest file sharding) is accepted. */
  args?: string;
}

/** nx project → its `test` target's command line (`undefined` when the target is not one plain command). */
export type TestTargets = Record<string, string | undefined>;

export const SHARDS_FILE = "scripts/ci/test-shards.json";
const SPLIT = /^--shard=(\d+)\/(\d+)$/;
/** Commands nx can append `--shard=i/n` to: one `vitest run`, or `scripts/vitest-seq.ts` (passes it to each of its runs). */
const SINGLE = /^(?:vitest run|node scripts\/vitest-seq\.ts)\s/;

/** Problems with `shards` against the workspace's `test` targets (empty = ok). */
export function checkShards(shards: Shard[], targets: TestTargets): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  const plain = new Map<string, string>(); // project → shard name
  const split = new Map<string, { n: number; parts: number[] }>();
  for (const shard of shards) {
    if (typeof shard.name !== "string" || !shard.name) errors.push(`shard without a name: ${JSON.stringify(shard)}`);
    else if (names.has(shard.name)) errors.push(`duplicate shard name "${shard.name}"`);
    names.add(shard.name);
    if (!Array.isArray(shard.projects) || shard.projects.length === 0) {
      errors.push(`shard "${shard.name}" lists no projects`);
      continue;
    }
    for (const project of shard.projects) if (!(project in targets)) errors.push(`shard "${shard.name}": "${project}" has no nx test target`);
    if (shard.args === undefined) {
      for (const project of shard.projects) {
        const other = plain.get(project);
        if (other !== undefined) errors.push(`"${project}" is in shards "${other}" and "${shard.name}"`);
        else plain.set(project, shard.name);
      }
      continue;
    }
    const m = SPLIT.exec(shard.args);
    if (!m) {
      errors.push(`shard "${shard.name}": args must be --shard=i/n, got "${shard.args}"`);
      continue;
    }
    if (shard.projects.length !== 1) {
      errors.push(`shard "${shard.name}": a split shard (args) holds exactly one project`);
      continue;
    }
    const [project] = shard.projects;
    const i = Number(m[1]);
    const n = Number(m[2]);
    if (n < 2 || i < 1 || i > n) errors.push(`shard "${shard.name}": invalid --shard=${i}/${n}`);
    const entry = split.get(project) ?? { n, parts: [] };
    if (entry.n !== n) errors.push(`"${project}" is split as both /${entry.n} and /${n}`);
    entry.parts.push(i);
    split.set(project, entry);
  }
  for (const [project, { n, parts }] of split) {
    if (plain.has(project)) errors.push(`"${project}" is split but also in shard "${plain.get(project)}"`);
    const sorted = [...parts].sort((a, b) => a - b);
    if (sorted.join() !== Array.from({ length: n }, (_, k) => k + 1).join()) errors.push(`"${project}" split /${n} has parts ${sorted.join(", ")}`);
    const command = targets[project];
    if (project in targets && (command === undefined || !SINGLE.test(command) || /[;&|]/.test(command)))
      errors.push(`"${project}" is split but its test target is not one \`vitest run\` / \`scripts/vitest-seq.ts\` command: ${command ?? "(commands list)"}`);
  }
  for (const project of Object.keys(targets).sort())
    if (!plain.has(project) && !split.has(project)) errors.push(`"${project}" (nx test target) is in no shard`);
  return errors;
}

/** `test` targets of the workspace from the nx project graph. */
export function workspaceTestTargets(cwd = process.cwd()): TestTargets {
  const dir = mkdtempSync(join(tmpdir(), "test-shards-"));
  try {
    const file = join(dir, "graph.json");
    execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["nx", "graph", `--file=${file}`], {
      cwd,
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false" },
    });
    const nodes: Record<string, { data: { targets?: Record<string, { options?: { command?: unknown } }> } }> = JSON.parse(readFileSync(file, "utf8")).graph
      .nodes;
    const targets: TestTargets = {};
    for (const [name, node] of Object.entries(nodes)) {
      const test = node.data.targets?.test;
      if (test) targets[name] = typeof test.options?.command === "string" ? test.options.command : undefined;
    }
    return targets;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const shards: Shard[] = JSON.parse(readFileSync(SHARDS_FILE, "utf8")).shards;
  const targets = workspaceTestTargets();
  const errors = checkShards(shards, targets);
  if (!readFileSync(".github/workflows/ci.yml", "utf8").includes(SHARDS_FILE)) errors.push(`.github/workflows/ci.yml does not read ${SHARDS_FILE}`);
  if (errors.length) {
    for (const error of errors) console.error(`test shards: ${error}`);
    process.exit(1);
  }
  console.log(`test shards: ok (${Object.keys(targets).length} projects in ${shards.length} shards)`);
}
