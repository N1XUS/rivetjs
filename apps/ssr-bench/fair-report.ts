// Like-for-like comparison report over finished benchmark runs (round-2 review B1–B5, B7, RA3).
// Usage: node apps/ssr-bench/fair-report.ts --ssr <results.json|run dir>[,…] [--dom <dom-bench results.json>]
//          [--resume <resume-bench results.json>] [--scoreboard <scoreboard .json>] [--out docs/benchmarks/<name>]
//          [--notes <hand-written.md>] [--title <heading>] [--store-competitors]
// --notes appends a hand-written markdown file (audits, profiles, caveats) verbatim before Inputs.
// Writes <out>.md + <out>.json. Ranking classes: rivet-compiled (static, non-resumable) vs static peers (Razor,
// Solid 1 hydratable:false renderToString); rivet-resume (resumable: handlers, keyed For, Link, nested layout) vs
// hydratable/resumable peers (Solid 1/2 hydratable, Qwik 1/2). Verdicts: apps/dom-bench/verdict.ts (≥3% + non-
// overlapping trial ranges, else TIE). Runs are only grouped when their provenance (generator sha, window, GC
// profile, strings, rate) matches; mixed provenance inside one group is refused.
// Later --ssr inputs supersede earlier ones per (profile, rows, concurrency, lane) group.
// --store-competitors rewrites apps/dom-bench/competitors.json ssr/dom/resume blocks (with provenance) from the inputs.
import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { overall, stat, verdict, type Better, type Stat, type Verdict } from "../dom-bench/verdict.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args[i + 1];
};
const list = (name: string) => (option(name) ?? "").split(",").filter(Boolean);

export const STATIC_PEERS = ["dotnet", "solid-stable-static"];
export const RESUMABLE_PEERS = ["solid-stable-interactive", "solid-stable", "solid", "qwik-stable", "qwik"];
const RIVET: Record<string, string[]> = {
  "rivet-compiled": STATIC_PEERS,
  "rivet-for": STATIC_PEERS,
  "rivet-resume": RESUMABLE_PEERS,
  "rivet-derived": RESUMABLE_PEERS,
  "rivet-router": RESUMABLE_PEERS,
  "rivet-compiled-bun": STATIC_PEERS,
  "rivet-compiled-deno": STATIC_PEERS,
  "rivet-router-bun": RESUMABLE_PEERS,
  "rivet-router-deno": RESUMABLE_PEERS,
};
/** Same bundle on another runtime → its Node lane (compose `*-bun` / `*-deno`). */
export const RUNTIME_PAIRS: Record<string, string> = {
  "rivet-compiled-bun": "rivet-compiled",
  "rivet-compiled-deno": "rivet-compiled",
  "rivet-router-bun": "rivet-router",
  "rivet-router-deno": "rivet-router",
  "solid-stable-static-bun": "solid-stable-static",
};
const PRIMARY = ["rivet-compiled", "rivet-resume"];
const LABEL: Record<string, string> = {
  dotnet: "Razor (.NET 10)",
  "solid-stable-static": "Solid 1.9 static",
  "solid-stable": "Solid 1.9 hydratable",
  "solid-stable-interactive": "Solid 1.9 hydratable (interactive rows + data)",
  solid: "Solid 2 rc hydratable",
  "qwik-stable": "Qwik 1.20",
  qwik: "Qwik 2 rc",
  "rivet-compiled": "Rivet static (.map)",
  "rivet-for": "Rivet static (<For>)",
  "rivet-router": "Rivet router (resumable, no handlers)",
  "rivet-resume": "Rivet resumable app",
  "rivet-derived": "Rivet resumable app (derived model)",
  "rivet-compiled-bun": "Rivet static on Bun 1.4.2",
  "rivet-compiled-deno": "Rivet static on Deno 2.9.7",
  "rivet-router-bun": "Rivet router on Bun 1.4.2",
  "rivet-router-deno": "Rivet router on Deno 2.9.7",
  "solid-stable-static-bun": "Solid 1.9 static on Bun 1.4.2",
};
const label = (lane: string) => LABEL[lane] ?? lane;

