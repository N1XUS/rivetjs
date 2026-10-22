// LAZY-VS-DERIVED: server CPU per request of several story-app builds (`stories.ts --build … --dist <d>`, e.g. default /
// lazyRows / lazyRows + domData / `RIVET_RESUME_MODEL=derived`). One worker process per build (`--worker <dist>`: its own
// server bundle and runtime instance, so process-global hooks never mix), `RIVET_LAZY_ROWS=on` like `client.ts --serve`.
// Rounds interleave the builds (rotated order per round); per round and build: `--warm` renders, then `--samples` renders
// timed in the worker (process.cpuUsage user + system, wall). Median over rounds; the 1-min load is recorded per round.
//
//   node apps/ssr-bench/spikes/lazy-cost/cpu.ts --builds default=<dist>,lazy=<dist>,… [--pages /list-data-1000,/resume-1000]
//        [--rounds 5] [--samples 1500] [--warm 50] [--json <file>]
import { fork, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}

if (process.argv.includes("--worker")) {
  process.env.RIVET_LAZY_ROWS = "on";
  const { loadBuild } = await import("../../../../libs/router/adapters/build.ts");
  const { handler } = await loadBuild(resolve(arg("worker", "")));
  const once = async (path: string) => {
    const response = await handler(new Request("http://localhost" + path));
    if (response.status !== 200) throw new Error(`${path}: ${response.status}`);
    return response.text();
  };
  process.on("message", async (m: { path: string; warm: number; samples: number }) => {
    for (let i = 0; i < m.warm; i++) await once(m.path);
    const c0 = process.cpuUsage(),
      t0 = performance.now();
    let bytes = 0;
    for (let i = 0; i < m.samples; i++) bytes = (await once(m.path)).length;
    const wall = performance.now() - t0,
      c = process.cpuUsage(c0);
    process.send!({ cpu: (c.user + c.system) / 1000 / m.samples, wall: wall / m.samples, bytes });
  });
  process.send!({ ready: true });
  await new Promise(() => {});
}

const builds = arg("builds", "")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [name, dist] = s.split("=");
    return { name: name!, dist: dist! };
  });
const pages = arg("pages", "/list-data-1000,/resume-1000").split(",");
const rounds = Number(arg("rounds", "5"));
const samples = Number(arg("samples", "1500"));
const warm = Number(arg("warm", "50"));
const jsonOut = arg("json", "");

const workers = new Map<string, ChildProcess>();
for (const b of builds) {
  const child = fork(import.meta.filename, ["--worker", b.dist], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  await new Promise<void>((ok, fail) => {
    child.once("message", () => ok());
    child.once("exit", (code) => fail(new Error(`worker ${b.name} exited ${code}`)));
  });
  workers.set(b.name, child);
}
const run = (name: string, path: string) =>
  new Promise<{ cpu: number; wall: number; bytes: number }>((ok, fail) => {
    const w = workers.get(name)!;
    w.once("message", ok);
    w.once("exit", (code) => fail(new Error(`worker ${name} exited ${code}`)));
    w.send({ path, warm, samples });
  });
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]!;
const load = () => Math.round(loadavg()[0]! * 10) / 10;
const results: Record<string, Record<string, { cpu: number; wall: number; bytes: number; load: number }[]>> = {};
for (const path of pages)
  for (let r = 0; r < rounds; r++) {
    const order = builds.map((_, i) => builds[(i + r) % builds.length]!);
    for (const b of order) {
      const l0 = load();
      const s = await run(b.name, path);
      ((results[path] ??= {})[b.name] ??= []).push({ ...s, load: Math.max(l0, load()) });
      console.error(`${path} round ${r + 1}/${rounds} ${b.name}: ${s.cpu.toFixed(3)} ms CPU (load ${l0})`);
    }
  }
console.log(`| page | build | CPU ms / req (median) | wall ms / req | vs ${builds[0]!.name} (CPU) | HTML bytes | load |`);
console.log(`| --- | --- | ---: | ---: | ---: | ---: | --- |`);
for (const path of pages) {
  const base = med(results[path]![builds[0]!.name]!.map((s) => s.cpu));
  for (const b of builds) {
    const ss = results[path]![b.name]!;
    const cpu = med(ss.map((s) => s.cpu));
    const ls = ss.map((s) => s.load);
    console.log(
      `| ${path} | ${b.name} | ${cpu.toFixed(3)} | ${med(ss.map((s) => s.wall)).toFixed(3)} | ${(cpu / base).toFixed(2)}× | ${ss[0]!.bytes} | ${Math.min(...ls)}–${Math.max(...ls)} |`,
    );
  }
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ date: new Date().toISOString(), builds, pages, rounds, samples, warm, results }, null, 1));
for (const w of workers.values()) w.kill();
process.exit(0);
