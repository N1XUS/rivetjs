// island-bench report: results JSON (run.ts) → markdown + json next to it. The Rivet + React islands lane is the
// subject; every metric gets WIN / TIE / LOSE against each other lane (≥ 1.1× either way and above the metric's noise
// floor, else TIE), and every LOSE names what Rivet would need to win it. The Preact pair (rivet-bridge-preact vs
// astro-preact, T8) gets its own section with the same verdict rules. Hand-written findings live in a notes file
// appended verbatim (`--notes`); edit that file and regenerate, never the output.
//
// Usage: node apps/island-bench/report.ts --in results/x.json --out docs/benchmarks/2026-10-12-islands [--notes file.md]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({ options: { in: { type: "string" }, out: { type: "string" }, notes: { type: "string" } } });
if (!args.in || !args.out) throw new Error("usage: report.ts --in <results.json> --out <path without extension> [--notes <md>]");
const input = resolve(args.in);
const results = JSON.parse(readFileSync(input, "utf8")) as {
  stamp: string;
  host: { loaded: boolean; notes: string[]; env?: Record<string, string> };
  versions: Record<string, string>;
  skipped: Record<string, string>;
  build: Record<string, { ms: number; peakRssMb: number; treePeakRssMb?: number }>;
  server: Record<string, Record<string, Record<string, number | number[]>>>;
  browser: Record<string, Record<string, Record<string, number> | number[]>>;
};

const SUBJECT = "rivet-bridge-react";
const ORDER = ["rivet-bridge-react", "astro-react", "next", "rivet-native"];
/** The Preact pair (T8): `rivet-bridge-preact-p10` (same Preact 10 as Astro, headline) + `rivet-bridge-preact` (Preact 11, cross-version) vs `astro-preact`. */
const PAIR = { subject: "rivet-bridge-preact", same: "rivet-bridge-preact-p10", other: "astro-preact" };
type Verdict = "WIN" | "TIE" | "LOSE";

interface Metric {
  key: string;
  label: string;
  unit: string;
  /** Higher is better (requests/s); everything else is lower-is-better. */
  higher?: boolean;
  /** Absolute differences below this are a TIE whatever the ratio. */
  floor: number;
  /** What Rivet would need to turn a LOSE on this metric into a WIN. */
  need: string;
  digits?: number;
}

const SERVER: Metric[] = [
  {
    key: "cpuMsPerPage",
    label: "server CPU / page",
    unit: "ms",
    floor: 0.05,
    digits: 2,
    need: "cheaper island markup on the server: the React adapter renders each island with renderToString + a props script; a shared React render pass per page or cached static islands",
  },
  {
    key: "ttfbP50",
    label: "TTFB p50",
    unit: "ms",
    floor: 0.1,
    digits: 2,
    need: "flush the shell before the islands render (stream the island segments after the first chunk)",
  },
  { key: "completeP50", label: "complete p50", unit: "ms", floor: 0.1, digits: 2, need: "less per-request work (same as CPU / page)" },
  { key: "rps", label: "requests / s", unit: "", higher: true, floor: 5, digits: 0, need: "less per-request work (same as CPU / page)" },
  {
    key: "peakRssMb",
    label: "peak server RSS",
    unit: "MB",
    floor: 8,
    digits: 0,
    need: "smaller server bundle (React DOM server is bundled into the SSR entry) and fewer retained buffers",
  },
  { key: "pageBytes", label: "HTML bytes", unit: "B", floor: 512, digits: 0, need: "shorter island wrappers / props payload in the stream" },
];
const BROWSER: Metric[] = [
  {
    key: "bytesGzipBeforeInput",
    label: "bytes before input (gzip est.)",
    unit: "KB",
    floor: 1024,
    digits: 1,
    need: "an island-only boot path: a page whose interactive parts are all foreign islands still loads the Rivet resume entry + reactivity + DOM runtime (≈ 53 KB raw) next to React; a small island loader (Astro's is ~3 KB) would remove it",
  },
  {
    key: "bytesBeforeInput",
    label: "bytes before input (raw)",
    unit: "KB",
    floor: 1024,
    digits: 1,
    need: "same as the gzip row: island-only boot path without the full resume runtime",
  },
  { key: "jsBytesGzipBeforeInput", label: "JS bytes before input (gzip est.)", unit: "KB", floor: 1024, digits: 1, need: "island-only boot path (see bytes)" },
  {
    key: "jsRequestsBeforeInput",
    label: "JS requests before input",
    unit: "",
    floor: 0.5,
    digits: 0,
    need: 'group the facade + island + adapter modules per policy into one chunk (`resume.chunks: "group"` / ChunkGroup) and modulepreload them from the head',
  },
  {
    key: "scriptMsUntilIdle",
    label: "script CPU until idle (hydration)",
    unit: "ms",
    floor: 2,
    digits: 1,
    need: "less boot work before the islands hydrate (resume runtime evaluation)",
  },
  { key: "cls", label: "CLS", unit: "", floor: 0.01, digits: 3, need: "reserve island boxes (fallback size) so hydration never shifts layout" },
  {
    key: "counterPaint",
    label: "first input → paint, counter (load)",
    unit: "ms",
    floor: 2,
    digits: 1,
    need: "hydrate `load` islands earlier (preload the React client + island module from the head)",
  },
  {
    key: "pickerPaint",
    label: "first input → paint, picker (idle)",
    unit: "ms",
    floor: 2,
    digits: 1,
    need: "prefetch `idle` island code before idle (planner preload), or replay the input after hydration without a fetch on the critical path",
  },
  {
    key: "chartPaint",
    label: "first input → paint, chart (visible)",
    unit: "ms",
    floor: 2,
    digits: 1,
    need: "prefetch `visible` island code when it nears the viewport (rootMargin) so the click never waits for a chunk",
  },
];