interface Case {
  framework: string;
  rows: number;
  concurrency: number;
  repeat?: number;
  error?: string;
  load: {
    rps: number;
    p50_ms: number;
    p99_ms: number;
    p50_ttfb_ms?: number;
    p99_ttfb_ms?: number;
    mean_response_bytes?: number;
    failed: number | null;
    mode?: string;
  };
  resources?: { frontend?: { cpu_ms_per_response: number | null; peak_memory_bytes: number } };
  warning?: string;
}
interface Provenance {
  generator: string;
  generator_sha256: string | null;
  duration: number;
  warmup: number;
  repeats: number;
  gc: string;
  strings?: boolean | number;
  rate?: number;
  prewarm?: number;
  commands?: Record<string, unknown>;
}
interface Run {
  file: string;
  metadata: { run_id: string; utc: string; provenance?: Provenance; versions?: Record<string, { version?: string }>; host?: string; cpus?: number };
  cases: Case[];
}

export const METRICS: { id: string; unit: string; better: Better; pick: (c: Case) => number | null | undefined }[] = [
  { id: "rps", unit: "req/s", better: "higher", pick: (c) => c.load.rps },
  { id: "p50_ms", unit: "ms", better: "lower", pick: (c) => c.load.p50_ms },
  { id: "p99_ms", unit: "ms", better: "lower", pick: (c) => c.load.p99_ms },
  { id: "ttfb_p50_ms", unit: "ms", better: "lower", pick: (c) => c.load.p50_ttfb_ms },
  { id: "cpu_ms", unit: "ms/page", better: "lower", pick: (c) => c.resources?.frontend?.cpu_ms_per_response },
  { id: "peak_mib", unit: "MiB", better: "lower", pick: (c) => (c.resources?.frontend ? c.resources.frontend.peak_memory_bytes / 1048576 : null) },
  { id: "html_kb", unit: "KB", better: "lower", pick: (c) => (c.load.mean_response_bytes != null ? c.load.mean_response_bytes / 1000 : null) },
];
const NAMES: Record<string, string> = {
  rps: "Throughput",
  p50_ms: "Complete latency p50",
  p99_ms: "Complete latency p99",
  ttfb_p50_ms: "TTFB p50",
  cpu_ms: "CPU per page",
  peak_mib: "Peak working set",
  html_kb: "HTML bytes per page",
};

async function loadRun(path: string): Promise<Run> {
  let file = resolve(path);
  if (existsSync(file) && statSync(file).isDirectory()) {
    const latest = resolve(file, "latest.json");
    file = existsSync(latest)
      ? resolve(file, (JSON.parse(await readFile(latest, "utf8")) as { run: string }).run, "results.json")
      : resolve(file, "results.json");
  }
  return { file, ...(JSON.parse(await readFile(file, "utf8")) as Omit<Run, "file">) };
}

const profileKey = (p: Provenance | undefined) => (p ? `${p.gc}${p.strings === 2 ? "+grid" : p.strings ? "+strings" : ""}${p.rate ? `+open${p.rate}` : ""}` : "unknown");
const comparable = (a: Provenance, b: Provenance) =>
  (["generator", "generator_sha256", "duration", "warmup", "gc", "strings", "rate"] as const).every((k) => (a[k] ?? null) === (b[k] ?? null));

type Cell = Record<string, Stat | null>;
/** profile → rows → concurrency → lane → metric → Stat */
type Table = Record<string, Record<number, Record<number, Record<string, Cell>>>>;
interface Comparison {
  profile: string;
  rows: number;
  concurrency: number;
  rivet: string;
  peer: string;
  metric: string;
  verdict: Verdict;
  rivetStat: Stat;
  peerStat: Stat;
  /** > 1 = Rivet better by that factor. */
  advantage: number;
}

