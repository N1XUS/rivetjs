import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { summarize, type Summary } from "./metrics.ts";

interface Timing {
  wallMs: number;
  taskCpuMs: number;
}
interface Trial {
  framework: string;
  rows: number;
  mount: Timing;
  updates: { percent: number; wallMs: Summary; taskCpuMs: Summary }[];
  memory: { mountedDeltaBytes: number; disposedDeltaBytes: number; cycleGrowthBytes: number };
}
interface Results {
  options: { rows: number[]; repeats: number };
  trials: Trial[];
  manifest: {
    versions: Record<string, string>;
    artifacts: { framework: string; label?: string; version?: string; raw: number; gzip: number; brotli: number }[];
  };
  environment: unknown;
  methodology: unknown;
}

const source = resolve(process.argv[2] ?? ".artifacts/dom-bench/latest/results.json");
const data = JSON.parse(await readFile(source, "utf8")) as Results;
if (data.trials.length !== data.options.rows.length * data.options.repeats * data.manifest.artifacts.length) throw Error("Incomplete run");
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const median = (values: number[]) => summarize(values).median;
const fmt = (n: number) => n.toFixed(2);
const rows: string[] = [];
const cpuRows: string[] = [];
for (const count of data.options.rows)
  for (const artifact of data.manifest.artifacts) {
    const framework = artifact.framework;
    const label = esc(`${artifact.label ?? framework}${artifact.version ? ` ${artifact.version}` : ""}`);
    const trials = data.trials.filter((t) => t.rows === count && t.framework === framework);
    rows.push(
      `<tr><td>${count}</td><td>${label}</td><td>${fmt(median(trials.map((t) => t.mount.wallMs)))}</td>${[1, 10, 100].map((p) => `<td>${fmt(median(trials.map((t) => t.updates.find((u) => u.percent === p)!.wallMs.median)))}</td>`).join("")}<td>${fmt(median(trials.map((t) => t.memory.mountedDeltaBytes)) / 1048576)}</td><td>${fmt(median(trials.map((t) => t.memory.disposedDeltaBytes)) / 1048576)}</td><td>${fmt(median(trials.map((t) => t.memory.cycleGrowthBytes)) / 1048576)}</td></tr>`,
    );
    cpuRows.push(
      `<tr><td>${count}</td><td>${label}</td><td>${fmt(median(trials.map((t) => t.mount.taskCpuMs)))}</td>${[1, 10, 100].map((p) => `<td>${fmt(median(trials.map((t) => t.updates.find((u) => u.percent === p)!.taskCpuMs.median)))}</td>`).join("")}</tr>`,
    );
  }
const html = `<!doctype html><meta charset="utf-8"><title>Large DOM benchmark</title><style>body{font:16px system-ui;max-width:1200px;margin:40px auto;padding:16px;color:#222}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:right}td:nth-child(2){text-align:left}pre{white-space:pre-wrap;font-size:13px}</style><h1>Large DOM benchmark</h1><p>Production builds of every lane listed below. Solid stable and preview are separate baselines, with exact versions in the table and build manifest. Same HTML, ten reactive fields per row, real click handlers, all rows mounted. No Lighthouse claims.</p><p>Values are medians across trials; update cells are medians of each trial's sample median. Milliseconds are synchronous committed DOM wall time, excluding layout and frame settling. MiB is forced-GC JavaScript heap; it does not measure process memory or prove absence of leaks. Small cycle deltas can reflect cache/JIT noise. Three repeats are exploratory, not statistical significance.</p><table><thead><tr><th>Rows</th><th>Framework</th><th>Mount ms</th><th>1% ms</th><th>10% ms</th><th>100% ms</th><th>Mounted Δ MiB</th><th>Disposed Δ MiB</th><th>5-cycle growth MiB</th></tr></thead><tbody>${rows.join("")}</tbody></table><h2>Production bundles (fixture + runtime)</h2><table><tr><th>Framework</th><th>Raw bytes</th><th>Gzip bytes</th><th>Brotli bytes</th></tr>${data.manifest.artifacts.map((a) => `<tr><td>${esc(a.label ?? a.framework)} ${esc(a.version ?? "")}</td><td>${a.raw}</td><td>${a.gzip}</td><td>${a.brotli}</td></tr>`).join("")}</table><p>Detailed CPU, layout/frame, DOM size, individual samples, heap cycles and hashes: <a href="results.json">results.json</a>.</p><h2>Environment</h2><pre>${esc(JSON.stringify(data.environment, null, 2))}</pre><h2>Methodology</h2><pre>${esc(JSON.stringify(data.methodology, null, 2))}</pre>`;
const target = resolve(dirname(source), "report.html");
await writeFile(
  target,
  html
    .replace("Three repeats are exploratory", `${data.options.repeats} repeats are exploratory`)
    .replace(
      "<h2>Production bundles",
      `<h2>Main-thread task CPU (ms)</h2><p>Chromium threadTicks deltas include evaluation and instrumentation bookkeeping; GPU and worker CPU are excluded.</p><table><tr><th>Rows</th><th>Framework</th><th>Mount</th><th>1%</th><th>10%</th><th>100%</th></tr>${cpuRows.join("")}</table><h2>Production bundles`,
    ),
);
console.log(target);
