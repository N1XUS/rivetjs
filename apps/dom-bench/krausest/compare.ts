// Ratio methodology: published framework/vanillajs (krausest Chrome table) vs local Rivet/local vanilla.
// Usage as a script: node apps/dom-bench/krausest/compare.ts <results.json>
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Stats {
  n: number;
  median: number;
  mean: number;
  min: number;
  max: number;
  values?: number[];
}
export interface SuiteResults {
  suite: string;
  started: string;
  finished?: string;
  environment: Record<string, unknown> & { chrome: string };
  options: Record<string, unknown>;
  manifest: { repo: string; commit: string | null; dirty: boolean; lanes: Record<string, { uncompressedBytes: number; brotliBytes: number; [key: string]: unknown }> };
  cpu: Record<string, Record<string, { total: Stats; script: Stats; paint: Stats }>>;
  memory: Record<string, Record<string, Stats>>;
  startup: Record<string, Record<string, Stats>>;
  size: Record<string, Record<string, number>>;
  comparison?: Comparison;
}
export interface Row {
  id: string;
  kind: "cpu" | "memory" | "size" | "startup";
  /** "ratio": compare Rivet/vanilla with framework/vanilla; "absolute": machine-independent value. */
  basis: "ratio" | "absolute";
  rivet: number | null;
  vanilla: number | null;
  rivetRatio: number | null;
  published: Record<string, { value: number; ratio: number }>;
  verdicts: Record<string, "WIN" | "LOSE">;
}
/** Implementation overhead above hand-written DOM: script ms (CPU benchmarks) / heap MB (memory benchmarks). */
export interface OverheadRow {
  id: string;
  metric: "script" | "heap";
  unit: "ms" | "MB";
  /** Local Rivet minus local vanilla (medians). */
  rivet: number | null;
  /** Published framework minus published vanillajs; script scaled to this machine by local / published vanilla total. */
  published: Record<string, number>;
  verdicts: Record<string, "WIN" | "LOSE">;
}
export interface Comparison {
  reference: { commit: string; chrome: string; localChrome: string };
  rows: Row[];
  overheads: OverheadRow[];
  geomean: { rivet: number | null; published: Record<string, number> };
  geomeanVerdicts: Record<string, "WIN" | "LOSE">;
}

const here = dirname(fileURLToPath(import.meta.url));
// webdriver-ts-results Common.ts computeGeometricMean CPU weights, in benchmark order 01..09.
const CPU_WEIGHTS = [0.64280248137063, 0.5607178150466176, 0.5643800750716564, 0.1925635870170522, 0.13200612879341714, 0.5277091212292658, 0.5644449600965534, 0.5508359820582848, 0.4225836631419211];
export const REFERENCE_FRAMEWORKS = ["solid-v1.9.3-keyed", "svelte-v5.42.1-keyed", "react-hooks-v19.2.0-keyed", "react-compiler-hooks-v19.0.0-keyed", "react-classes-v19.0.0-keyed"];

interface Published {
  source: { commit: string; chrome: string };
  frameworks: Record<string, { results: Record<string, Record<string, Stats>> }>;
}
export const loadPublished = (): Published => JSON.parse(readFileSync(resolve(here, "published.json"), "utf8")) as Published;