export function summarize(runs: Run[]) {
  const profiles: Record<string, Provenance> = {};
  const table: Table = {};
  const failures: string[] = [];
  const grouped = new Map<string, Case[]>();
  for (const run of runs) {
    const provenance = run.metadata.provenance;
    if (!provenance) throw Error(`${run.file}: no metadata.provenance (run predates B1); re-measure`);
    const key = profileKey(provenance);
    if (profiles[key] && !comparable(profiles[key]!, provenance)) throw Error(`${run.file}: provenance differs from an earlier ${key} run; refusing to mix`);
    profiles[key] ??= provenance;
    // A later input run supersedes earlier runs for every (profile, rows, concurrency, lane) group it measured
    // (re-measurement of cases taken under host contention); repeats are never mixed across runs.
    const own = new Set(run.cases.map((c) => [key, c.rows, c.concurrency, c.framework].join("|")));
    for (const id of own) grouped.delete(id);
    for (const c of run.cases) {
      if (c.error || c.load.failed)
        failures.push(`${run.metadata.run_id} ${c.framework} rows=${c.rows} c=${c.concurrency}: ${c.error ?? `${c.load.failed} failed`}`);
      if (c.error || c.load.failed) continue;
      const id = [key, c.rows, c.concurrency, c.framework].join("|");
      grouped.set(id, [...(grouped.get(id) ?? []), c]);
    }
  }
  for (const [id, cases] of grouped) {
    const [key, rows, concurrency, lane] = id.split("|") as [string, string, string, string];
    const cell: Cell = Object.fromEntries(METRICS.map((m) => [m.id, stat(cases.map(m.pick).filter((v): v is number => v != null))]));
    (((table[key] ??= {})[+rows] ??= {})[+concurrency] ??= {})[lane] = cell;
  }
  const comparisons: Comparison[] = [];
  for (const [profile, byRows] of Object.entries(table))
    for (const [rows, byC] of Object.entries(byRows))
      for (const [concurrency, lanes] of Object.entries(byC))
        for (const [rivet, peers] of Object.entries(RIVET)) {
          if (!lanes[rivet]) continue;
          for (const peer of peers) {
            if (!lanes[peer]) continue;
            for (const m of METRICS) {
              const a = lanes[rivet]![m.id],
                b = lanes[peer]![m.id];
              if (!a || !b) continue;
              const advantage = m.better === "lower" ? b.median / a.median : a.median / b.median;
              comparisons.push({
                profile,
                rows: +rows,
                concurrency: +concurrency,
                rivet,
                peer,
                metric: m.id,
                verdict: verdict(a, b, m.better),
                rivetStat: a,
                peerStat: b,
                advantage,
              });
            }
          }
        }
  // Runtime comparisons: the same bundle on Bun/Deno vs Node (Node lane may come from another run of the profile).
  const runtimes: Comparison[] = [];
  for (const [profile, byRows] of Object.entries(table))
    for (const [rows, byC] of Object.entries(byRows))
      for (const [concurrency, lanes] of Object.entries(byC))
        for (const [lane, nodeLane] of Object.entries(RUNTIME_PAIRS)) {
          if (!lanes[lane] || !lanes[nodeLane]) continue;
          for (const m of METRICS) {
            const a = lanes[lane]![m.id],
              b = lanes[nodeLane]![m.id];
            if (!a || !b) continue;
            const advantage = m.better === "lower" ? b.median / a.median : a.median / b.median;
            runtimes.push({
              profile,
              rows: +rows,
              concurrency: +concurrency,
              rivet: lane,
              peer: nodeLane,
              metric: m.id,
              verdict: verdict(a, b, m.better),
              rivetStat: a,
              peerStat: b,
              advantage,
            });
          }
        }
  return { profiles, table, comparisons, runtimes, failures };
}

const n = (v: number | null | undefined, unit = "") =>
  v == null || !Number.isFinite(v)
    ? "–"
    : unit === "req/s"
      ? Math.round(v).toLocaleString("en-US")
      : v >= 100
        ? v.toFixed(0)
        : v >= 10
          ? v.toFixed(1)
          : v.toFixed(2);
const cellText = (s: Stat | null | undefined, unit: string) =>
  s ? (s.min != null && s.max != null && s.n! > 1 ? `${n(s.median, unit)} <sub>${n(s.min, unit)}–${n(s.max, unit)}</sub>` : n(s.median, unit)) : "–";

// Profiling hints per (Rivet lane, metric) for the loss list; evidence pointers, not conclusions.
const HINTS: Record<string, string> = {
  "rivet-resume":
    "Resumable path: libs/runtime/server-resume.ts encodeState/encodeRecords (round-2 RA3: ~37% of a 1,000-row page), per-row handler registration (_rFn / data-events) and keyed For markers; profile with `node --cpu-prof apps/ssr-bench/dist/rivet-router.mjs` under `loadgen` at rows=1000, compare HTML bytes (state script size) vs Qwik container state.",
  "rivet-router":
    "Router lane overhead: libs/router/server/handler.ts + render.ts (match, loaders, head), Request bridge in adapters/node.ts, document shell writes; diff against rivet-compiled with --cpu-prof.",
  "rivet-compiled":
    "Static emitter: libs/runtime/server.ts renderToWriter / template chunking + NodeStreamWriter; compare against the hand emitter lane `rivet` (fixture/emitter.ts) to bound framework overhead.",
  "rivet-for": "Keyed <For> server path: libs/runtime/server-structural.ts (For) vs .map in rivet-compiled.",
};
const METRIC_HINTS: Record<string, string> = {
  peak_mib:
    "Peak memory: Node baseline RSS (~45 MiB) + young generation (8 MiB semi-space in the tuned profile) — check `--max-semi-space-size` trade-off and retained per-request buffers.",
  p99_ms: "Tail latency: GC pauses (compare tuned vs default profile), writer backpressure, event-loop blocking at c≥10.",
  html_kb: "HTML bytes: resume state + markers; see `docs/guides/resumability.md` for what is serialized.",
  ttfb_p50_ms: "TTFB: loaders block the first byte (libs/router/server/handler.ts) — head/shell flush before render.",
};