const fmt = (value: number | undefined, metric: Metric) => {
  if (value === undefined || Number.isNaN(value)) return "n/a";
  if (metric.unit === "KB") return (value / 1024).toFixed(metric.digits ?? 1);
  if (metric.unit === "B") return Math.round(value).toLocaleString("en-US");
  return value.toFixed(metric.digits ?? 2);
};
const verdict = (subject: number | undefined, other: number | undefined, metric: Metric): { verdict: Verdict; ratio: number } | null => {
  if (subject === undefined || other === undefined) return null;
  if (Math.abs(subject - other) < metric.floor) return { verdict: "TIE", ratio: 1 };
  const better = metric.higher ? subject / other : other / subject;
  const ratio = subject === 0 || other === 0 ? (better > 1 ? Infinity : 0) : better;
  return { verdict: ratio >= 1.1 ? "WIN" : ratio <= 1 / 1.1 ? "LOSE" : "TIE", ratio };
};
// ∞ = one side is 0 (no JS at all): Infinity = the subject is the 0 side (better), 0 = the other lane is.
const ratioText = (ratio: number, subject = SUBJECT) =>
  ratio === Infinity ? `∞ (${subject} 0)` : ratio === 0 ? "∞ (other lane 0)" : ratio >= 1 ? `${ratio.toFixed(2)}×` : `1/${(1 / ratio).toFixed(2)}×`;

interface Row {
  section: string;
  metric: string;
  unit: string;
  values: Record<string, number | undefined>;
  verdicts: Record<string, { verdict: Verdict; ratio: number } | null>;
}
const rows: Row[] = [];
const lanes = ORDER.filter((lane) => results.server?.[lane] || Object.values(results.browser ?? {}).some((c) => (c as Record<string, unknown>)[lane]));
const others = lanes.filter((lane) => lane !== SUBJECT);
const losses: { section: string; metric: Metric; lane: string; ratio: number }[] = [];

const md: string[] = [];
md.push("# Framework islands: Rivet + React vs Astro + React vs Next.js vs Rivet native");
md.push("");
md.push(
  `> Generated by \`apps/island-bench/report.ts\` from \`${relative(resolve(args.out, ".."), input)}\` (${results.stamp}). Do not edit; edit the notes file and regenerate.`,
);
md.push("");
md.push(
  'Same page in every lane: header with a React counter (`client="load"`) + a static React badge (no client JS), a 1000-row server-rendered list, a React picker (`idle`) and a React SVG chart (`visible`, below the fold). Subject = **rivet-bridge-react** (`@rivetjs/bridge-react`); verdicts are its result against each other lane (WIN / LOSE at ≥ 1.1× and above the metric\'s noise floor, else TIE). `rivet-native` (the same page as Rivet components, resumed, no React) is the reference for what the islands cost; `rivet-bridge-react-full` (same build, full resume driver: the pre-T7b islands-only tail) the baseline of the lean client.',
);
md.push("");
const unlocked = results.host.notes.some((note) => note.includes("no bench lock"));
const loadedHost = results.host.loaded || results.host.notes.some((note) => note.includes("loaded host"));
const hostState = loadedHost
  ? "**loaded host** (bench lock maxLoad waived; lanes interleaved A/B, compare ratios rather than absolutes)"
  : unlocked
    ? "**smoke run, no bench lock** (not a result)"
    : "bench lock held";
