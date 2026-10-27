// One gates runner for intake, agents and CI (root CLAUDE.md "Gates"): plans the gates the changed files need
// (scripts/gates/plan.ts), runs them one after another under `nice` (heavy ones through a shared slot semaphore),
// tracks each gate's peak process-tree RSS, classifies the output (scripts/gates/classify.ts: known reds from
// scripts/gates/known-reds.json, size-report / Qwik lane noise) and prints a table + writes a JSON report.
// Orchestration only: every gate runs the documented command unchanged.
//
//   node scripts/gates/run.ts                         affected gates for the working tree vs HEAD
//   node scripts/gates/run.ts --base HEAD~3           … vs another ref (git diff <base> + untracked files)
//   node scripts/gates/run.ts --all                   every gate for every project
//   node scripts/gates/run.ts --only typecheck,vitest:router --skip size
//   node scripts/gates/run.ts --update-baselines      frames / zero-cost / size-report --update (+ Qwik restore, size re-check), home-perf
//   node scripts/gates/run.ts --list                  print the plan, run nothing (--help: this text)
//
// Options: --files a,b (plan for these paths instead of git), --tests touched|affected (vitest scope, default touched),
// --json <file>, --rss-limit <MB> (default 3072; tree peak above = red), --size-tolerance <bytes> (default 20),
// --timeout <minutes> per gate (default 120), --slots <n> (heavy-command semaphore, default $RIVET_HEAVY_SLOTS or 3;
// 0 = off), --graph <nx graph json> (skip `nx graph`), --logs <dir>.
// Exit status: 0 when no gate is a new red (known reds and noise are reported, not failing), 1 otherwise, 2 usage.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { classify, baselineDelta, restoreQwikLines, timeRss, type KnownRed, type Status, type Verdict } from "./classify.ts";
import { IGNORED_FILES, affectedProjects, plan, select, type Gate, type Project } from "./plan.ts";

const root = resolve(import.meta.dirname, "../..");

export interface Options {
  base: string;
  mode: "affected" | "all";
  tests: "touched" | "affected";
  updateBaselines: boolean;
  only: string[];
  skip: string[];
  json?: string;
  list: boolean;
  files?: string[];
  graph?: string;
  rssLimitMB: number;
  sizeTolerance: number;
  timeoutMin: number;
  slots: number;
  logs?: string;
}

