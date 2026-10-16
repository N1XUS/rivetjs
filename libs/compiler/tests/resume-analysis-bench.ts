// Interleaved old/new resume-analysis WASM measurements; full output equality checked before timing.
// Ported from codex/hybrid-resume-hydration 2bab010c (`resume-prefix-bench.ts`). Workloads: `lists` (site-free lists
// beside handlers: `has_site_within` / `rust/src/resume/bounds.rs`), `symbols` (symbol prefixes), `captures`, `scopes`.
// Before directory = a copy of `libs/compiler/wasm.ts` + `rivet_compiler.wasm` taken before the rebuild.
// Env: RIVET_SIZES=100,500,1000,2000, RIVET_AFTER_FIRST=1 (swap the parity/warmup order). Rounds whose load > 4 are dropped.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { call as after } from "../wasm.ts";
if (!process.argv[2])
  throw new Error(
    "Usage: node libs/compiler/tests/resume-analysis-bench.ts <before directory containing wasm.ts and rivet_compiler.wasm> [rounds=12] [lists|symbols|captures|scopes]",
  );
const { call: before } = (await import(pathToFileURL(resolve(process.argv[2], "wasm.ts")).href)) as { call: typeof after };
type Output = { sites?: unknown[]; symbols?: unknown[] };
const afterFirst = process.env.RIVET_AFTER_FIRST === "1";
const workload = process.argv[4] ?? "lists";
assert.ok(["symbols", "lists", "captures", "scopes"].includes(workload), "workload must be symbols, lists, captures or scopes");
const source = (n: number) =>
  workload === "scopes"
    ? `${Array.from({ length: n }, (_, i) => `const value${i}=${i};`).join("")}export function Page(){return <main>${Array.from({ length: n }, (_, i) => `<button onClick={()=>value${i}}>${i}</button>`).join("")}</main>}`
    : workload === "captures"
      ? `import {signal,computed} from '@rivetjs/reactivity';export function Page(){const value=signal(0);${Array.from({ length: n }, (_, i) => `const c${i}=computed(()=>value()+${i});const f${i}=()=>c${i}()+${i};`).join("")}return <div>${Array.from({ length: n }, (_, i) => `<button onClick={()=>f${i}()}>{c${i}()}</button>`).join("")}</div>}`
      : workload === "lists"
        ? `// é 😀 — repeated site-free lists beside handlers
const items=[{label:'one'}];export function Page(){return <main>${Array.from({ length: n }, (_, i) => `<button onClick={()=>console.log(${i})}>${i}</button>{items.map(row=><p>{row.label}</p>)}`).join("")}</main>}`
        : `import {signal} from '@rivetjs/reactivity';export function App(){const [n,setN]=signal(0);return <div>${Array.from({ length: n }, (_, i) => `<button title="é ${i} — ✓" onClick={()=>setN(n()+${i})}>héllo 😀 {n()}</button>`).join("")}</div>}`;
const sizes = (process.env.RIVET_SIZES ?? "100,500,1000,2000").split(",").map(Number),
  modes = ["check", "server", "dom"],
  rounds = Number(process.argv[3] ?? 12);
assert.ok(
  sizes.length > 0 && sizes.every((size) => Number.isInteger(size) && size > 0) && new Set(sizes).size === sizes.length,
  "sizes must be unique positive integers",
);
assert.ok(Number.isInteger(rounds) && rounds > 0, "rounds must be a positive integer");
const request = (mode: string, n: number) => ({
  op: mode === "check" ? "check" : "compile",
  source: source(n),
  options: { filename: "a.tsx", resume: { module: "a.tsx" }, ...(mode === "check" ? {} : { target: mode }) },
});
let peak = 0;
for (const mode of modes)
  for (const n of sizes) {
    const q = request(mode, n),
      first = (afterFirst ? after : before)<Output>(q),
      second = (afterFirst ? before : after)<Output>(q),
      a = afterFirst ? second : first,
      b = afterFirst ? first : second;
    assert.deepEqual(b, a, `full output parity ${mode}/${n}`);
    assert.equal((a.sites ?? a.symbols)!.length, n * (workload === "scopes" ? 1 : workload === "captures" ? 4 : 2));
  }
const samples: { mode: string; n: number; round: number; variant: string; ms: number; load: string }[] = [];
for (const mode of modes) {
  const requests = new Map(sizes.map((n) => [n, request(mode, n)]));
  for (let round = -2; round < rounds; round++)
    for (const n of round % 2 ? [...sizes].reverse() : sizes) {
      for (const variant of Boolean(round % 2) !== afterFirst ? ["after", "before"] : ["before", "after"]) {
        const load = execFileSync("uptime", { encoding: "utf8" }).trim();
        const begin = performance.now();
        const result = (variant === "before" ? before : after)<Output>(requests.get(n)!);
        const ms = performance.now() - begin;
        assert.equal((result.sites ?? result.symbols)!.length, n * (workload === "scopes" ? 1 : workload === "captures" ? 4 : 2));
        peak = Math.max(peak, process.memoryUsage().rss);
        assert.ok(peak < 3 * 1024 ** 3);
        if (round >= 0) samples.push({ mode, n, round, variant, ms, load });
      }
    }
}
const median = (a: number[]) => {
  if (!a.length) return null;
  a.sort((x, y) => x - y);
  const i = a.length >> 1;
  return a.length % 2 ? a[i]! : (a[i - 1]! + a[i]!) / 2;
};
const qualified = samples.filter((sample) =>
  samples
    .filter((other) => other.mode === sample.mode && other.n === sample.n && other.round === sample.round)
    .every((other) => Number(other.load.match(/load averages?: ([\d.]+)/)?.[1] ?? Infinity) <= 4),
);
console.log(
  JSON.stringify(
    {
      rounds,
      sizes,
      workload,
      afterFirst,
      execArgv: process.execArgv,
      peakMiB: peak / 1024 ** 2,
      parityCases: modes.length * sizes.length,
      maxHostLoad: 4,
      summary: modes.flatMap((mode) =>
        sizes.map((n) => ({
          mode,
          n,
          qualifyingPairs: qualified.filter((s) => s.mode === mode && s.n === n && s.variant === "before").length,
          before: median(qualified.filter((s) => s.mode === mode && s.n === n && s.variant === "before").map((s) => s.ms)),
          after: median(qualified.filter((s) => s.mode === mode && s.n === n && s.variant === "after").map((s) => s.ms)),
        })),
      ),
      samples,
    },
    null,
    2,
  ),
);