md.push(`- Host: ${hostState}. ${results.host.notes.join("; ")}.`);
md.push(
  `- Versions: ${Object.entries(results.versions)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")}.`,
);
if (Object.keys(results.skipped ?? {}).length)
  md.push(
    `- Skipped: ${Object.entries(results.skipped)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")}.`,
  );
md.push(
  `- Environment: ${
    results.host.env
      ? Object.entries(results.host.env)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : "**NODE_ENV not recorded (runs before the 2026-10-12 T7 review fix: React SSR may have used its development build)**"
  }.`,
);
md.push(
  "- No lane compresses responses (Astro's standalone node server cannot; Next runs `compress: false`; the Rivet server's gzip is off): server CPU = render + write; browser bytes are as transferred (raw: `encodedDataLength`, response headers included, so per-request header overhead differs by lane) plus a gzip -6 estimate of the response bodies only; the two kinds are not comparable with each other.",
);
md.push("");

/** n per lane under a browser table (runs and their dates / loads: Notes). */
const samplesLine = (condition: string, lanes: string[]) => {
  const n = lanes.map((lane) => [lane, (results.browser[condition]?.[lane] as { samples?: number } | undefined)?.samples] as const).filter(([, v]) => v);
  return `n (${condition === "fast3g" ? "Fast 3G + 4× CPU" : condition}): ${n.map(([lane, v]) => `${lane} ${v}`).join(", ")} fresh-context samples. Run dates and host load per run: Notes.`;
};
const table = (section: string, title: string, metrics: Metric[], get: (lane: string, key: string) => number | undefined) => {
  md.push(`### ${title}`);
  md.push("");
  md.push(`| metric | ${lanes.join(" | ")} | ${others.map((o) => `vs ${o}`).join(" | ")} |`);
  md.push(`| --- | ${lanes.map(() => "---:").join(" | ")} | ${others.map(() => ":---:").join(" | ")} |`);
  for (const metric of metrics) {
    const values = Object.fromEntries(lanes.map((lane) => [lane, get(lane, metric.key)]));
    if (lanes.every((lane) => values[lane] === undefined)) continue;
    const verdicts = Object.fromEntries(others.map((o) => [o, verdict(values[SUBJECT], values[o], metric)]));
    rows.push({ section: `${section} ${title}`, metric: metric.label, unit: metric.unit, values, verdicts });
    for (const o of others) if (verdicts[o]?.verdict === "LOSE") losses.push({ section: title, metric, lane: o, ratio: verdicts[o]!.ratio });
    const unit = metric.unit ? ` (${metric.unit})` : "";
    md.push(
      `| ${metric.label}${unit} | ${lanes.map((lane) => fmt(values[lane], metric)).join(" | ")} | ${others
        .map((o) => (verdicts[o] ? `${verdicts[o]!.verdict} ${verdicts[o]!.verdict === "TIE" ? "" : ratioText(verdicts[o]!.ratio)}`.trim() : "n/a"))
        .join(" | ")} |`,
    );
  }
  md.push("");
};