export function parseArgs(argv: string[]): Options {
  const options: Options = {
    base: "HEAD",
    mode: "affected",
    tests: "touched",
    updateBaselines: false,
    only: [],
    skip: [],
    list: false,
    rssLimitMB: 3072,
    sizeTolerance: 20,
    timeoutMin: 120,
    slots: Number(process.env.RIVET_HEAVY_SLOTS ?? 3),
  };
  const list = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i]!.split(/=(.*)/s, 2) as [string, string | undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--base":
        options.base = value();
        break;
      case "--affected":
        options.mode = "affected";
        break;
      case "--all":
        options.mode = "all";
        break;
      case "--update-baselines":
        options.updateBaselines = true;
        break;
      case "--only":
        options.only.push(...list(value()));
        break;
      case "--skip":
        options.skip.push(...list(value()));
        break;
      case "--json":
        options.json = resolve(value());
        break;
      case "--list":
      case "--dry-run":
        options.list = true;
        break;
      case "--files":
        options.files = list(value());
        break;
      case "--graph":
        options.graph = resolve(value());
        break;
      case "--tests": {
        const v = value();
        if (v !== "touched" && v !== "affected") throw new Error("--tests is touched or affected");
        options.tests = v;
        break;
      }
      case "--rss-limit":
        options.rssLimitMB = Number(value());
        break;
      case "--size-tolerance":
        options.sizeTolerance = Number(value());
        break;
      case "--timeout":
        options.timeoutMin = Number(value());
        break;
      case "--slots":
        options.slots = Number(value());
        break;
      case "--logs":
        options.logs = resolve(value());
        break;
      default:
        throw new Error(`unknown option ${flag}`);
    }
  }
  for (const [name, n] of [
    ["--rss-limit", options.rssLimitMB],
    ["--size-tolerance", options.sizeTolerance],
    ["--timeout", options.timeoutMin],
    ["--slots", options.slots],
  ] as const)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number`);
  return options;
}

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });

/** git diff <base> (working tree, staged + unstaged, deletions incl.) + untracked files, minus the regenerated API file. */
export function changedFiles(base: string): string[] {
  const lines = (text: string) => text.split("\n").filter(Boolean);
  const files = new Set([...lines(git("diff", "--name-only", base)), ...lines(git("ls-files", "--others", "--exclude-standard"))]);
  return [...files].filter((file) => !IGNORED_FILES.has(file)).sort();
}

/** nx project graph (`nx graph --file`, or a saved one) → planner projects. */
export function loadProjects(graphFile?: string): Project[] {
  let raw: string;
  if (graphFile) raw = readFileSync(graphFile, "utf8");
  else {
    const dir = mkdtempSync(join(tmpdir(), "gates-graph-"));
    try {
      const file = join(dir, "graph.json");
      execFileSync("npx", ["nx", "graph", `--file=${file}`], {
        cwd: root,
        stdio: "ignore",
        env: { ...childEnv(), NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false" },
      });
      raw = readFileSync(file, "utf8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return projectsFromGraph(JSON.parse(raw));
}

type GraphJson = {
  graph: {
    nodes: Record<string, { data: { root: string; targets?: Record<string, { options?: { command?: unknown; commands?: unknown }; dependsOn?: unknown[] }> } }>;
    dependencies: Record<string, { target: string }[]>;
  };
};

export function projectsFromGraph(json: GraphJson): Project[] {
  const { nodes, dependencies } = json.graph;
  return Object.entries(nodes).map(([name, node]) => {
    const targets: Project["targets"] = {};
    for (const [target, config] of Object.entries(node.data.targets ?? {})) {
      const { command, commands } = config.options ?? {};
      const list = [command, ...(Array.isArray(commands) ? commands : [])]
        .map((c) => (typeof c === "string" ? c : c && typeof c === "object" && "command" in c ? String((c as { command: unknown }).command) : undefined))
        .filter((c): c is string => !!c);
      const dependsOn = (config.dependsOn ?? [])
        .map((d) =>
          typeof d === "string"
            ? d
            : d && typeof d === "object" && "target" in d && !("projects" in d) && !("dependencies" in d)
              ? String((d as { target: unknown }).target)
              : "",
        )
        .filter((d) => d && !d.startsWith("^"));
      targets[target] = { commands: list, dependsOn };
    }
    return { name, root: node.data.root, targets, deps: [...new Set((dependencies[name] ?? []).map((d) => d.target).filter((t) => t !== name && t in nodes))] };
  });
}

/** Environment for gate commands: this Node first on PATH, nested-nx task variables dropped (root CLAUDE.md "CI ≠ this host"). */
function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (!/^NX_TASK_|^NX_SKIP_NX_CACHE$|^NX_WORKSPACE_ROOT$/.test(key)) env[key] = value;
  env.PATH = `${dirname(process.execPath)}:${process.env.PATH ?? ""}`;
  return { ...env, NX_DAEMON: "false", NX_ISOLATE_PLUGINS: "false", ...extra };
}

/** Qwik lane sources changed vs the base: then lanes.txt Qwik drift is real (no noise, no restore). */
function qwikSourcesChanged(base: string, files: string[]): boolean {
  if (files.some((f) => /^apps\/ssr-bench\/adapters\/qwik|^apps\/ssr-bench\/stable-build\.ts$|^apps\/bench-stable\//.test(f))) return true;
  if (!files.includes("apps/ssr-bench/build.ts")) return false;
  try {
    return /qwik/i.test(
      git("diff", base, "--", "apps/ssr-bench/build.ts")
        .split("\n")
        .filter((l) => /^[-+][^-+]/.test(l))
        .join("\n"),
    );
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------- heavy-command semaphore (mkdir slots, shared by runs)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

async function acquireSlot(count: number, onWait: () => void): Promise<() => void> {
  if (count <= 0) return () => {};
  const dir = process.env.RIVET_HEAVY_SLOTS_DIR ?? join(tmpdir(), "rivet-heavy-slots");
  mkdirSync(dir, { recursive: true });
  let warned = false;
  for (;;) {
    for (let i = 0; i < count; i++) {
      const slot = join(dir, `slot-${i}`);
      try {
        mkdirSync(slot);
        writeFileSync(join(slot, "pid"), String(process.pid));
        return () => rmSync(slot, { recursive: true, force: true });
      } catch {
        const pid = Number(existsSync(join(slot, "pid")) ? readFileSync(join(slot, "pid"), "utf8") : NaN);
        if (Number.isFinite(pid) && !alive(pid)) rmSync(slot, { recursive: true, force: true });
      }
    }
    if (!warned) (onWait(), (warned = true));
    await sleep(3000);
  }
}

// ---------------------------------------------------------------- execution

/** Sum of RSS (bytes) of `pid` and all its descendants (`ps`; KiB on macOS and Linux). */
function treeRss(pid: number): number {
  const out = spawnSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" }).stdout ?? "";
  const children = new Map<number, number[]>();
  const rss = new Map<number, number>();
  for (const line of out.split("\n")) {
    const [p, pp, r] = line.trim().split(/\s+/).map(Number);
    if (!p) continue;
    rss.set(p, r ?? 0);
    children.set(pp!, [...(children.get(pp!) ?? []), p]);
  }
  let total = 0;
  const queue = [pid];
  const seen = new Set<number>();
  while (queue.length) {
    const p = queue.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    total += (rss.get(p) ?? 0) * 1024;
    queue.push(...(children.get(p) ?? []));
  }
  return total;
}

const TIME = process.platform === "darwin" ? ["/usr/bin/time", "-l"] : existsSync("/usr/bin/time") ? ["/usr/bin/time", "-v"] : [];
const KEEP = 4 << 20; // output kept in memory for classification (the log file has everything)

let current: number | undefined; // pid of the running gate's process group (SIGINT forwarding)

async function execute(
  gate: Gate,
  log: string,
  timeoutMin: number,
): Promise<{ code: number; output: string; peakTree: number; peakProc: number | null; ms: number }> {
  const started = performance.now();
  const stream = createWriteStream(log);
  stream.write(`$ ${gate.command}\n`);
  const [time = undefined, ...timeArgs] = TIME;
  const argv = [...(time ? [...timeArgs] : []), "nice", "-n", "10", "sh", "-c", gate.command];
  const child = spawn(time ?? argv.shift()!, argv, { cwd: root, env: childEnv(gate.env), detached: true, stdio: ["ignore", "pipe", "pipe"] });
  current = child.pid;
  let output = "";
  const take = (chunk: Buffer) => {
    stream.write(chunk);
    output += chunk.toString();
    if (output.length > KEEP * 2) output = output.slice(-KEEP);
  };
  child.stdout.on("data", take);
  child.stderr.on("data", take);
  let peakTree = 0;
  const sample = () => child.pid && (peakTree = Math.max(peakTree, treeRss(child.pid)));
  const first = setTimeout(sample, 200);
  const sampler = setInterval(sample, 1000);
  const timer = setTimeout(() => {
    take(Buffer.from(`\ngates: timeout after ${timeoutMin} min, killing the process group\n`));
    try {
      process.kill(-child.pid!, "SIGKILL");
    } catch {}
  }, timeoutMin * 60_000);
  const code = await new Promise<number>((done) => child.on("close", (status, signal) => done(status ?? (signal ? 128 : 1))));
  clearTimeout(first);
  clearInterval(sampler);
  clearTimeout(timer);
  current = undefined;
  await new Promise((r) => stream.end(r));
  const peakProc = timeRss(output.slice(-4000));
  // A gate shorter than the first sample: the largest single process (/usr/bin/time) is the best tree figure there is.
  return { code, output, peakTree: Math.max(peakTree, peakProc ?? 0), peakProc, ms: performance.now() - started };
}

export interface Result {
  id: string;
  status: Status;
  durationMs: number;
  peakRssBytes: number;
  peakProcessRssBytes: number | null;
  exitCode: number | null;
  detail: string;
  failures: string[];
  knownReds: KnownRed[];
  baselineDelta?: Record<string, string[]>;
  why: string;
  command: string;
  log?: string;
}

const fmtMs = (ms: number) =>
  ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;
const fmtBytes = (b: number | null) => (!b ? "-" : b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(2)} GB` : `${Math.round(b / (1 << 20))} MB`);