export function compareToPublished(results: SuiteResults, rivetLane = "rivet", vanillaLane = "vanilla"): Comparison {
  const published = loadPublished();
  const pv = (fw: string, id: string, metric?: "script") => {
    const r = published.frameworks[fw]?.results[id];
    return r ? (metric ? r[metric] : (r.total ?? r.DEFAULT))?.median ?? null : null;
  };
  const rows: Row[] = [];
  const add = (id: string, kind: Row["kind"], basis: Row["basis"], rivet: number | null | undefined, vanilla: number | null | undefined, publishedId: string | null) => {
    const rivetRatio = rivet != null && vanilla ? rivet / vanilla : null;
    const row: Row = { id, kind, basis, rivet: rivet ?? null, vanilla: vanilla ?? null, rivetRatio, published: {}, verdicts: {} };
    const pVanilla = publishedId ? pv("vanillajs-keyed", publishedId) : null;
    if (publishedId && pVanilla)
      for (const fw of REFERENCE_FRAMEWORKS) {
        const value = pv(fw, publishedId);
        if (value == null) continue;
        row.published[fw] = { value, ratio: value / pVanilla };
        const mine = basis === "ratio" ? rivetRatio : rivet ?? null;
        const theirs = basis === "ratio" ? value / pVanilla : value;
        if (mine != null) row.verdicts[fw] = mine <= theirs ? "WIN" : "LOSE";
      }
    rows.push(row);
  };
  for (const [id, lanes] of Object.entries(results.cpu))
    add(id, "cpu", "ratio", lanes[rivetLane]?.total.median, lanes[vanillaLane]?.total.median, id.startsWith("local_") ? null : id);
  for (const [id, lanes] of Object.entries(results.memory))
    add(id, "memory", "ratio", lanes[rivetLane]?.median, lanes[vanillaLane]?.median, ["21_ready-memory", "22_run-memory", "25_run-clear-memory"].includes(id) ? id : null);
  for (const id of ["41_size-uncompressed", "42_size-compressed"])
    if (results.size[rivetLane]?.[id] != null) add(id, "size", "absolute", results.size[rivetLane]![id], results.size[vanillaLane]?.[id], id);
  const su = results.startup[rivetLane], sv = results.startup[vanillaLane];
  if (su)
    for (const metric of Object.keys(su))
      add(metric === "firstPaint" ? "43_first-paint" : `startup_${metric}`, "startup", "ratio", su[metric]!.median, sv?.[metric]?.median, metric === "firstPaint" ? "43_first-paint" : null);
  // Overhead above vanilla: absolute script ms / heap MB Rivet spends beyond hand-written DOM. Ratios hide it where
  // paint dominates (krausest totals are mostly layout + paint). Published script ms are scaled to this machine by the
  // benchmark's local / published vanilla total; heap MB are machine-independent.
  const overheads: OverheadRow[] = [];
  const overhead = (id: string, metric: OverheadRow["metric"], rivet: number | null | undefined, vanilla: number | null | undefined, theirs: (fw: string) => number | null) => {
    const row: OverheadRow = { id, metric, unit: metric === "script" ? "ms" : "MB", rivet: rivet != null && vanilla != null ? rivet - vanilla : null, published: {}, verdicts: {} };
    for (const fw of REFERENCE_FRAMEWORKS) {
      const value = theirs(fw);
      if (value == null) continue;
      row.published[fw] = value;
      if (row.rivet != null) row.verdicts[fw] = row.rivet <= value ? "WIN" : "LOSE";
    }
    overheads.push(row);
  };
  for (const [id, lanes] of Object.entries(results.cpu)) {
    if (id.startsWith("local_")) continue;
    const pVanillaScript = pv("vanillajs-keyed", id, "script"),
      pVanillaTotal = pv("vanillajs-keyed", id),
      localVanilla = lanes[vanillaLane]?.total.median;
    const scale = pVanillaTotal && localVanilla ? localVanilla / pVanillaTotal : null;
    overhead(id, "script", lanes[rivetLane]?.script.median, lanes[vanillaLane]?.script.median, (fw) => {
      const script = pv(fw, id, "script");
      return script != null && pVanillaScript != null && scale != null ? (script - pVanillaScript) * scale : null;
    });
  }
  for (const [id, lanes] of Object.entries(results.memory))
    overhead(id, "heap", lanes[rivetLane]?.median, lanes[vanillaLane]?.median, (fw) => {
      const value = pv(fw, id),
        vanilla = pv("vanillajs-keyed", id);
      return value != null && vanilla != null ? value - vanilla : null;
    });
  // Weighted geometric mean of CPU ratios (krausest overall score), only over benchmarks present locally.
  const cpuIds = ["01_run1k", "02_replace1k", "03_update10th1k_x16", "04_select1k", "05_swap1k", "06_remove-one-1k", "07_create10k", "08_create1k-after1k_x2", "09_clear1k_x8"];
  const geo = (ratio: (id: string) => number | null) => {
    let sum = 0, weights = 0;
    cpuIds.forEach((id, i) => {
      const r = ratio(id);
      if (r != null && r > 0) {
        sum += CPU_WEIGHTS[i]! * Math.log(r);
        weights += CPU_WEIGHTS[i]!;
      }
    });
    return weights ? Math.exp(sum / weights) : null;
  };
  const present = (id: string) => rows.find((r) => r.id === id && r.rivetRatio != null);
  const rivetGeo = geo((id) => present(id)?.rivetRatio ?? null);
  const publishedGeo: Record<string, number> = {};
  const geomeanVerdicts: Record<string, "WIN" | "LOSE"> = {};
  for (const fw of REFERENCE_FRAMEWORKS) {
    const g = geo((id) => (present(id) ? present(id)!.published[fw]?.ratio ?? null : null));
    if (g != null) publishedGeo[fw] = g;
    if (g != null && rivetGeo != null) geomeanVerdicts[fw] = rivetGeo <= g ? "WIN" : "LOSE";
  }
  return { reference: { commit: published.source.commit, chrome: published.source.chrome, localChrome: results.environment.chrome }, rows, overheads, geomean: { rivet: rivetGeo, published: publishedGeo }, geomeanVerdicts };
}

