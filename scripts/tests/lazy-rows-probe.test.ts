// scripts/lazy-rows/probe.ts `--json` report: the schema T6 diffs (`schema.ts` `checkProbeReport`) and the text table.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { formatReport } from "../lazy-rows/probe.ts";
import { checkProbeReport, PROBE_VERSION, type ProbeReport } from "../lazy-rows/schema.ts";

const report: ProbeReport = {
  version: PROBE_VERSION,
  env: {
    date: "2026-10-19T14:23:55.669Z",
    commit: "f045f405",
    node: "v26.5.1",
    chromium: "153.0.8010.12",
    os: "darwin 25.6.0",
    cpu: "Apple M4 Pro",
    cores: 14,
    load: [4.15, 5.79, 8.24],
    lazyRows: null,
    runs: 20,
    warmup: 5,
    loads: 5,
    cpuRates: [1, 4],
  },
  pages: [
    {
      app: "apps/ui-docs",
      id: "table-virtualization",
      html: { raw: 73406, brotli: 11698 },
      state: { raw: 42020, brotli: 6348 },
      fors: [
        {
          symbol: "@rivetjs/cdk/table/index.tsx#TableBody$ux2",
          mode: "recorded",
          fors: 1,
          rows: 10,
          depth: 1,
          entries: { e: 10, b: 40, t: 126 },
          raw: 5473,
          brotli: 920,
          saved: 773,
        },
      ],
      server: { cpuMs: 25.483, wallMs: 13.968, runs: 20 },
      click: [{ cpu: 1, ms: 20.6, samples: [13.1, 22.8, 19.7, 20.6, 22.2], loads: 5, clicks: 5, selector: "[role=row][data-key]" }],
    },
    {
      app: "apps/cdk-docs",
      id: "virtualizer-items",
      html: { raw: 19456, brotli: 5017 },
      state: { raw: 7270, brotli: 1331 },
      fors: [],
      server: { cpuMs: 2.772, wallMs: 2.158, runs: 20 },
      click: [{ cpu: 4, ms: null, samples: [null, null], loads: 2, clicks: 6, selector: null }],
    },
  ],
};

test("a probe report passes its schema; every kind of drift is named", () => {
  assert.deepEqual(checkProbeReport(JSON.parse(JSON.stringify(report))), []);
  const bad = JSON.parse(JSON.stringify(report));
  bad.version = 0;
  delete bad.env.chromium;
  bad.env.lazyRows = "on";
  bad.pages[0].fors[0].mode = "maybe";
  bad.pages[0].server.cpuMs = "25";
  bad.pages[0].extra = 1;
  bad.pages[1].click[0].samples = [null, "x"];
  assert.deepEqual(checkProbeReport(bad), [
    "report.version: expected one of 1",
    "report.env.chromium: missing",
    'report.env.lazyRows: expected one of "swap", null',
    'report.pages[0].fors[0].mode: expected one of "recorded", "lazy"',
    "report.pages[0].server.cpuMs: expected number",
    "report.pages[0].extra: unknown field",
    "report.pages[1].click[0].samples[1]: expected number",
  ]);
  assert.deepEqual(checkProbeReport([]), ["report: expected object"]);
});

test("the text table names the environment and one row per page", () => {
  const text = formatReport(report);
  assert.match(text, /^lazy-rows probe v1 2026-10-19T14:23:55\.669Z commit f045f405\n/);
  assert.match(text, /node v26\.5\.1, chromium 153\.0\.8010\.12, darwin 25\.6\.0, Apple M4 Pro ×14, load 4\.15 5\.79 8\.24; server: 5 warm-up \+ median of 20/);
  assert.match(
    text,
    /\| ui-docs:table-virtualization \| 71\.7 KB \/ 11\.4 KB \| 41\.0 KB \/ 6\.2 KB \| 25\.483 \/ 13\.968 ms \| ×1: 20\.6 ms \| \+recorded index\.tsx#TableBody\$ux2 ×10: 5\.3 KB \/ 920 B br \(saved 773 B br\) \|/,
  );
  assert.match(text, /\| cdk-docs:virtualizer-items \| .* \| ×4: – \(6 clicks \/ 2 loads\) \| - \|/);
});