/** Baseline files a gate rewrites (their before/after delta goes into the report). */
function baselinesOf(gate: Gate, update: boolean): string[] {
  if (!update) return [];
  if (gate.id === "zero-cost") return ["scripts/zero-cost/runtime.txt", "scripts/zero-cost/packages.txt", "scripts/zero-cost/lanes.txt"];
  if (gate.id === "frames") return ["scripts/size-report/frames.json"];
  if (gate.id === "size:update") return ["scripts/size-report/baseline.json"];
  if (gate.id === "home-perf") return ["apps/docs/content/_home-perf.json"];
  return [];
}

const readText = (file: string) => (existsSync(resolve(root, file)) ? readFileSync(resolve(root, file), "utf8") : "");

/** Readable table of results (also used for `--list` with status "planned"). */
export function table(rows: { id: string; status: string; duration: string; rss: string; detail: string }[]): string {
  const head = { id: "gate", status: "status", duration: "duration", rss: "peak RSS", detail: "detail" };
  const all = [head, ...rows];
  const w = (k: keyof typeof head) => Math.max(...all.map((r) => r[k].length));
  const line = (r: typeof head) =>
    `${r.id.padEnd(w("id"))}  ${r.status.padEnd(w("status"))}  ${r.duration.padStart(w("duration"))}  ${r.rss.padStart(w("rss"))}  ${r.detail}`.trimEnd();
  return [line(head), "-".repeat(Math.min(160, line(head).length + 20)), ...rows.map(line)].join("\n");
}