function markdown(
  data: ReturnType<typeof summarize>,
  extra: { dom?: DomSection; resume?: ResumeSection; scoreboard?: ScoreboardSection; notes?: { file: string; text: string }; inputs: string[] },
) {
  const out: string[] = [];
  const tuned = Object.keys(data.table).find((k) => k === "tuned") ?? Object.keys(data.table)[0]!;
  const p = data.profiles[tuned]!;
  out.push(
    `# ${option("title") ?? "Fair comparison — 2026-10-06"}`,
    "",
    "Generated by `apps/ssr-bench/fair-report.ts` from the runs listed under Inputs. Every number below is a median over ≥3 interleaved repeats with the trial range as subscript (min–max).",
    "",
    "## Methodology",
    "",
    "- **SSR** (`apps/ssr-bench`, Docker): every lane 1 CPU / 512 MiB, same gRPC backend (2 CPU), same DTO, strict validation of every row/field (sampled strictly every 32nd response + length checks). Node load generator `loadgen/` v2 (sha " +
      `\`${p.generator_sha256?.slice(0, 12)}\`), ${p.duration} s measured after ${p.warmup} s warmup per trial, ${p.repeats} repeats with rotating lane order, ${p.prewarm ?? 0} s unrecorded prewarm per lane (JIT tiering). Closed loop c=1/10/100.`,
    `- **GC profiles (B2)**: identical for every Node lane. \`tuned\` = \`${data.profiles.tuned?.commands ? "--single-threaded-gc --max-semi-space-size=8" : "?"}\` (Razor: \`DOTNET_gcConcurrent=0 DOTNET_GCgen0size=0x1000000\`); \`default\` = runtime defaults for everyone. Container commands are recorded per run (results.json metadata.provenance.commands).`,
    "- **Like-for-like classes (B3/RA3)**: *static* — `rivet-compiled` (Rivet compiled JSX, no resume data) vs Razor and Solid 1 compiled `hydratable:false` + `renderToString`; *resumable/hydratable* — `rivet-resume` (`/resume`: file route + nested layout with state, keyed `<For>`, per-row click handler + reactive attribute + `<Link>`, resume state) vs Solid 1/2 (`hydratable:true`, hydration keys) and Qwik 1/2 (container state). Peers render the same page without handlers, so the resumable comparison is conservative for Rivet. `rivet-router` (router + resume render, no handlers) and `rivet-for` are shown for attribution.",
    "- **Verdicts (B4)**: WIN/LOSE only for a ≥3% median gap with non-overlapping trial ranges; else TIE (`apps/dom-bench/verdict.ts`).",
    "- **Escaping (B5)**: `--strings` variant — every field is text, field 3 of each row (10%) is `<b>\"N\"</b> & 'é€漢字𝄞'`; the validator compares exact characters after HTML parsing (any valid escaping accepted, raw markup rejected).",
    "- **HTML bytes**: mean successful response body bytes (chunked framing excluded).",
    "- Machine: " + (data.profiles.tuned ? `${extra.inputs.length} input file(s); host see results.json metadata.` : ""),
    "",
  );
  for (const [profile, byRows] of Object.entries(data.table)) {
    out.push(`## SSR — profile \`${profile}\``, "");
    const rowsList = Object.keys(byRows)
      .map(Number)
      .sort((a, b) => a - b);
    const columns = rowsList.flatMap((rows) =>
      Object.keys(byRows[rows]!)
        .map(Number)
        .sort((a, b) => a - b)
        .map((c) => [rows, c] as const),
    );
    const lanes = [...new Set(columns.flatMap(([r, c]) => Object.keys(byRows[r]![c]!)))].sort((a, b) => order(a) - order(b));
    for (const m of METRICS) {
      if (profile !== "tuned" && !["rps", "cpu_ms", "p99_ms", "peak_mib"].includes(m.id)) continue;
      out.push(`### ${NAMES[m.id]} (${m.unit}${m.better === "higher" ? ", higher is better" : ", lower is better"})`, "");
      out.push(`| lane | ${columns.map(([r, c]) => `${r} rows c${c}`).join(" | ")} |`, `|---|${columns.map(() => "---:").join("|")}|`);
      for (const lane of lanes) out.push(`| ${label(lane)} | ${columns.map(([r, c]) => cellText(byRows[r]![c]![lane]?.[m.id], m.unit)).join(" | ")} |`);
      out.push("");
    }
    out.push(`### Verdicts — profile \`${profile}\``, "", "Counts over all rows × concurrency cases: W/T/L for the Rivet lane against each peer.", "");
    for (const rivet of PRIMARY.concat(["rivet-router", "rivet-for", "rivet-derived"])) {
      const peers = RIVET[rivet]!;
      const mine = data.comparisons.filter((c) => c.profile === profile && c.rivet === rivet);
      if (!mine.length) continue;
      out.push(
        `**${label(rivet)}** vs ${peers.map(label).join(", ")}`,
        "",
        `| metric | ${peers.map(label).join(" | ")} | overall |`,
        `|---|${peers.map(() => "---").join("|")}|---|`,
      );
      for (const m of METRICS) {
        const cells = peers.map((peer) => {
          const v = mine.filter((c) => c.peer === peer && c.metric === m.id).map((c) => c.verdict);
          return v.length ? `W${v.filter((x) => x === "WIN").length} T${v.filter((x) => x === "TIE").length} L${v.filter((x) => x === "LOSE").length}` : "–";
        });
        out.push(`| ${NAMES[m.id]} | ${cells.join(" | ")} | ${overall(mine.filter((c) => c.metric === m.id).map((c) => c.verdict))} |`);
      }
      out.push("");
    }
  }
  if (data.runtimes.length) {
    out.push(
      "## Runtimes — same bundles on Bun / Deno vs Node",
      "",
      "Identical `dist/` bundles and node_modules copied from the Node lane image (bundle sha256 recorded per run). Tuned GC profile: Deno gets the same V8 flags; Bun (JavaScriptCore, no semi-space knob) gets `BUN_JSC_useConcurrentGC=0`. Cells: alternative runtime vs Node, verdict from the alternative runtime's side.",
      "",
    );
    out.push("| lane vs Node | case | " + METRICS.map((m) => NAMES[m.id]).join(" | ") + " |", `|---|---|${METRICS.map(() => "---").join("|")}|`);
    const keys = [...new Set(data.runtimes.map((c) => `${c.profile}|${c.rivet}|${c.rows}|${c.concurrency}`))];
    for (const key of keys) {
      const [profile, lane, rows, c] = key.split("|");
      const cells = METRICS.map((m) => {
        const r = data.runtimes.find((x) => `${x.profile}|${x.rivet}|${x.rows}|${x.concurrency}` === key && x.metric === m.id);
        return r ? `${n(r.rivetStat.median, m.unit)} vs ${n(r.peerStat.median, m.unit)} ${r.verdict}` : "–";
      });
      out.push(`| ${label(lane!)} | ${rows} rows c${c}${profile !== "tuned" ? ` (${profile})` : ""} | ${cells.join(" | ")} |`);
    }
    out.push("");
  }
  if (extra.dom) out.push(...extra.dom.lines);
  if (extra.resume) out.push(...extra.resume.lines);
  if (extra.scoreboard) out.push(...extra.scoreboard.lines);
  // Loss list: primary lanes, tuned profile first, by magnitude.
  const losses = data.comparisons.filter((c) => c.verdict === "LOSE" && PRIMARY.includes(c.rivet)).sort((a, b) => a.advantage - b.advantage);
  out.push(
    "## Rivet's remaining losses (ranked)",
    "",
    "Primary lanes only (rivet-compiled vs static peers, rivet-resume vs resumable peers); worst first. Factor = how much better the peer is.",
    "",
  );
  const groups = new Map<string, Comparison[]>();
  for (const loss of losses) {
    const key = `${loss.rivet}|${loss.metric}`;
    groups.set(key, [...(groups.get(key) ?? []), loss]);
  }
  let rank = 1;
  for (const [key, items] of [...groups].sort((a, b) => a[1][0]!.advantage - b[1][0]!.advantage)) {
    const [rivet, metric] = key.split("|") as [string, string];
    const worst = items[0]!;
    const cases = items.map(
      (c) => `${label(c.peer)} @ ${c.rows} rows c${c.concurrency}${c.profile !== "tuned" ? ` (${c.profile})` : ""} ×${(1 / c.advantage).toFixed(2)}`,
    );
    out.push(
      `${rank++}. **${label(rivet)} — ${NAMES[metric]}**: worst ×${(1 / worst.advantage).toFixed(2)} (${n(worst.rivetStat.median)} vs ${n(worst.peerStat.median)}). Cases: ${cases.slice(0, 8).join("; ")}${cases.length > 8 ? `; +${cases.length - 8} more` : ""}.`,
    );
    out.push(`   - Hint: ${METRIC_HINTS[metric] ?? ""} ${HINTS[rivet] ?? ""}`.trimEnd());
  }
  if (extra.dom?.losses.length) for (const l of extra.dom.losses) out.push(`${rank++}. **DOM — ${l}**`);
  if (extra.resume?.losses.length) for (const l of extra.resume.losses) out.push(`${rank++}. **Resume — ${l}**`);
  if (extra.scoreboard?.losses.length) for (const l of extra.scoreboard.losses) out.push(`${rank++}. **${l}**`);
  if (!losses.length && !extra.dom?.losses.length && !extra.resume?.losses.length) out.push("None.");
  if (extra.notes)
    out.push(
      "",
      `<!-- hand-written notes appended from ${relative(repoRoot, extra.notes.file)} (edit that file, then regenerate) -->`,
      "",
      extra.notes.text.trim(),
    );
  out.push("", "## Inputs", "", ...extra.inputs.map((f) => `- \`${relative(repoRoot, f)}\``));
  if (data.failures.length) out.push("", "## Failed cases (excluded)", "", ...data.failures.map((f) => `- ${f}`));
  return out.join("\n") + "\n";
}
const order = (lane: string) =>
  [
    "rivet-compiled",
    "rivet-for",
    "rivet-router",
    "rivet-resume",
    "rivet-derived",
    "rivet-compiled-bun",
    "rivet-compiled-deno",
    "rivet-router-bun",
    "rivet-router-deno",
    "dotnet",
    "solid-stable-static",
    "solid-stable-static-bun",
    "solid-stable-interactive",
    "solid-stable",
    "solid",
    "qwik-stable",
    "qwik",
  ].indexOf(lane) +
  100 * +!(lane in LABEL);