if (results.build && Object.keys(results.build).length) {
  md.push("## Build");
  md.push("");
  md.push("| lane | build ms | peak RSS, largest process (MB) | peak RSS, process tree (MB) |");
  md.push("| --- | ---: | ---: | ---: |");
  for (const lane of [...ORDER, PAIR.same, PAIR.subject, PAIR.other]) {
    const b = results.build[lane];
    if (b) md.push(`| ${lane} | ${b.ms} | ${b.peakRssMb} | ${b.treePeakRssMb ?? "n/a"} |`);
  }
  md.push("");
}
if (results.server && Object.keys(results.server).length) {
  md.push("## Server (median of interleaved rounds; peak RSS = max over rounds)");
  md.push("");
  for (const c of ["c1", "c10"]) table("server", c, SERVER, (lane, key) => results.server[lane]?.[c]?.[key] as number | undefined);
}
if (results.browser && Object.keys(results.browser).length) {
  md.push("## Browser (median of fresh-context samples)");
  md.push("");
  for (const condition of Object.keys(results.browser)) {
    const title = condition === "fast3g" ? "Fast 3G + 4× CPU" : condition;
    table("browser", title, BROWSER, (lane, key) => (results.browser[condition]?.[lane] as Record<string, number> | undefined)?.[key]);
    md.push(samplesLine(condition, lanes), "");
  }
  md.push(
    'Policies: `next` has no idle / visible hydration (client components hydrate with the page), so its picker / chart rows are islands hydrated on load. Each lane\'s first click is the counter; in the Rivet lanes Rivet handlers take the first-click deferral (spec §3.7, `docs/guides/resumability.md` "First mouse click"), React handlers in the bridge lane do not. One warm-up visit per lane and condition is discarded. `vs rivet-native` paint WINs (e.g. 24.67× on the counter, Fast 3G): rivet-native fetches its handler chunk on the first click (no prefetch on this page) — see Notes, "rivet-native under Fast 3G".',
  );
  md.push("");
}

const tally = (lane: string) => {
  const count = { WIN: 0, TIE: 0, LOSE: 0 };
  for (const row of rows) if (row.verdicts[lane]) count[row.verdicts[lane]!.verdict]++;
  return count;
};
md.push("## Tally (rivet-bridge-react vs …)");
md.push("");
md.push("| lane | WIN | TIE | LOSE |");
md.push("| --- | ---: | ---: | ---: |");
for (const o of others) {
  const t = tally(o);
  md.push(`| ${o} | ${t.WIN} | ${t.TIE} | ${t.LOSE} |`);
}
md.push("");
const hasLane = (lane: string) => Boolean(results.server?.[lane] || Object.values(results.browser ?? {}).some((c) => (c as Record<string, unknown>)[lane]));
const pairLosses: { section: string; metric: Metric; ratio: number; lane: string }[] = [];
if (hasLane(PAIR.other) && (hasLane(PAIR.same) || hasLane(PAIR.subject))) {
  // Headline = the same-version subject (Preact 10 in both lanes) when measured; the Preact 11 lane is cross-version.
  const subjects = [PAIR.same, PAIR.subject].filter(hasLane);
  const tallies = Object.fromEntries(subjects.map((lane) => [lane, { WIN: 0, TIE: 0, LOSE: 0 }]));
  const pairTable = (title: string, metrics: Metric[], get: (lane: string, key: string) => number | undefined) => {
    const columns = [...subjects, PAIR.other];
    const out = [
      `### ${title}`,
      "",
      `| metric | ${columns.join(" | ")} | ${subjects.map((lane) => `${lane} vs ${PAIR.other}`).join(" | ")} |`,
      `| --- | ${columns.map(() => "---:").join(" | ")} | ${subjects.map(() => ":---:").join(" | ")} |`,
    ];
    for (const metric of metrics) {
      const other = get(PAIR.other, metric.key);
      if (other === undefined || subjects.every((lane) => get(lane, metric.key) === undefined)) continue;
      const verdicts = Object.fromEntries(subjects.map((lane) => [lane, verdict(get(lane, metric.key), other, metric)]));
      rows.push({
        section: `preact ${title}`,
        metric: metric.label,
        unit: metric.unit,
        values: Object.fromEntries(columns.map((lane) => [lane, get(lane, metric.key)])),
        verdicts,
      });
      for (const lane of subjects) {
        const v = verdicts[lane];
        if (v) tallies[lane]![v.verdict]++;
        if (v?.verdict === "LOSE") pairLosses.push({ section: title, metric, ratio: v.ratio, lane });
      }
      const unit = metric.unit ? ` (${metric.unit})` : "";
      const text = (lane: string) => {
        const v = verdicts[lane];
        return v ? `${v.verdict} ${v.verdict === "TIE" ? "" : ratioText(v.ratio, lane)}`.trim() : "n/a";
      };
      out.push(`| ${metric.label}${unit} | ${columns.map((lane) => fmt(get(lane, metric.key), metric)).join(" | ")} | ${subjects.map(text).join(" | ")} |`);
    }
    if (out.length > 4) md.push(...out, "");
  };
  md.push(`## Preact pair (vs ${PAIR.other})`);
  md.push("");
  md.push(
    "Same page with the Preact twins of the four components (`components/*.preact.tsx`), vs `astro-preact` (`@astrojs/preact`, Preact 10.29.8: the integration's peer range is `^10`). `rivet-bridge-preact-p10` = `@rivetjs/bridge-preact` built against that same Preact 10.29.8 + preact-render-to-string 6.8.0 (**same-version: the headline**); `rivet-bridge-preact` = the workspace's Preact 11.0.1 (**cross-version**: framework-version differences are mixed into its browser rows). Same verdict rules; these rows are not in the React tally above.",
  );
  md.push("");
  if (results.server && Object.keys(results.server).length)
    for (const c of ["c1", "c10"]) pairTable(`server ${c}`, SERVER, (lane, key) => results.server[lane]?.[c]?.[key] as number | undefined);
  for (const condition of Object.keys(results.browser ?? {}))
    pairTable(
      `browser ${condition === "fast3g" ? "Fast 3G + 4× CPU" : condition}`,
      BROWSER,
      (lane, key) => (results.browser[condition]?.[lane] as Record<string, number> | undefined)?.[key],
    );
  for (const condition of Object.keys(results.browser ?? {})) md.push(samplesLine(condition, [PAIR.same, PAIR.subject, PAIR.other]), "");
  for (const lane of subjects)
    md.push(
      `- Tally ${lane} vs ${PAIR.other}${lane === PAIR.subject ? " (cross-version)" : " (same version)"}: ${tallies[lane]!.WIN} WIN / ${tallies[lane]!.TIE} TIE / ${tallies[lane]!.LOSE} LOSE.`,
    );
  md.push("");
}
const REFERENCE = "rivet-native";
/** Loss hints name React; Preact pair rows get the Preact wording (T8 re-review N2). */
const preactNeed = (need: string) => need.replaceAll("React DOM server", "preact-render-to-string").replaceAll("React", "Preact");
md.push("## Losses and what Rivet would need");
md.push("");
const competitorLosses = losses.filter((loss) => loss.lane !== REFERENCE);
if (!competitorLosses.length && !pairLosses.length) md.push("None against astro-react / next / astro-preact.");
for (const loss of competitorLosses) md.push(`- **${loss.metric.label}** (${loss.section}) vs ${loss.lane}: ${ratioText(loss.ratio)} — ${loss.metric.need}.`);
for (const loss of pairLosses)
  md.push(`- **${loss.metric.label}** (${loss.section}) ${loss.lane} vs ${PAIR.other}: ${ratioText(loss.ratio, loss.lane)} — ${preactNeed(loss.metric.need)}.`);
