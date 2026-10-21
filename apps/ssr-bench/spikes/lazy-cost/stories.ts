// LAZY-COST-2 harness: cdk story pages (`stories/`: the cdk stories `/list-data`, `/virtualized-collections`, `/dom-data` as is
// + 1000-row `/list-data-1000`, `/dom-data-1000`) built once with `resume: { lazyRows: true }` (`--dom-data`: + `domData`)
// and rendered in-process by the build's request handler: recorded rows (`resume`) vs lazy rows (`lazy`,
// `RIVET_LAZY_ROWS=on`, read per render). Interleaved rounds; CPU (process.cpuUsage) + wall median per render.
//
//   node apps/ssr-bench/spikes/lazy-cost/stories.ts [--build] [--dom-data] [--dist <dir>] [--pages /list-data-1000,…]
//        [--base <dist>] [--lanes resume,lazy,base-resume,base-lazy] [--rounds 6] [--samples 20] [--dump <lane> --page <path>] [--profile <lane> --page <path> --seconds 8]
import { execFileSync } from "node:child_process";
import { loadavg } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}
const root = resolve(import.meta.dirname, "stories");
const domData = process.argv.includes("--dom-data");
// Default output under `.artifacts/` (gitignored).
const dist = resolve(arg("dist", resolve(root, ".artifacts", domData ? "dist-domdata" : "dist")));
if (process.argv.includes("--build")) {
  const env = { ...process.env, ...(domData ? { RIVET_DOM_DATA: "1" } : {}) };
  delete env.RIVET_LAZY_ROWS;
  const script = `
    import { build } from "vite";
    const root = ${JSON.stringify(root)}, dist = ${JSON.stringify(dist)};
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { outDir: dist + "/client", emptyOutDir: true } });
    await build({ root, configFile: root + "/vite.config.ts", logLevel: "warn", build: { ssr: true, outDir: dist + "/server", emptyOutDir: true } });`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "inherit", env, cwd: root });
}
const { loadBuild } = await import("../../../../libs/router/adapters/build.ts");
// DOM-DATA runtimes install a process-global row item hook (`Symbol.for("rivet.domRowItem")`, cdk `domRowItem`): with two
// builds in one process each render gets its own build's hook back.
const HOOK = Symbol.for("rivet.domRowItem");
const global = globalThis as unknown as Record<symbol, unknown>;
const { handler } = await loadBuild(dist);
const hook = global[HOOK];
// `--base <dist>`: a second build (e.g. of the base commit) loaded into this process: lanes `base-resume` / `base-lazy`.
const baseDist = arg("base", "");
const baseHandler = baseDist ? (await loadBuild(resolve(baseDist))).handler : null;
const baseHook = global[HOOK];
const once = async (path: string, lane: string): Promise<string> => {
  if (lane.endsWith("lazy")) process.env.RIVET_LAZY_ROWS = "on";
  else delete process.env.RIVET_LAZY_ROWS;
  global[HOOK] = lane.startsWith("base-") ? baseHook : hook;
  const response = await (lane.startsWith("base-") ? baseHandler! : handler)(new Request("http://localhost" + path));
  if (response.status !== 200) throw new Error(`${path}: ${response.status}`);
  return response.text();
};
// `--lanes a,b`: a subset (pages whose recorded render leaks — the virtualized collections — run out of heap otherwise).
const lanes = arg("lanes", baseHandler ? "resume,lazy,base-resume,base-lazy" : "resume,lazy").split(",");
const dump = arg("dump", "");
const page = arg("page", "/list-data-1000");
if (dump) {
  console.log(await once(page, dump));
  process.exit(0);
}
const profile = arg("profile", "");
if (profile) {
  const until = performance.now() + Number(arg("seconds", "8")) * 1000;
  let n = 0;
  while (performance.now() < until) {
    await once(page, profile);
    n++;
  }
  console.log(`${profile} ${page}: ${n} renders`);
  process.exit(0);
}
const pages = arg("pages", "/list-data,/list-data-1000,/virtualized-collections" + (domData ? ",/dom-data,/dom-data-1000" : "")).split(",");
const rounds = Number(arg("rounds", "6"));
const samples = Number(arg("samples", "20"));
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const state = (s: string) => /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(s)?.[1]?.length ?? 0;
console.log(
  `dist ${dist} · domData ${domData} · load ${loadavg()
    .map((n) => n.toFixed(2))
    .join(" ")}`,
);
console.log(`| page | lane | wall ms (median) | CPU ms (median) | vs resume (CPU) | HTML bytes | state bytes | L entries |`);
console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
for (const path of pages) {
  const html: Record<string, string> = {};
  for (const lane of lanes) html[lane] = await once(path, lane);
  const wall: Record<string, number[]> = Object.fromEntries(lanes.map((l) => [l, []])),
    cpu: Record<string, number[]> = Object.fromEntries(lanes.map((l) => [l, []]));
  for (let r = 0; r < rounds; r++) {
    for (const lane of r % 2 ? [...lanes].reverse() : lanes) {
      for (let i = 0; i < 3; i++) await once(path, lane);
      const c0 = process.cpuUsage(),
        t0 = performance.now();
      for (let i = 0; i < samples; i++) await once(path, lane);
      const t = performance.now() - t0,
        c = process.cpuUsage(c0);
      wall[lane]!.push(t / samples);
      cpu[lane]!.push((c.user + c.system) / 1000 / samples);
    }
  }
  for (const lane of lanes) {
    const lazyEntries = /"L":\[/.test(html[lane]!) ? (html[lane]!.match(/<!--r\d*\[-->/g)?.length ?? 0) : 0;
    console.log(
      `| ${path} | ${lane} | ${med(wall[lane]!).toFixed(3)} | ${med(cpu[lane]!).toFixed(3)} | ${cpu.resume?.length ? (med(cpu[lane]!) / med(cpu.resume!)).toFixed(2) + "×" : "-"} | ${html[lane]!.length} | ${state(html[lane]!)} | ${lazyEntries} |`,
    );
  }
}
console.log(
  `load after ${loadavg()
    .map((n) => n.toFixed(2))
    .join(" ")}`,
);
