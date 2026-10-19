// `scripts/lazy-rows/probe.ts --json` report format (version `PROBE_VERSION`; bump it when a field changes meaning) and
// its checker (`tests/lazy-rows-probe.test.ts`). T6 diffs two reports of this shape.
import type { ForRows } from "../../libs/docs-kit/tools/rows.ts";

export const PROBE_VERSION = 1;

export interface ProbeEnv {
  date: string;
  commit: string;
  node: string;
  chromium: string;
  os: string;
  cpu: string;
  cores: number;
  /** `os.loadavg()` when the probe started. */
  load: number[];
  /** `RIVET_LAZY_ROWS` of the build (`swap`), else null. */
  lazyRows: "swap" | null;
  runs: number;
  warmup: number;
  loads: number;
  cpuRates: number[];
}

export interface ProbeClick {
  /** CDP CPU throttling rate. */
  cpu: number;
  /** Median ms from the first click to the painted response over the loads that responded; null: none did. */
  ms: number | null;
  samples: (number | null)[];
  loads: number;
  /** Clicks over all loads (> loads: some first clicks changed nothing and were repeated). */
  clicks: number;
  /** Row selector clicked (null: no row found). */
  selector: string | null;
}

export interface ProbePage {
  /** App root, repo-relative (`apps/ui-docs`). */
  app: string;
  id: string;
  html: { raw: number; brotli: number };
  state: { raw: number; brotli: number };
  /** Keyed For groups (`tools/rows.ts` `pageRows(html, { saved: true })`). */
  fors: ForRows[];
  /** Per render, medians. */
  server: { cpuMs: number; wallMs: number; runs: number };
  click: ProbeClick[];
}

export interface ProbeReport {
  version: number;
  env: ProbeEnv;
  pages: ProbePage[];
}

type Check = (value: unknown, path: string, errors: string[]) => void;
const is =
  (kind: "string" | "number" | "boolean"): Check =>
  (value, path, errors) => {
    if (typeof value !== kind || (kind === "number" && !Number.isFinite(value as number))) errors.push(`${path}: expected ${kind}`);
  };
const nullable =
  (check: Check): Check =>
  (value, path, errors) => {
    if (value !== null) check(value, path, errors);
  };
const array =
  (check: Check): Check =>
  (value, path, errors) => {
    if (!Array.isArray(value)) return void errors.push(`${path}: expected array`);
    value.forEach((item, i) => check(item, `${path}[${i}]`, errors));
  };
const object =
  (shape: Record<string, Check>, optional: readonly string[] = []): Check =>
  (value, path, errors) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void errors.push(`${path}: expected object`);
    const record = value as Record<string, unknown>;
    for (const [key, check] of Object.entries(shape)) {
      if (!(key in record)) {
        if (!optional.includes(key)) errors.push(`${path}.${key}: missing`);
        continue;
      }
      check(record[key], `${path}.${key}`, errors);
    }
    for (const key of Object.keys(record)) if (!(key in shape)) errors.push(`${path}.${key}: unknown field`);
  };
const oneOf =
  (...values: unknown[]): Check =>
  (value, path, errors) => {
    if (!values.includes(value)) errors.push(`${path}: expected one of ${values.map((v) => JSON.stringify(v)).join(", ")}`);
  };
const num = is("number"),
  str = is("string");
const bytes = object({ raw: num, brotli: num });
const forRows = object(
  {
    symbol: str,
    mode: oneOf("recorded", "lazy"),
    reason: str,
    fors: num,
    rows: num,
    depth: num,
    entries: object({ e: num, b: num, t: num }),
    raw: num,
    brotli: num,
    saved: num,
  },
  ["saved", "reason"],
);
const report = object({
  version: oneOf(PROBE_VERSION),
  env: object({
    date: str,
    commit: str,
    node: str,
    chromium: str,
    os: str,
    cpu: str,
    cores: num,
    load: array(num),
    lazyRows: oneOf("swap", null),
    runs: num,
    warmup: num,
    loads: num,
    cpuRates: array(num),
  }),
  pages: array(
    object({
      app: str,
      id: str,
      html: bytes,
      state: bytes,
      fors: array(forRows),
      server: object({ cpuMs: num, wallMs: num, runs: num }),
      click: array(object({ cpu: num, ms: nullable(num), samples: array(nullable(num)), loads: num, clicks: num, selector: nullable(str) })),
    }),
  ),
});

/** Schema errors of a parsed `--json` report (empty: valid). */
export function checkProbeReport(value: unknown): string[] {
  const errors: string[] = [];
  report(value, "report", errors);
  return errors;
}