const short = (fw: string) => fw.replace(/-keyed$/, "");
export function formatComparison(c: Comparison): string {
  const fws = REFERENCE_FRAMEWORKS;
  const lines = [
    `krausest reference: commit ${c.reference.commit.slice(0, 12)}, Chrome ${c.reference.chrome}; local Chrome ${c.reference.localChrome}`,
    `| benchmark | basis | Rivet | vanilla | Rivet/vanilla | ${fws.map((f) => `${short(f)} (ratio)`).join(" | ")} |`,
    `|---|---|---|---|---|${fws.map(() => "---").join("|")}|`,
  ];
  const n = (v: number | null, d = 2) => (v == null ? "–" : v.toFixed(d));
  for (const r of c.rows)
    lines.push(
      `| ${r.id} | ${r.basis} | ${n(r.rivet)} | ${n(r.vanilla)} | ${n(r.rivetRatio)} | ` +
        fws.map((f) => (r.published[f] ? `${r.verdicts[f] ?? ""} ${r.basis === "ratio" ? n(r.published[f]!.ratio) : n(r.published[f]!.value)}` : "n/a")).join(" | ") + " |",
    );
  lines.push(`| CPU weighted geomean | ratio | | | ${n(c.geomean.rivet)} | ${fws.map((f) => (c.geomean.published[f] != null ? `${c.geomeanVerdicts[f]} ${n(c.geomean.published[f]!)}` : "n/a")).join(" | ")} |`);
  if (c.overheads.length) {
    lines.push("", `| above vanilla | unit | Rivet | ${fws.map(short).join(" | ")} |`, `|---|---|---|${fws.map(() => "---").join("|")}|`);
    for (const o of c.overheads)
      lines.push(
        `| ${o.id} ${o.metric} | ${o.unit} | ${n(o.rivet, o.unit === "MB" ? 3 : 2)} | ` +
          fws.map((f) => (o.published[f] != null ? `${o.verdicts[f] ?? ""} ${n(o.published[f]!, o.unit === "MB" ? 3 : 2)}` : "n/a")).join(" | ") + " |",
      );
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw Error("Usage: compare.ts <results.json>");
  const results = JSON.parse(readFileSync(file, "utf8")) as SuiteResults;
  console.log(formatComparison(compareToPublished(results)));
}