/** The usage text = this file's header comment. */
function usage(): string {
  const lines = readFileSync(import.meta.filename, "utf8").split("\n");
  return lines
    .slice(
      0,
      lines.findIndex((l) => !l.startsWith("//")),
    )
    .map((l) => l.replace(/^\/\/ ?/, ""))
    .join("\n");
}

async function main(): Promise<number> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`gates: ${(error as Error).message}\n(usage: see the header of scripts/gates/run.ts)`);
    return 2;
  }
  const files = options.files ?? (options.mode === "all" ? [] : changedFiles(options.base));
  const projects = loadProjects(options.graph);
  const common = { files, projects, tests: options.tests, updateBaselines: options.updateBaselines, base: options.base };
  const planned = plan({ ...common, mode: options.mode });
  const catalog = options.mode === "all" ? planned : plan({ ...common, mode: "all" });
  const gates = select(planned, catalog, options.only, options.skip);
  const { touched, affected } =
    options.mode === "all" ? { touched: new Set<string>(), affected: new Set(projects.map((p) => p.name)) } : affectedProjects(files, projects);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logs = options.logs ?? join(root, ".artifacts/gates", stamp);
  const header = [
    `gates: ${options.mode}${options.mode === "affected" ? ` vs ${options.base}` : ""}${options.updateBaselines ? ", --update-baselines" : ""}; ${files.length} changed file(s)`,
    options.mode === "affected" ? `  touched: ${[...touched].sort().join(", ") || "-"}\n  affected: ${[...affected].sort().join(", ") || "-"}` : "",
    `  ${gates.length} gate(s)${options.list ? "" : `, logs ${logs}`}`,
  ].filter(Boolean);
  console.log(header.join("\n"));
  const report = {
    base: options.base,
    mode: options.mode,
    updateBaselines: options.updateBaselines,
    startedAt: new Date().toISOString(),
    host: { platform: process.platform, node: process.version, load: (spawnSync("uptime", { encoding: "utf8" }).stdout ?? "").trim() },
    files,
    touched: [...touched].sort(),
    affected: [...affected].sort(),
    gates: [] as Result[],
  };
  const writeReport = (file?: string) => {
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(report, null, 1) + "\n");
  };
  if (options.list) {
    report.gates = gates.map((g) => ({
      id: g.id,
      status: "skipped" as Status,
      durationMs: 0,
      peakRssBytes: 0,
      peakProcessRssBytes: null,
      exitCode: null,
      detail: g.requires.length ? `after ${g.requires.join(", ")}` : "",
      failures: [],
      knownReds: [],
      why: g.why,
      command: g.command,
    }));
    console.log(
      table(
        gates.map((g) => ({
          id: g.id,
          status: "planned",
          duration: "",
          rss: g.heavy ? "heavy" : "",
          detail: `${g.why}${g.requires.length ? ` (after ${g.requires.join(", ")})` : ""}`,
        })),
      ),
    );
    writeReport(options.json);
    return 0;
  }
  mkdirSync(logs, { recursive: true });
  const registry: KnownRed[] = JSON.parse(readFileSync(join(import.meta.dirname, "known-reds.json"), "utf8")).reds;
  const ctx = { registry, sizeTolerance: options.sizeTolerance, qwikChanged: options.mode === "all" ? false : qwikSourcesChanged(options.base, files) };
  const rssLimit = options.rssLimitMB * (1 << 20);
  const statuses = new Map<string, Status>();
  const ok = (s: Status | undefined) => s === "pass" || s === "known-red" || s === "noise";
  const tty = process.stdout.isTTY;
  process.on("SIGINT", () => {
    if (current)
      try {
        process.kill(-current, "SIGTERM");
      } catch {}
    writeReport(join(logs, "report.json"));
    process.exit(130);
  });
  const width = Math.max(...gates.map((g) => g.id.length), 10);
  for (const [index, gate] of gates.entries()) {
    const prefix = `[${String(index + 1).padStart(String(gates.length).length)}/${gates.length}] ${gate.id.padEnd(width)}`;
    const log = join(logs, `${gate.id.replace(/[^\w.-]+/g, "_")}.log`);
    const blockedBy = gate.requires.filter((r) => statuses.has(r) && !ok(statuses.get(r)));
    let result: Result;
    if (blockedBy.length) {
      result = {
        id: gate.id,
        status: "blocked",
        durationMs: 0,
        peakRssBytes: 0,
        peakProcessRssBytes: null,
        exitCode: null,
        detail: `requires ${blockedBy.join(", ")}`,
        failures: [],
        knownReds: [],
        why: gate.why,
        command: gate.command,
      };
    } else {
      if (tty) process.stdout.write(`${prefix}  running…`);
      const release = gate.heavy ? await acquireSlot(options.slots, () => tty && process.stdout.write(" (waiting for a heavy slot)")) : () => {};
      const baselines = baselinesOf(gate, options.updateBaselines);
      const before = Object.fromEntries(baselines.map((f) => [f, readText(f)]));
      let run;
      try {
        run = await execute(gate, log, options.timeoutMin);
      } finally {
        release();
      }
      let verdict: Verdict = classify(gate, run.code, run.output, ctx);
      let detail = verdict.detail;
      if (gate.id === "zero-cost" && options.updateBaselines && !ctx.qwikChanged) {
        // Qwik lane hashes drift with the machine / node_modules layout: keep the base values (no Qwik source changed).
        let baseLanes = "";
        try {
          baseLanes = git("show", `${options.base}:scripts/zero-cost/lanes.txt`);
        } catch {
          baseLanes = before["scripts/zero-cost/lanes.txt"] ?? "";
        }
        const lanes = resolve(root, "scripts/zero-cost/lanes.txt");
        const updated = readFileSync(lanes, "utf8");
        const restored = restoreQwikLines(baseLanes, updated);
        const reverted = baselineDelta(updated, restored).filter((l) => l.startsWith("-")).length;
        if (reverted) writeFileSync(lanes, restored);
        detail += `${detail ? "; " : ""}${reverted} Qwik lane line(s) restored to ${options.base}`;
      }
      const delta: Record<string, string[]> = {};
      for (const f of baselines) {
        const d = baselineDelta(before[f]!, readText(f));
        if (d.length) delta[f] = d;
      }
      if (baselines.length)
        detail += `${detail ? "; " : ""}${
          Object.keys(delta).length
            ? Object.entries(delta)
                .map(([f, d]) => `${f.split("/").pop()} ${d.length} line(s)`)
                .join(", ")
            : "baselines unchanged"
        }`;
      let status = verdict.status;
      if (run.peakTree > rssLimit) {
        status = "rss";
        detail = `peak tree RSS ${fmtBytes(run.peakTree)} > ${options.rssLimitMB} MB; ${detail}`;
      }
      result = {
        id: gate.id,
        status,
        durationMs: Math.round(run.ms),
        peakRssBytes: run.peakTree,
        peakProcessRssBytes: run.peakProc,
        exitCode: run.code,
        detail,
        failures: verdict.failures,
        knownReds: verdict.known,
        ...(Object.keys(delta).length ? { baselineDelta: delta } : {}),
        why: gate.why,
        command: gate.command,
        log,
      };
    }
    statuses.set(gate.id, result.status);
    report.gates.push(result);
    writeReport(join(logs, "report.json"));
    const line = `${prefix}  ${result.status.padEnd(9)} ${fmtMs(result.durationMs).padStart(8)}  ${fmtBytes(result.peakRssBytes).padStart(8)}  ${result.detail}`;
    process.stdout.write(tty ? `\r\x1b[K${line}\n` : `${line}\n`);
  }

  const rows = report.gates.map((r) => ({ id: r.id, status: r.status, duration: fmtMs(r.durationMs), rss: fmtBytes(r.peakRssBytes), detail: r.detail }));
  console.log(`\n${table(rows)}`);
  const known = report.gates.filter((r) => r.knownReds.length);
  if (known.length) {
    console.log("\nKnown reds (scripts/gates/known-reds.json; not failing):");
    for (const r of known)
      for (const k of r.knownReds) console.log(`  ${r.id}: ${k.match} — ${k.reason} (owner ${k.owner}${k.since ? `, since ${k.since}` : ""})`);
  }
  const noise = report.gates.filter((r) => r.status === "noise");
  if (noise.length) {
    console.log(`\nNoise (not failing; size tolerance ±${options.sizeTolerance} B):`);
    for (const r of noise) for (const f of r.failures.slice(0, 20)) console.log(`  ${r.id}: ${f}`);
  }
  const deltas = report.gates.filter((r) => r.baselineDelta);
  if (deltas.length) {
    console.log("\nBaseline deltas (name intended ones in the commit):");
    for (const r of deltas)
      for (const [f, d] of Object.entries(r.baselineDelta!))
        console.log(`  ${f}: ${d.length} line(s)\n    ${d.slice(0, 12).join("\n    ")}${d.length > 12 ? "\n    …" : ""}`);
  }
  const red = report.gates.filter((r) => r.status === "fail" || r.status === "rss" || r.status === "blocked");
  if (red.length) {
    console.log("\nNew reds:");
    for (const r of red) {
      console.log(`  ${r.id} (${r.status}): ${r.detail}${r.log ? `\n    log ${r.log}` : ""}`);
      for (const f of r.failures.filter((f) => !r.knownReds.some((k) => f.includes(k.match))).slice(0, 15)) console.log(`    ${f}`);
      if (!r.failures.length && r.log && existsSync(r.log)) {
        const tail = readFileSync(r.log, "utf8")
          .split("\n")
          .filter((l) => l.trim() && !/maximum resident|^\s+\d+\s+[a-z ]+$/.test(l))
          .slice(-8);
        for (const l of tail) console.log(`    | ${l.slice(0, 200)}`);
      }
    }
  }
  const total = report.gates.reduce((sum, r) => sum + r.durationMs, 0);
  console.log(
    `\ngates: ${red.length ? `${red.length} new red(s)` : "no new reds"} — ${report.gates.length} gate(s), ${fmtMs(total)}, max tree RSS ${fmtBytes(Math.max(0, ...report.gates.map((r) => r.peakRssBytes)))}; report ${join(logs, "report.json")}`,
  );
  writeReport(join(logs, "report.json"));
  writeReport(options.json);
  return red.length ? 1 : 0;
}

if (import.meta.main)
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