interface DomSection {
  lines: string[];
  losses: string[];
  json: unknown;
  competitors: Record<string, unknown>;
}
async function domSection(file: string): Promise<DomSection> {
  const data = JSON.parse(await readFile(file, "utf8")) as {
    environment: { browser: string; crossOriginIsolated?: boolean };
    trials: {
      framework: string;
      rows: number;
      mount: { wallMs: number };
      updates: { percent: number; wallMs: { median: number } }[];
      memory: { mountedDeltaBytes: number };
    }[];
  };
  const ids: [string, (t: (typeof data.trials)[number]) => number][] = [
    ["mount", (t) => t.mount.wallMs],
    ["update100", (t) => t.updates.find((u) => u.percent === 100)!.wallMs.median],
    ["update10", (t) => t.updates.find((u) => u.percent === 10)!.wallMs.median],
    ["update1", (t) => t.updates.find((u) => u.percent === 1)!.wallMs.median],
    ["heap", (t) => t.memory.mountedDeltaBytes / 1048576],
  ];
  const frameworks = [...new Set(data.trials.map((t) => t.framework))];
  const rowsList = [...new Set(data.trials.map((t) => t.rows))].sort((a, b) => a - b);
  const lines = [
    "## DOM (apps/dom-bench, local re-measure of every lane)",
    "",
    `Browser ${data.environment.browser} (Playwright Chromium), cross-origin isolated: ${data.environment.crossOriginIsolated ?? "not recorded"}. ms (heap MiB), lower is better; median <sub>min–max</sub> over repeats.`,
    "",
  ];
  const losses: string[] = [];
  const competitors: Record<string, unknown> = {
    provenance: {
      browser: data.environment.browser,
      crossOriginIsolated: data.environment.crossOriginIsolated ?? false,
      measured: new Date().toISOString().slice(0, 10),
      source: relative(repoRoot, file),
    },
  };
  const json: Record<string, unknown> = {};
  for (const rows of rowsList) {
    lines.push(`### ${rows} rows`, "", `| metric | ${frameworks.join(" | ")} | Rivet verdict |`, `|---|${frameworks.map(() => "---:").join("|")}|---|`);
    for (const [id, pick] of ids) {
      const stats = Object.fromEntries(frameworks.map((f) => [f, stat(data.trials.filter((t) => t.framework === f && t.rows === rows).map(pick))]));
      const mine = stats.rivet;
      const verdicts = Object.fromEntries(frameworks.filter((f) => f !== "rivet" && stats[f] && mine).map((f) => [f, verdict(mine!, stats[f]!, "lower")]));
      for (const [f, v] of Object.entries(verdicts))
        if (v === "LOSE")
          losses.push(`${rows} rows ${id}: Rivet ${n(mine!.median)} vs ${f} ${n(stats[f]!.median)} (×${(mine!.median / stats[f]!.median).toFixed(2)})`);
      lines.push(
        `| ${id} | ${frameworks.map((f) => cellText(stats[f], "")).join(" | ")} | ${overall(Object.values(verdicts))} ${Object.entries(verdicts)
          .map(([f, v]) => `${f}:${v[0]}`)
          .join(" ")} |`,
      );
      (json[rows] as Record<string, unknown> | undefined) ?? (json[rows] = {});
      (json[rows] as Record<string, unknown>)[id] = { stats, verdicts };
      for (const f of frameworks)
        if (f !== "rivet" && stats[f]) (((competitors[rows] ??= {}) as Record<string, Record<string, Stat>>)[f] ??= {})[id] = stats[f]!;
    }
    lines.push("");
  }
  return { lines, losses, json, competitors };
}

