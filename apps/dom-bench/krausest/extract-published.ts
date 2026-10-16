// Extract published js-framework-benchmark (krausest) Chrome results for the reference frameworks.
// Usage: node apps/dom-bench/krausest/extract-published.ts <path-to-webdriver-ts-results/src/results.ts> <commit-sha> <chrome-version>
// The input is the results.ts data module of github.com/krausest/js-framework-benchmark at <commit-sha>
// (the data behind krausest.github.io/js-framework-benchmark/current.html). Output: published.json next to this file.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [source, commit, chrome] = process.argv.slice(2);
if (!source || !commit || !chrome) throw Error("Usage: extract-published.ts <results.ts> <commit> <chrome-version>");
const text = await readFile(source, "utf8");
/** results.ts is three JS array literals (trailing commas allowed); parse them as JSON. */
const literal = (name: string): unknown => {
  const start = text.indexOf(`export const ${name}`);
  if (start < 0) throw Error(`Missing export ${name}`);
  const open = text.indexOf("[", text.indexOf("=", start));
  const end = text.indexOf("\nexport const", open);
  const body = text.slice(open, end < 0 ? undefined : end).trim().replace(/;$/, "");
  return JSON.parse(body.replace(/,\s*([\]}])/g, "$1"));
};
interface Framework { name: string; keyed: boolean; issues?: number[] }
interface Benchmark { id: string; label: string; description: string; type: number }
interface Raw { f: number; b: { b: number; v: Record<string, number[]> }[] }
const frameworks = literal("frameworks") as Framework[];
const benchmarks = literal("benchmarks") as Benchmark[];
const results = literal("results") as Raw[];
const wanted = [
  "vanillajs-keyed",
  "solid-v",
  "svelte-v",
  "svelte-classic-v",
  "react-hooks-v",
  "react-compiler-hooks-v",
  "react-classes-v",
];
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    median: (sorted[Math.floor((n - 1) / 2)]! + sorted[Math.floor(n / 2)]!) / 2,
    mean,
    min: sorted[0]!,
    max: sorted[n - 1]!,
  };
};
const out: Record<string, unknown> = {};
for (const prefix of wanted) {
  const index = frameworks.findIndex((f) => f.keyed && (prefix.endsWith("-v") ? f.name.startsWith(prefix) && /-keyed$/.test(f.name) : f.name === prefix));
  if (index < 0) throw Error(`Framework ${prefix} not in results`);
  const framework = frameworks[index]!;
  const raw = results.find((r) => r.f === index);
  if (!raw) throw Error(`No results for ${framework.name}`);
  const values: Record<string, unknown> = {};
  for (const entry of raw.b) {
    const benchmark = benchmarks[entry.b]!;
    values[benchmark.id] = Object.fromEntries(Object.entries(entry.v).map(([key, list]) => [key, stats(list)]));
  }
  out[framework.name] = { issues: framework.issues ?? [], results: values };
}
const root = dirname(fileURLToPath(import.meta.url));
await writeFile(
  resolve(root, "published.json"),
  JSON.stringify(
    {
      source: {
        repository: "https://github.com/krausest/js-framework-benchmark",
        commit,
        file: "webdriver-ts-results/src/results.ts",
        sha256: createHash("sha256").update(text).digest("hex"),
        page: "https://krausest.github.io/js-framework-benchmark/current.html",
        chrome,
        extractedAt: new Date().toISOString(),
        displayDefault: "median of total (results page default: DisplayMode.DISPLAY_MEDIAN, CpuDurationMode.TOTAL)",
        units: { cpu: "ms", memory: "MB (measureUserAgentSpecificMemory bytes / 1024 / 1024)", size: "kB", firstPaint: "ms" },
      },
      benchmarks,
      frameworks: out,
    },
    null,
    2,
  ) + "\n",
);
console.log(Object.keys(out).join("\n"));
