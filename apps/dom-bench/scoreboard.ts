// Rivet-only scoreboard against stored competitor numbers (competitors.json) and krausest ratios (krausest/published.json).
// Usage: node apps/dom-bench/scoreboard.ts [--repo <checkout or worktree path>] [--suites dom,krausest,resume] [--ssr]
//          [--quick] [--dom-build-args "--compact"] [--krausest-compile-options '{"experimentalDomCompact":true}']
//          [--krausest-iterations N] [--md docs/benchmarks/perf-scoreboard.md | --no-md] [--label text]
// --repo (default: this checkout) is measured through its own adapters and build scripts:
//   dom:      <repo>/apps/dom-bench/build.ts, then <repo>/apps/dom-bench/run.ts --frameworks rivet --rows 1000,5000
//             (window.bench contract; the branch's run.ts validates the branch's DOM output).
//   krausest: <repo>/apps/dom-bench/krausest/build.ts if present (else this harness's build.ts --repo <repo>), then
//             THIS checkout's krausest/run.ts (DOM-only contract; identical harness for every branch).
//   resume:   <repo>/apps/resume-bench/run.ts --build --lanes rivet --conditions slow (CLI contract).
//   ssr:      <repo> benchmark.py --frameworks=rivet-compiled,rivet-resume --rows=100,1000,5000 --concurrency=1 with the
//             duration/warmup/repeats/GC profile recorded in competitors.json ssr.provenance (isolated compose
//             project/ports). Refuses (n/a) when the run's generator sha / window / GC profile differ. Needs Docker.
// Verdicts (verdict.ts): WIN/LOSE need a >=3% median gap and non-overlapping trial ranges (when both sides have
// ranges); otherwise TIE. Browser builds are recorded and compared with each stored reference (B6).
// Every timed phase runs under the shared bench lock (bench-lock.ts); the krausest runner locks per benchmark.
// Output: .artifacts/perf-night/scoreboard/<stamp>.json (+ raw results in <stamp>/), markdown summary (default docs/benchmarks/perf-scoreboard.md).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withBenchLock } from "./bench-lock.ts";
import { compareToPublished, REFERENCE_FRAMEWORKS, type SuiteResults } from "./krausest/compare.ts";
import { asStat, browserDrift, overall, publishedChrome, stat, verdict, type Stat, type Verdict } from "./verdict.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ownRoot = resolve(here, "../..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const repo = resolve(option("repo", ownRoot));
const quick = flag("quick");
const suites = option("suites", "dom,krausest,resume")
  .split(",")
  .concat(flag("ssr") ? ["ssr"] : []);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outRoot = resolve(".artifacts/perf-night/scoreboard");
