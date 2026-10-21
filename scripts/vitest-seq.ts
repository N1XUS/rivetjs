// Sequential `vitest run` invocations for one nx `test` target, with the target's extra arguments applied to each.
//   node scripts/vitest-seq.ts "--project ui --maxWorkers=2" "--project ui-components" [--shard=i/n] [other args]
// An argument starting with `--project ` is one invocation's argument list (split on spaces); every other argument
// (what `nx run <p>:test -- …` / `nx run-many -t test … --shard=i/n` appends) goes to every invocation. All of them
// run, also after a failure; the status is 1 when any failed.
// `--shard=i/n` is not vitest's (hash order: the two heaviest ui story files always landed in one shard): the files
// of every group (`vitest list --filesOnly --json`) are balanced over n shards by measured seconds
// (`scripts/ci/test-weights.json`: per file, else per directory prefix, else `DEFAULT_WEIGHT`), heaviest first onto the least loaded shard; shard i
// runs its files, group by group (a group without files is skipped). Every file lands in exactly one shard, so the CI
// shards of the target (scripts/ci/test-shards.json) together run every file once.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Seconds for a file neither `seconds` nor a `defaults` directory prefix of the weights file names. */
export const DEFAULT_WEIGHT = 0.5;

/** `scripts/ci/test-weights.json`: measured seconds per heavy file + per directory prefix (longest match wins). */
export interface Weights {
  seconds: Record<string, number>;
  defaults: Record<string, number>;
}

const weightOf = (file: string, { seconds, defaults }: Weights): number => {
  if (file in seconds) return seconds[file];
  let best = "";
  for (const prefix of Object.keys(defaults)) if (file.startsWith(prefix) && prefix.length > best.length) best = prefix;
  return best ? defaults[best] : DEFAULT_WEIGHT;
};
const SHARD = /^--shard=(\d+)\/(\d+)$/;

/** Invocation argument lists: each group + the shared extra arguments (`shard` = the `--shard=i/n` one, kept apart). */
export function invocations(argv: string[]): { groups: string[][]; shard?: { index: number; count: number } } {
  const groups = argv.filter((a) => a.startsWith("--project "));
  if (groups.length === 0) throw new Error('vitest-seq: no "--project …" group');
  let shard: { index: number; count: number } | undefined;
  const extra: string[] = [];
  for (const a of argv) {
    if (a.startsWith("--project ")) continue;
    const m = SHARD.exec(a);
    if (!m) extra.push(a);
    else {
      shard = { index: Number(m[1]), count: Number(m[2]) };
      if (shard.count < 1 || shard.index < 1 || shard.index > shard.count) throw new Error(`vitest-seq: invalid ${a}`);
    }
  }
  return { groups: groups.map((g) => [...g.split(/\s+/).filter(Boolean), ...extra]), shard };
}

/**
 * Files per shard: `files[g]` = group g's files (repo-relative; a file listed under two projects of one group counts
 * once: its filter runs it in both). Greedy longest-first onto the least loaded shard (ties: lower shard), deterministic
 * for the same inputs. Result: `[shard][group]` = files.
 */
export function balance(files: string[][], count: number, weights: Weights): string[][][] {
  const items = files.flatMap((list, group) => [...new Set(list)].map((file) => ({ group, file, w: weightOf(file, weights) })));
  items.sort((a, b) => b.w - a.w || (a.file < b.file ? -1 : a.file > b.file ? 1 : a.group - b.group));
  const load = new Array<number>(count).fill(0);
  const out = Array.from({ length: count }, () => files.map((): string[] => []));
  for (const item of items) {
    let best = 0;
    for (let s = 1; s < count; s++) if (load[s] < load[best]) best = s;
    load[best] += item.w;
    out[best][item.group].push(item.file);
  }
  for (const shard of out) for (const list of shard) list.sort();
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bin = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
  const root = process.cwd();
  const { groups, shard } = invocations(process.argv.slice(2));
  let runs = groups.map((args) => ({ args, files: [] as string[] }));
  if (shard) {
    const projects = (args: string[]) => args.flatMap((a, i) => (args[i - 1] === "--project" ? ["--project", a] : []));
    const files = groups.map((args) => {
      const listed = spawnSync(process.execPath, [bin, "list", "--filesOnly", "--json", ...projects(args)], { encoding: "utf8", maxBuffer: 64 << 20 });
      if (listed.status !== 0) throw new Error(`vitest-seq: vitest list failed\n${listed.stderr}`);
      return (JSON.parse(listed.stdout) as { file: string }[]).map((f) => relative(root, f.file).split("\\").join("/"));
    });
    const weights: Weights = JSON.parse(readFileSync(join(root, "scripts/ci/test-weights.json"), "utf8"));
    const mine = balance(files, shard.count, weights)[shard.index - 1];
    runs = groups.map((args, g) => ({ args, files: mine[g] })).filter((run) => run.files.length > 0);
    console.log(`vitest-seq: shard ${shard.index}/${shard.count}: ${runs.map((r) => r.files.length).join(" + ")} files`);
  }
  let failed = false;
  for (const { args, files } of runs) {
    console.log(`> vitest run ${args.join(" ")}${files.length ? ` (${files.length} files)` : ""}`);
    const { status, signal } = spawnSync(process.execPath, [bin, "run", ...args, ...files], { stdio: "inherit" });
    if (status !== 0) failed = true;
    if (signal) process.kill(process.pid, signal);
  }
  process.exit(failed ? 1 : 0);
}
