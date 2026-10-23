// PPR-T57 (spec docs/design/specs/2026-10-20-ppr-shell-design.md T5): the shell cache under HTTP load — the same closed loop
// as the editorial bench's dynamic phase (`../../run.ts`: keep-alive raw-socket client, CPU = server process `ps` time delta)
// against the PPR spike app on the node adapter (`serve.ts`, one fresh process per target and round), signed in (`sid`
// cookie: the user menu is the hole), over 20 article URLs:
//   full     — `/full/articles/<slug>/`: today's signed-in page (cookie → route-cache bypass → loaders + full render)
//   shell    — `/shell/articles/<slug>/`: route rule `shell`, warm store, H-holes hits (`x-rivet-cache: SHELL-HIT`)
//   shell-h  — the same URLs with `RIVET_SHELL_HOLES=0` (H-replay: muted replay of the shell, `SHELL-HIT-REPLAY`)
//   floor    — `/floor/`: the router pipeline with no loader and one element
// Per target and round: a 2 s warm-up (stores every shell: two misses each, the doorkeeper), a header check, then c1 and c10
// runs of `--seconds` each. RSS = the server's peak `ps` RSS during the measured runs. A measurement waits for the 1-min load
// to drop to `--max-load` (default 8) and records the load at its start and end.
//
//   node apps/editorial-bench/spikes/ppr-shell/loadgen.ts [--build] [--rounds 3] [--seconds 5] [--targets full,shell,shell-h,floor]
//        [--max-load 8] [--json out.json]
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { Connection, type Response } from "../../../ssr-bench/loadgen/client.ts";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
};
const here = import.meta.dirname;
const root = resolve(here, "app");
const dist = resolve(root, ".artifacts", "dist");
const content = resolve(here, "../../fixture/content/n1000");
process.env.EDITORIAL_CONTENT ??= content;
if (process.argv.includes("--build")) {
  const script = `
    import { build } from "vite";
    const root = ${JSON.stringify(root)}, dist = ${JSON.stringify(dist)};
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { outDir: dist + "/client", emptyOutDir: true } });
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { ssr: true, outDir: dist + "/server", emptyOutDir: true } });`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "inherit", env: process.env, cwd: root });
}
const ROUNDS = Number(arg("rounds", "3"));
const SECONDS = Number(arg("seconds", "5"));
const MAX_LOAD = Number(arg("max-load", "8"));
const PORT = 4413;
const COOKIE = "sid=s7; theme=dark; _ga=GA1.2.123456789.1700000000";
const { slugs } = await import("../../lanes/rivet/src/content.ts");
const articles = slugs().slice(0, 20);
type Target = { paths: string[]; env: Record<string, string>; header: string | null };
const TARGETS: Record<string, Target> = {
  full: { paths: articles.map((s) => `/full/articles/${s}/`), env: {}, header: null },
  shell: { paths: articles.map((s) => `/shell/articles/${s}/`), env: {}, header: "SHELL-HIT" },
  "shell-h": { paths: articles.map((s) => `/shell/articles/${s}/`), env: { RIVET_SHELL_HOLES: "0" }, header: "SHELL-HIT-REPLAY" },
  floor: { paths: ["/floor/"], env: {}, header: null },
};
const names = arg("targets", Object.keys(TARGETS).join(",")).split(",");
const load1 = () => loadavg()[0]!;

const ps = (pid: number, field: "time" | "rss"): string => execFileSync("ps", ["-o", field + "=", "-p", String(pid)], { encoding: "utf8" }).trim();
const cpuSeconds = (pid: number): number =>
  ps(pid, "time")
    .split(":")
    .map(Number)
    .reduce((s, x) => s * 60 + x, 0);

function startServer(env: Record<string, string>): Promise<ChildProcess> {
  const child = spawn(process.execPath, [resolve(here, "serve.ts")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_OPTIONS: "", PORT: String(PORT), ...env },
  });
  child.stderr!.on("data", (d) => process.stderr.write(d));
  return new Promise((ok, fail) => {
    const t0 = Date.now();
    const poll = async () => {
      try {
        if ((await fetch(`http://127.0.0.1:${PORT}/floor/`)).ok) return ok(child);
      } catch {}
      if (Date.now() - t0 > 20_000) return fail(new Error(`server on ${PORT} did not start`));
      setTimeout(poll, 100);
    };
    poll();
  });
}
const stop = (child: ChildProcess) => new Promise<void>((done) => (child.once("exit", () => done()), child.kill("SIGTERM")));

