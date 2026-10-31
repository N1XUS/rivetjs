import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Command } from "./types.ts";
export interface Execution extends Command {
  cwd: string;
  log: string;
  deadline: number;
  rssLimitMB: number;
  signal?: AbortSignal;
}
export interface ProcessResult {
  code: number;
  reason: string | null;
  peakRssBytes: number;
}
function rss(pid: number, groups: Set<number>): number {
  const result = spawnSync("ps", ["-A", "-o", "pid=,ppid=,pgid=,rss="], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Cannot measure process-tree RSS");
  const rows = result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const tree = new Set([pid]);
  let last = 0;
  while (last !== tree.size) {
    last = tree.size;
    for (const [p, parent] of rows) if (tree.has(parent)) tree.add(p);
  }
  for (const [p, , group] of rows) if (tree.has(p) && tree.has(group)) groups.add(group);
  return rows.reduce((sum, [p, , , memory]) => sum + (tree.has(p) ? memory * 1024 : 0), process.memoryUsage().rss);
}
export function restrictedEnvironment(rssLimitMB = 3072): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "TERM",
    "CODEX_HOME",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "PLAYWRIGHT_BROWSERS_PATH",
    "RIVET_HEAVY_SLOTS_DIR",
  ])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  // Go's heap goal must leave room for compiler non-heap, Node/Nx wrappers and the supervisor.
  // It is a soft target; the sampled process-tree RSS guard remains authoritative.
  const mib = 1024 * 1024,
    quantum = 64 * mib;
  const available = Math.max(1, Math.floor(rssLimitMB * mib * 0.6));
  const native = available >= quantum ? Math.floor(available / quantum) * quantum : available;
  Object.assign(env, {
    GOMEMLIMIT: native % mib === 0 ? `${native / mib}MiB` : `${native}B`,
    NODE_OPTIONS: "--max-old-space-size=2048",
    NX_DAEMON: "false",
    NX_ISOLATE_PLUGINS: "false",
    RIVET_HEAVY_SLOTS: "1",
    NO_COLOR: "1",
  });
  return env;
}
export async function execute(options: Execution): Promise<ProcessResult> {
  mkdirSync(dirname(options.log), { recursive: true });
  const log = createWriteStream(options.log, { flags: "wx" });
  let reason: string | null = null;
  let peakRssBytes = 0;
  let bytes = 0;
  let force: ReturnType<typeof setTimeout> | undefined;
  const env = restrictedEnvironment(options.rssLimitMB);
  const child = spawn("nice", ["-n", "10", options.file, ...options.args], { cwd: options.cwd, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
  const groups = new Set<number>(child.pid ? [child.pid] : []);
  const kill = (signal: NodeJS.Signals) => {
    for (const group of groups)
      try {
        process.kill(-group, signal);
      } catch {}
  };
  const stop = (why: string) => {
    if (reason) return;
    reason = why;
    if (child.pid)
      try {
        peakRssBytes = Math.max(peakRssBytes, rss(child.pid, groups));
      } catch {}
    kill("SIGTERM");
    force = setTimeout(() => kill("SIGKILL"), 1000);
  };
  const output = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes <= 50 * 1024 * 1024) log.write(chunk);
    else stop("log-limit");
  };
  child.stdout.on("data", output);
  child.stderr.on("data", output);
  child.stdin.on("error", () => {});
  child.stdin.end(options.stdin ?? "");
  const abort = () => stop("interrupted");
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => stop("timeout"), Math.max(0, options.deadline - Date.now()));
  const sample = () => {
    if (!child.pid) return;
    try {
      peakRssBytes = Math.max(peakRssBytes, rss(child.pid, groups));
      if (peakRssBytes > options.rssLimitMB * 1024 * 1024) stop("memory-limit");
    } catch {
      stop("rss-unavailable");
    }
  };
  const first = setTimeout(sample, 100);
  const sampler = setInterval(sample, 500);
  if (options.signal?.aborted) abort();
  const code = await new Promise<number>((done) => {
    child.on("error", (error) => {
      reason = "spawn-error";
      log.write(String(error));
      done(127);
    });
    child.on("close", (code) => done(code ?? 128));
  });
  clearTimeout(timer);
  clearTimeout(first);
  clearInterval(sampler);
  if (force) clearTimeout(force);
  options.signal?.removeEventListener("abort", abort);
  kill("SIGKILL");
  await new Promise<void>((done) => log.end(done));
  return { code: reason ? code || 1 : code, reason, peakRssBytes };
}