interface ResumeSection {
  lines: string[];
  losses: string[];
  json: unknown;
  competitors: Record<string, unknown>;
}
async function resumeSection(file: string): Promise<ResumeSection> {
  const data = JSON.parse(await readFile(file, "utf8")) as { versions: Record<string, string>; lanes: string[]; table: Record<string, Record<string, Stat>> };
  const lines = [
    "## Resume (apps/resume-bench, Slow 4G + 4x CPU)",
    "",
    `Chrome ${data.versions.chrome}. Primary metric (B7): input → paint of the update (\`paintLatency\`: rAF + next task after the DOM change); \`latency\` = first DOM mutation. ms, lower is better.`,
    "",
  ];
  const losses: string[] = [];
  const competitors: Record<string, unknown> = {
    note: "resume-bench slow condition (Slow 4G + 4x CPU), ms, lower is better; paintLatency = input → paint of the update.",
    provenance: { chrome: data.versions.chrome, metric: "paintLatency", source: relative(repoRoot, file) },
  };
  const scenarios = [...new Set(Object.keys(data.table).map((k) => k.split("/").slice(0, 2).join("/")))];
  for (const scenario of scenarios) {
    const lanes = data.lanes.filter((l) => data.table[`${scenario}/${l}`]);
    lines.push(`### ${scenario}`, "", `| metric | ${lanes.join(" | ")} | Rivet verdict |`, `|---|${lanes.map(() => "---:").join("|")}|---|`);
    for (const metric of ["paintLatency", "latency", "jsBytesBeforeInteraction", "tbtBeforeInteraction", "documentBytes"]) {
      const stats = Object.fromEntries(lanes.map((l) => [l, (data.table[`${scenario}/${l}`]![metric] as Stat | undefined) ?? null]));
      if (!Object.values(stats).some(Boolean)) continue;
      const mine = stats.rivet;
      const verdicts = Object.fromEntries(lanes.filter((l) => l !== "rivet" && stats[l] && mine).map((l) => [l, verdict(mine!, stats[l]!, "lower")]));
      if (metric === "paintLatency")
        for (const [l, v] of Object.entries(verdicts))
          if (v === "LOSE")
            losses.push(
              `${scenario} to paint: Rivet ${n(mine!.median)} ms vs ${l} ${n(stats[l]!.median)} ms (×${(mine!.median / stats[l]!.median).toFixed(2)}) — hint: resume-bench traces (results/traces), first-input chunk fetch + handler resume (libs/runtime/dom-resume.ts).`,
            );
      lines.push(`| ${metric} | ${lanes.map((l) => cellText(stats[l], "")).join(" | ")} | ${overall(Object.values(verdicts))} |`);
      if (metric === "paintLatency") competitors[scenario] = Object.fromEntries(lanes.filter((l) => l !== "rivet" && stats[l]).map((l) => [l, stats[l]]));
    }
    lines.push("");
  }
  return { lines, losses, json: data.table, competitors };
}