md.push("");
const islandCost = losses.filter((loss) => loss.lane === REFERENCE);
if (islandCost.length) {
  md.push(`## Island cost (rivet-bridge-react vs ${REFERENCE})`);
  md.push("");
  md.push(
    "What the React islands cost against the same page written as Rivet components (React's runtime, renderer and hydration are the price of reusing React code; not a competitor loss):",
  );
  md.push("");
  for (const loss of islandCost) md.push(`- ${loss.metric.label} (${loss.section}): ${ratioText(loss.ratio)}`);
  md.push("");
}
if (args.notes && existsSync(args.notes)) {
  md.push(readFileSync(args.notes, "utf8").trim());
  md.push("");
}

const out = resolve(args.out);
writeFileSync(out + ".md", md.join("\n"));
writeFileSync(
  out + ".json",
  JSON.stringify(
    {
      generatedBy: "apps/island-bench/report.ts",
      subject: SUBJECT,
      results,
      rows,
      losses: [
        ...losses.map((l) => ({ section: l.section, metric: l.metric.label, lane: l.lane, ratio: l.ratio, need: l.metric.need })),
        ...pairLosses.map((l) => ({
          section: "preact " + l.section,
          metric: l.metric.label,
          lane: l.lane + " vs " + PAIR.other,
          ratio: l.ratio,
          need: preactNeed(l.metric.need),
        })),
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(`[island-bench] report → ${relative(process.cwd(), out)}.{md,json}`);