const raw = resolve(outRoot, stamp);
type Stored = number | Stat;
interface SsrProvenance {
  generator: string;
  generator_sha256: string | null;
  duration: number;
  warmup: number;
  repeats: number;
  gc: string;
  strings?: boolean;
}
const competitors = JSON.parse(await readFile(resolve(here, "competitors.json"), "utf8")) as {
  labels: Record<string, string>;
  dom: Record<string, Record<string, Record<string, Stored>>> & { gzip: Record<string, number>; provenance?: { browser?: string; protocol?: string } };
  resume: Record<string, Record<string, Stored> | string> & { provenance?: { chrome?: string; metric?: string } };
  ssr: {
    provenance?: SsrProvenance;
    /** Peer class per lane: static peers rank against rivet-compiled, resumable/hydratable ones against rivet-resume. */
    classes?: Record<string, "static" | "resumable">;
    metrics?: Record<string, Record<string, Record<string, Stat>>>;
  };
};
const node = process.execPath;
const git = (...command: string[]) => {
  try {
    return execFileSync("git", ["-C", repo, ...command], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};
/** Run a child process in `cwd`, streaming output; reject on non-zero exit. */
const run = (command: string, argv: string[], cwd: string, env: Record<string, string> = {}) =>
  new Promise<void>((yes, no) => {
    console.log(`$ (${relative(ownRoot, cwd) || "."}) ${command === node ? "node" : command} ${argv.join(" ")}`);
    const child = spawn(command, argv, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
    child.on("exit", (code) => (code === 0 ? yes() : no(Error(`${command} ${argv.join(" ")} exited ${code}`))));
    child.on("error", no);
  });

interface Scenario {
  suite: string;
  id: string;
  unit: string;
  better: "lower" | "higher";
  rivet: Stat | null;
  competitors: Record<string, Stat>;
  /** "ratio": krausest-style comparison of ratios to vanillajs (values are ratios). */
  basis?: "absolute" | "ratio";
  verdict: Verdict | "n/a";
  verdicts: Record<string, Verdict>;
  losesTo: string[];
  tiesWith: string[];
  note?: string;
}
/** Do the checkout's @rivetjs/* node_modules links point into the checkout itself? A worktree without its own
 * node_modules resolves ../../node_modules of the main checkout, i.e. the main checkout's libs: wrong sources. */
const linkedHere = (() => {
  try {
    return realpathSync(resolve(repo, "node_modules/@rivetjs/runtime")).startsWith(realpathSync(repo) + "/");
  } catch {
    return false;
  }
})();
const foreignLibs = (suite: string) =>
  Error(
    `${suite}: ${repo}/node_modules/@rivetjs/* does not resolve inside that checkout (missing node_modules → main checkout libs would be measured). Run \`npm ci --prefer-offline\` there or pass a checkout with its own node_modules.`,
  );
const scenarios: Scenario[] = [];
type Input = Omit<Scenario, "verdict" | "verdicts" | "losesTo" | "tiesWith" | "rivet" | "competitors"> & {
  rivet: Stat | number | null;
  competitors: Record<string, Stored | null | undefined>;
};
/** Record a scenario; `note` set = comparison refused (provenance/browser mismatch) → n/a. */
const add = (input: Input) => {
  const rivet = asStat(input.rivet);
  const theirs = Object.fromEntries(Object.entries(input.competitors).flatMap(([k, v]) => (asStat(v) ? [[k, asStat(v)!]] : []))) as Record<string, Stat>;
  const verdicts: Record<string, Verdict> =
    rivet && !input.note ? Object.fromEntries(Object.entries(theirs).map(([k, v]) => [k, verdict(rivet, v, input.better)])) : {};
  const pick = (want: Verdict) =>
    Object.entries(verdicts)
      .filter(([, v]) => v === want)
      .map(([k]) => k);
  scenarios.push({
    ...input,
    rivet,
    competitors: theirs,
    verdict: rivet && !input.note ? overall(Object.values(verdicts)) : "n/a",
    verdicts,
    losesTo: pick("LOSE"),
    tiesWith: pick("TIE"),
  });
};
const browsers: Record<string, unknown> = {};
const raws: Record<string, string> = {};
const failures: Record<string, string> = {};

async function domSuite() {
  if (!linkedHere) throw foreignLibs("dom");
  const buildArgs = option("dom-build-args", "").split(" ").filter(Boolean);
  await run(node, ["apps/dom-bench/build.ts", ...buildArgs], repo);
  const out = resolve(raw, "dom");
  await withBenchLock("scoreboard dom-bench", () =>
    run(
      node,
      ["apps/dom-bench/run.ts", "--frameworks", "rivet", "--rows", "1000,5000", "--repeats", quick ? "1" : "3", "--samples", quick ? "3" : "5", "--out", out],
      repo,
    ),
  );
  raws.dom = resolve(out, "results.json");
  const built = JSON.parse(await readFile(resolve(repo, "apps/dom-bench/dist/builds.json"), "utf8")) as {
    artifacts: { framework: string; inputs: { path: string }[] }[];
  };
  const escaped = built.artifacts.find((a) => a.framework === "rivet")?.inputs.filter((i) => i.path.startsWith("..")) ?? [];
  if (escaped.length) throw Error(`dom: Rivet bundle inputs outside ${repo}: ${escaped.map((i) => i.path).join(", ")}`);
  const results = JSON.parse(await readFile(raws.dom, "utf8")) as {
    environment: { browser: string; crossOriginIsolated?: boolean };
    methodology?: { protocol?: string };
    trials: {
      rows: number;
      mount: { wallMs: number };
      updates: { percent: number; wallMs: { median: number } }[];
      memory: { mountedDeltaBytes: number };
      size: { nodes: number; comments: number };
    }[];
    manifest: { artifacts: { framework: string; gzip: number }[] };
  };
  const drift = browserDrift(competitors.dom.provenance?.browser, results.environment.browser);
  browsers.dom = {
    measured: results.environment.browser,
    reference: competitors.dom.provenance?.browser ?? null,
    drift,
    crossOriginIsolated: results.environment.crossOriginIsolated ?? false,
    protocol: { measured: results.methodology?.protocol ?? null, reference: competitors.dom.provenance?.protocol ?? null },
  };
  const domNote = drift === "major" ? `browser drift: competitors ${competitors.dom.provenance?.browser}, this run ${results.environment.browser}` : undefined;
  // Mount numbers depend on the run.ts mount protocol (forced GC / re-warm before the timed mount): compare like with like.
  const mountNote =
    domNote ??
    (results.methodology?.protocol !== competitors.dom.provenance?.protocol
      ? `mount protocol mismatch: competitors ${competitors.dom.provenance?.protocol ?? "pre-2026-10-21"}, this run ${results.methodology?.protocol ?? "pre-2026-10-21"}`
      : undefined);
  for (const rows of [1000, 5000]) {
    const trials = results.trials.filter((t) => t.rows === rows);
    const ref = competitors.dom[String(rows)]!;
    const metric = (id: string, unit: string, values: number[]) =>
      add({
        suite: "dom",
        id: `dom ${rows} ${id}`,
        unit,
        better: "lower",
        rivet: stat(values),
        note: id === "mount" ? mountNote : domNote,
        competitors: Object.fromEntries(Object.entries(ref).map(([k, v]) => [k, (v as Record<string, Stored>)[id]])),
      });
    metric(
      "mount",
      "ms",
      trials.map((t) => t.mount.wallMs),
    );
    for (const p of [100, 10, 1])
      metric(
        `update${p}`,
        "ms",
        trials.map((t) => t.updates.find((u) => u.percent === p)!.wallMs.median),
      );
    metric(
      "heap",
      "MiB",
      trials.map((t) => t.memory.mountedDeltaBytes / 1048576),
    );
    const size = trials[0]?.size;
    // Exact count (no noise): equal = TIE.
    if (size)
      add({
        suite: "dom",
        id: `dom ${rows} DOM nodes (comments)`,
        unit: "nodes",
        better: "lower",
        rivet: size.nodes,
        competitors: { "solid-stable": rows * 90 + 1, solid: rows * 90 + 1, react: rows * 90 + 1 },
      });
  }
  const gzip = results.manifest.artifacts.find((a) => a.framework === "rivet")?.gzip ?? null;
  add({ suite: "dom", id: "dom bundle gzip", unit: "B", better: "lower", rivet: gzip, competitors: competitors.dom.gzip });
}

async function krausestSuite() {
  const dist = resolve(raw, "krausest-dist");
  const compileOptions = option("krausest-compile-options", "");
  const branchBuild = resolve(repo, "apps/dom-bench/krausest/build.ts");
  const extra = compileOptions ? ["--compile-options", compileOptions] : [];
  if (existsSync(branchBuild)) await run(node, [branchBuild, "--out", dist, ...extra], repo);
  else await run(node, [resolve(here, "krausest/build.ts"), "--repo", repo, "--out", dist, ...extra], repo);
  const out = resolve(raw, "krausest");
  const iterations = option("krausest-iterations", quick ? "5" : "10");
  // The krausest runner takes the bench lock per benchmark itself.
  await run(
    node,
    [
      resolve(here, "krausest/run.ts"),
      "--dist",
      dist,
      "--out",
      out,
      "--iterations",
      iterations,
      "--mem-iterations",
      quick ? "1" : "3",
      "--startup-iterations",
      quick ? "2" : "5",
    ],
    ownRoot,
  );
  raws.krausest = resolve(out, "results.json");
  const results = JSON.parse(await readFile(raws.krausest, "utf8")) as SuiteResults & { environment?: { chrome?: string } };
  const comparison = compareToPublished(results);
  const reference = publishedChrome(JSON.parse(await readFile(resolve(here, "krausest/published.json"), "utf8")));
  const drift = browserDrift(reference, results.environment?.chrome);
  browsers.krausest = { measured: results.environment?.chrome ?? null, reference: reference ?? null, drift };
  const note = drift === "major" ? `browser drift: published ${reference}, this run ${results.environment?.chrome}` : undefined;
  for (const row of comparison.rows) {
    const published = Object.fromEntries(Object.entries(row.published).map(([fw, p]) => [fw, row.basis === "ratio" ? p.ratio : p.value]));
    const rivet = row.basis === "ratio" ? row.rivetRatio : row.rivet;
    add({
      suite: "krausest",
      id: `krausest ${row.id}`,
      unit: row.basis === "ratio" ? "x vanilla" : row.kind === "size" ? "kB" : "",
      better: "lower",
      basis: row.basis,
      rivet,
      competitors: published,
      note,
    });
  }
  // Overhead above vanilla (absolute script ms / heap MB beyond hand-written DOM; compare.ts `overheads`).
  for (const row of comparison.overheads)
    add({
      suite: "krausest",
      id: `krausest ${row.id} ${row.metric} above vanilla`,
      unit: row.unit,
      better: "lower",
      rivet: row.rivet,
      competitors: row.published,
      note,
    });
  add({
    suite: "krausest",
    id: "krausest CPU weighted geomean",
    unit: "x vanilla",
    better: "lower",
    basis: "ratio",
    rivet: comparison.geomean.rivet,
    competitors: comparison.geomean.published,
    note,
  });
}

async function resumeSuite() {
  if (!linkedHere) throw foreignLibs("resume");
  const results = resolve(repo, "apps/resume-bench/results");
  const before = new Set(existsSync(results) ? readdirSync(results) : []);
  await run(
    node,
    [
      "apps/resume-bench/run.ts",
      "--build",
      "--lanes",
      "rivet",
      "--conditions",
      "slow",
      "--scenarios",
      "click,filter,navigate",
      "--repeats",
      quick ? "3" : "5",
      "--no-traces",
      "--no-coverage",
    ],
    repo,
  );
  const created = readdirSync(results)
    .filter((f) => f.endsWith(".json") && !before.has(f))
    .sort();
  if (!created.length) throw Error("resume-bench wrote no results file");
  raws.resume = resolve(results, created.at(-1)!);
  const result = JSON.parse(await readFile(raws.resume, "utf8")) as { versions: { chrome: string }; table: Record<string, Record<string, Stat>> };
  const reference = competitors.resume.provenance;
  const drift = browserDrift(reference?.chrome, result.versions.chrome);
  browsers.resume = { measured: result.versions.chrome, reference: reference?.chrome ?? null, drift };
  // B7: latency to the paint of the update is primary; stored numbers without that metric are not comparable.
  const metric = reference?.metric ?? "latency";
  const note =
    drift === "major"
      ? `browser drift: competitors ${reference?.chrome}, this run ${result.versions.chrome}`
      : metric !== "paintLatency"
        ? "stored competitors lack paintLatency (re-measure)"
        : undefined;
  for (const scenario of ["click", "filter", "navigate"]) {
    const ref = competitors.resume[`slow/${scenario}`] as Record<string, Stored>;
    add({
      suite: "resume",
      id: `resume slow ${scenario} (to paint)`,
      unit: "ms",
      better: "lower",
      rivet: table(result, scenario, "paintLatency"),
      competitors: ref,
      note,
    });
  }
}

function table(result: { table: Record<string, Record<string, Stat>> }, scenario: string, metric: string): Stat | null {
  return result.table[`slow/${scenario}/rivet`]?.[metric] ?? null;
}

async function ssrSuite() {
  if (!linkedHere) throw foreignLibs("ssr");
  const out = resolve(raw, "ssr");
  const stored = competitors.ssr.provenance;
  if (!stored || !competitors.ssr.metrics)
    throw Error("competitors.json ssr has no provenance/metrics; re-measure competitors (apps/ssr-bench/fair-report.ts --store-competitors)");
  const lanes = ["rivet-compiled", "rivet-resume"];
  await run(
    node,
    [
      "apps/ssr-bench/run-python.ts",
      "apps/ssr-bench/benchmark.py",
      `--frameworks=${lanes.join(",")}`,
      "--rows=100,1000,5000",
      "--concurrency=1",
      `--duration=${stored.duration}`,
      `--warmup=${stored.warmup}`,
      `--repeats=${stored.repeats}`,
      `--gc=${stored.gc}`,
      `--generator=${stored.generator}`,
      "--stop",
      `--out=${out}`,
    ],
    repo,
    { SSR_BENCH_PROJECT: "rivet-ssr-scoreboard", SSR_BENCH_PORT_PREFIX: "197" },
  );
  const latest = JSON.parse(await readFile(resolve(out, "latest.json"), "utf8")) as { run: string };
  raws.ssr = resolve(out, latest.run, "results.json");
  type Case = {
    framework: string;
    rows: number;
    concurrency: number;
    load: { rps: number; p50_ms: number; p99_ms: number; p50_ttfb_ms?: number };
    resources?: { frontend?: { cpu_ms_per_response: number; peak_memory_bytes: number } };
  };
  const data = JSON.parse(await readFile(raws.ssr, "utf8")) as { metadata: { provenance?: SsrProvenance }; cases: Case[] };
  // B1: never rank numbers taken with a different generator, window or GC profile.
  const mine = data.metadata.provenance;
  const keys = ["generator", "generator_sha256", "duration", "warmup", "repeats", "gc"] as const;
  const mismatch = keys.filter((key) => !mine || mine[key] !== stored[key]);
  const note = mismatch.length ? `provenance mismatch (${mismatch.map((k) => `${k}: stored ${stored[k]} vs run ${mine?.[k]}`).join(", ")})` : undefined;
  const classes = competitors.ssr.classes ?? {};
  const metrics: [string, string, "lower" | "higher", (c: Case) => number | undefined][] = [
    ["rps", "req/s", "higher", (c) => c.load.rps],
    ["p50_ms", "ms", "lower", (c) => c.load.p50_ms],
    ["p99_ms", "ms", "lower", (c) => c.load.p99_ms],
    ["cpu_ms", "ms", "lower", (c) => c.resources?.frontend?.cpu_ms_per_response],
    ["peak_mib", "MiB", "lower", (c) => (c.resources?.frontend ? c.resources.frontend.peak_memory_bytes / 1048576 : undefined)],
  ];
  for (const rows of [100, 1000, 5000])
    for (const [lane, peerClass] of [
      ["rivet-compiled", "static"],
      ["rivet-resume", "resumable"],
    ] as const) {
      const cases = data.cases.filter((c) => c.framework === lane && c.rows === rows && c.concurrency === 1);
      const peers = Object.entries(competitors.ssr.metrics![String(rows)] ?? {}).filter(([name]) => classes[name] === peerClass);
      for (const [id, unit, better, pick] of metrics)
        add({
          suite: "ssr",
          id: `ssr c1 ${rows} rows ${lane} ${id}`,
          unit,
          better,
          rivet: stat(cases.map(pick).filter((v): v is number => v != null)),
          competitors: Object.fromEntries(peers.map(([name, values]) => [name, values[id]])),
          note,
        });
    }
}

await mkdir(raw, { recursive: true });
const started = new Date().toISOString();
const steps: Record<string, () => Promise<void>> = { dom: domSuite, krausest: krausestSuite, resume: resumeSuite, ssr: ssrSuite };
for (const suite of suites) {
  if (!steps[suite]) throw Error(`Unknown suite ${suite}; known: ${Object.keys(steps).join(",")}`);
  try {
    await steps[suite]!();
  } catch (error) {
    failures[suite] = String((error as Error).stack ?? error);
    console.error(`[scoreboard] ${suite} failed: ${(error as Error).message}`);
  }
}

const label = (name: string) => competitors.labels[name] ?? name.replace(/-keyed$/, "");
const fmtStat = (v: Stat | null, unit: string) =>
  v == null
    ? "–"
    : v.min != null && v.max != null && v.min !== v.max
      ? `${fmt(v.median, unit)} (${fmt(v.min, unit)}–${fmt(v.max, unit)})`
      : fmt(v.median, unit);
const fmt = (v: number | null, unit: string) =>
  v == null ? "–" : unit === "nodes" || unit === "B" || unit === "req/s" ? Math.round(v).toLocaleString("en-US") : v < 10 ? v.toFixed(2) : v.toFixed(1);
const summary = {
  started,
  finished: new Date().toISOString(),
  label: option("label", ""),
  repo,
  commit: git("rev-parse", "HEAD"),
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  dirty: !!git("status", "--porcelain", "--", "libs", "apps"),
  nodeModulesLinkedHere: linkedHere,
  quick,
  suites,
  options: { domBuildArgs: option("dom-build-args", ""), krausestCompileOptions: option("krausest-compile-options", "") },
  environment: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length, node: process.version },
  krausestReference: REFERENCE_FRAMEWORKS,
  raw: raws,
  failures,
  browsers,
  totals: {
    win: scenarios.filter((s) => s.verdict === "WIN").length,
    tie: scenarios.filter((s) => s.verdict === "TIE").length,
    lose: scenarios.filter((s) => s.verdict === "LOSE").length,
    na: scenarios.filter((s) => s.verdict === "n/a").length,
  },
  scenarios,
};
await writeFile(resolve(outRoot, `${stamp}.json`), JSON.stringify(summary, null, 2) + "\n");

const lines = [
  `# Perf scoreboard`,
  "",
  `- Run: ${summary.started} → ${summary.finished}${summary.quick ? " (quick)" : ""}${summary.label ? ` — ${summary.label}` : ""}`,
  `- Measured: ${summary.branch ?? "?"} @ ${summary.commit?.slice(0, 7) ?? "?"}${summary.dirty ? " (dirty)" : ""} (${relative(ownRoot, repo) || "this checkout"}); Rivet only, competitors from apps/dom-bench/competitors.json and krausest/published.json`,
  `- Totals: ${summary.totals.win} WIN / ${summary.totals.tie} TIE / ${summary.totals.lose} LOSE / ${summary.totals.na} n/a. WIN = Rivet ≥3% better than every listed competitor with non-overlapping trial ranges (where both have ranges); LOSE = the same in reverse vs any; otherwise TIE. Values: median (min–max).`,
  `- Browsers: ${
    Object.entries(browsers)
      .map(([suite, b]) => `${suite} ${JSON.stringify(b)}`)
      .join("; ") || "–"
  }`,
  `- Raw: .artifacts/perf-night/scoreboard/${stamp}.json`,
  ...(Object.keys(failures).length ? [`- Failed suites: ${Object.keys(failures).join(", ")} (see JSON)`] : []),
  "",
  "| scenario | unit | Rivet | competitors | verdict | loses to | ties with |",
  "|---|---|---|---|---|---|---|",
  ...scenarios.map(
    (s) =>
      `| ${s.id} | ${s.unit}${s.better === "higher" ? " ↑" : ""} | ${fmtStat(s.rivet, s.unit)} | ${
        Object.entries(s.competitors)
          .map(([k, v]) => `${label(k)} ${fmtStat(v, s.unit)}`)
          .join(", ") || "–"
      } | ${s.verdict}${s.note ? ` (${s.note})` : ""} | ${s.losesTo.map(label).join(", ")} | ${s.tiesWith.map(label).join(", ")} |`,
  ),
  "",
  "Notes: dom = apps/dom-bench (5k rows = 285k elements, 50k reactive fields; Chromium bundled with Playwright; mount = warm-up cycle, forced GC (heap baseline), one unforced re-warm cycle, one macrotask, timed mount — protocol rewarm-2026-10-21); krausest = ratios to vanillajs (local Rivet/local vanilla vs published framework/vanillajs, Chrome 154), sizes absolute kB; resume = Slow 4G + 4x CPU, input → paint of the update; ssr = c1 closed loop, rivet-compiled vs static peers (Razor, Solid 1 hydratable:false), rivet-resume vs hydratable/resumable peers (Solid, Qwik), same generator/window/GC profile. Methodology: apps/dom-bench/README.md.",
];
const markdown = lines.join("\n") + "\n";
console.log("\n" + markdown);
if (!flag("no-md")) {
  const target = resolve(option("md", resolve(ownRoot, "docs/benchmarks/perf-scoreboard.md")));
  await writeFile(target, markdown);
  console.log(`Wrote ${target}`);
}
console.log(`Scoreboard: ${resolve(outRoot, `${stamp}.json`)}`);
if (Object.keys(failures).length) process.exitCode = 1;