interface ScoreboardSection {
  lines: string[];
  losses: string[];
}
async function scoreboardSection(file: string): Promise<ScoreboardSection> {
  const data = JSON.parse(await readFile(file, "utf8")) as {
    totals: Record<string, number>;
    browsers?: unknown;
    scenarios: { suite: string; id: string; unit: string; verdict: string; losesTo: string[]; note?: string; rivet: Stat | null }[];
  };
  const pick = data.scenarios.filter((s) => s.suite === "krausest");
  const lines = [
    "## krausest (scoreboard, ratio to local vanilla vs published)",
    "",
    `Totals of the scoreboard run: ${JSON.stringify(data.totals)}; browsers ${JSON.stringify(data.browsers ?? {})}.`,
    "",
    "| benchmark | Rivet | verdict | loses to |",
    "|---|---:|---|---|",
  ];
  for (const s of pick) lines.push(`| ${s.id} | ${n(s.rivet?.median)} ${s.unit} | ${s.verdict}${s.note ? ` (${s.note})` : ""} | ${s.losesTo.join(", ")} |`);
  lines.push("");
  return { lines, losses: pick.filter((s) => s.verdict === "LOSE").map((s) => `${s.id} vs ${s.losesTo.join(", ")}`) };
}

if (import.meta.main) {
  const inputs = list("ssr");
  if (!inputs.length) throw Error("--ssr <results.json|run dir>[,…] required");
  const runs = await Promise.all(inputs.map(loadRun));
  const data = summarize(runs);
  const dom = option("dom") ? await domSection(resolve(option("dom")!)) : undefined;
  const resume = option("resume") ? await resumeSection(resolve(option("resume")!)) : undefined;
  const scoreboard = option("scoreboard") ? await scoreboardSection(resolve(option("scoreboard")!)) : undefined;
  const files = [...runs.map((r) => r.file), ...["dom", "resume", "scoreboard"].flatMap((k) => (option(k) ? [resolve(option(k)!)] : []))];
  const out = resolve(option("out") ?? resolve(repoRoot, "docs/benchmarks/2026-10-06-fair-comparison"));
  const notes = option("notes") ? { file: resolve(option("notes")!), text: await readFile(resolve(option("notes")!), "utf8") } : undefined;
  await writeFile(out + ".md", markdown(data, { dom, resume, scoreboard, notes, inputs: files }));
  await writeFile(
    out + ".json",
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        inputs: files.map((f) => relative(repoRoot, f)),
        profiles: data.profiles,
        ssr: data.table,
        comparisons: data.comparisons,
        runtimes: data.runtimes,
        failures: data.failures,
        dom: dom?.json,
        resume: resume?.json,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(
    `Wrote ${relative(repoRoot, out)}.md / .json (${data.comparisons.length} comparisons, ${data.comparisons.filter((c) => c.verdict === "LOSE").length} LOSE)`,
  );
  if (args.includes("--store-competitors")) {
    const path = resolve(repoRoot, "apps/dom-bench/competitors.json");
    const competitors = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const provenance = data.profiles.tuned;
    if (!provenance) throw Error("--store-competitors needs a tuned-profile SSR run");
    const metrics: Record<string, Record<string, Record<string, Stat>>> = {};
    for (const [rows, byC] of Object.entries(data.table.tuned ?? {}))
      for (const [lane, cell] of Object.entries(byC[1] ?? {}))
        if (!lane.startsWith("rivet"))
          (metrics[rows] ??= {})[lane] = Object.fromEntries(
            Object.entries({ rps: cell.rps, p50_ms: cell.p50_ms, p99_ms: cell.p99_ms, cpu_ms: cell.cpu_ms, peak_mib: cell.peak_mib }).filter(([, v]) => v),
          ) as Record<string, Stat>;
    const { commands: _commands, ...stored } = provenance;
    competitors.ssr = {
      note: "ssr-bench 1 CPU / 512 MiB, gRPC data, closed loop c1; Stat = median/min/max/n over repeats. Re-measure with apps/ssr-bench/fair-report.ts --store-competitors; scoreboard.ts refuses runs whose provenance differs.",
      provenance: { ...stored, measured: new Date().toISOString().slice(0, 10), runs: runs.map((r) => r.metadata.run_id) },
      classes: Object.fromEntries([...STATIC_PEERS.map((l) => [l, "static"]), ...RESUMABLE_PEERS.map((l) => [l, "resumable"])]),
      metrics,
    };
    if (dom) competitors.dom = { ...dom.competitors, gzip: (competitors.dom as { gzip?: unknown } | undefined)?.gzip };
    if (resume) competitors.resume = resume.competitors;
    competitors.note =
      `Competitor numbers with provenance. ssr${dom ? "/dom" : ""}${resume ? "/resume" : ""} re-measured by ${relative(repoRoot, out)}.md via apps/ssr-bench/fair-report.ts --store-competitors (other blocks: their own provenance); dom gzip = fixture+runtime bundle bytes (unchanged).`;
    await writeFile(path, JSON.stringify(competitors, null, 2) + "\n");
    console.log(`Updated ${relative(repoRoot, path)}`);
  }
}