async function closedLoop(paths: string[], concurrency: number, seconds: number, pid: number) {
  const requests = paths.map((p) =>
    Buffer.from(`GET ${p} HTTP/1.1\r\nHost: 127.0.0.1:${PORT}\r\nConnection: keep-alive\r\nAccept: text/html\r\nCookie: ${COOKIE}\r\n\r\n`, "latin1"),
  );
  const conns = Array.from({ length: concurrency }, () => new Connection("127.0.0.1", PORT, paths[0]!));
  await Promise.all(conns.map((c) => c.open()));
  const lat: number[] = [],
    ttfb: number[] = [];
  let bytes = 0,
    errors = 0,
    next = 0,
    rss = 0;
  const sampler = setInterval(() => (rss = Math.max(rss, Number(ps(pid, "rss")))), 100);
  const cpu0 = cpuSeconds(pid);
  const t0 = performance.now();
  const end = t0 + seconds * 1000;
  await Promise.all(
    conns.map(
      (c) =>
        new Promise<void>((done) => {
          const go = () => {
            if (performance.now() >= end) return done();
            (c as unknown as { request: Buffer }).request = requests[next++ % requests.length]!;
            c.send((r: Response) => {
              if (r.status !== 200 || r.error) errors++;
              else {
                lat.push(Number(r.end - c.sentAt) / 1e6);
                ttfb.push(Number(r.firstByte - c.sentAt) / 1e6);
                bytes += r.bytes;
              }
              go();
            });
          };
          go();
        }),
    ),
  );
  const wall = (performance.now() - t0) / 1000;
  const cpu = cpuSeconds(pid) - cpu0;
  clearInterval(sampler);
  conns.forEach((c) => c.close());
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? NaN;
  return {
    requests: lat.length,
    errors,
    rps: lat.length / wall,
    p50: q(lat, 0.5),
    p99: q(lat, 0.99),
    ttfbP50: q(ttfb, 0.5),
    cpuMsPerReq: (cpu * 1000) / lat.length,
    bytesPerReq: bytes / lat.length,
    rssMB: rss / 1024,
  };
}
async function calm(): Promise<number> {
  for (let waited = 0; load1() > MAX_LOAD && waited < 600; waited += 5) {
    if (waited % 60 === 0) console.log(`load ${load1().toFixed(2)} > ${MAX_LOAD}: waiting`);
    await new Promise((done) => setTimeout(done, 5000));
  }
  return load1();
}

type Run = Awaited<ReturnType<typeof closedLoop>> & { load: [number, number] };
const runs: Record<string, { c1: Run[]; c10: Run[] }> = {};
for (let round = 0; round < ROUNDS; round++) {
  for (const name of round % 2 ? [...names].reverse() : names) {
    const target = TARGETS[name]!;
    const server = await startServer(target.env);
    try {
      await closedLoop(target.paths, 1, 2, server.pid!); // warm-up: module load, JIT, the store (two misses per URL)
      // The path check: 64 hits of one URL answer the target's path (H-holes: all but its VERIFY hit, every 64th).
      if (target.header !== null) {
        const seen: Record<string, number> = {};
        for (let i = 0; i < 64; i++) {
          const response = await fetch(`http://127.0.0.1:${PORT}${target.paths[0]}`, { headers: { cookie: COOKIE, accept: "text/html" } });
          await response.text();
          const header = String(response.headers.get("x-rivet-cache"));
          seen[header] = (seen[header] ?? 0) + 1;
        }
        if ((seen[target.header] ?? 0) < 63) throw new Error(`${name}: expected ${target.header}, got ${JSON.stringify(seen)}`);
      }
      const entry = (runs[name] ??= { c1: [], c10: [] });
      for (const c of [1, 10] as const) {
        const start = await calm();
        const result = await closedLoop(target.paths, c, SECONDS, server.pid!);
        entry[c === 1 ? "c1" : "c10"].push({ ...result, load: [start, load1()] });
        console.log(
          `round ${round + 1} ${name} c${c}: ${result.rps.toFixed(0)} req/s, p50 ${result.p50.toFixed(3)} / p99 ${result.p99.toFixed(3)} ms, ` +
            `CPU ${result.cpuMsPerReq.toFixed(4)} ms/req, RSS ${result.rssMB.toFixed(0)} MB, errors ${result.errors}, load ${start.toFixed(2)}→${load1().toFixed(2)}`,
        );
      }
    } finally {
      await stop(server);
    }
  }
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const range = (xs: number[], digits: number) => `${med(xs).toFixed(digits)} (${Math.min(...xs).toFixed(digits)}–${Math.max(...xs).toFixed(digits)})`;
console.log(`\n| target | c | req/s | p50 ms | p99 ms | TTFB p50 ms | CPU ms/req | RSS MB | bytes/req | load (start–end) | errors |`);
console.log(`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |`);
for (const name of names)
  for (const c of ["c1", "c10"] as const) {
    const rs = runs[name]![c];
    console.log(
      `| ${name} | ${c.slice(1)} | ${range(
        rs.map((r) => r.rps),
        0,
      )} | ${range(
        rs.map((r) => r.p50),
        3,
      )} | ${range(
        rs.map((r) => r.p99),
        3,
      )} | ${med(rs.map((r) => r.ttfbP50)).toFixed(3)} | ${range(
        rs.map((r) => r.cpuMsPerReq),
        4,
      )} | ${med(rs.map((r) => r.rssMB)).toFixed(0)} | ${med(rs.map((r) => r.bytesPerReq)).toFixed(0)} | ${rs
        .map((r) => r.load.map((l) => l.toFixed(1)).join("–"))
        .join(", ")} | ${rs.reduce((s, r) => s + r.errors, 0)} |`,
    );
  }
const out = arg("json", "");
if (out) writeFileSync(out, JSON.stringify({ rounds: ROUNDS, seconds: SECONDS, runs }, null, 2));
