// Benchmark chart data (content/_charts.ts): every number traces back to a committed report, and every win / tie / loss
// the benchmarks page and the homepage state is the verdict of that report's data (apps/dom-bench/verdict.ts:
// ≥ 3% median gap and non-overlapping trial ranges, else a tie).
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { charts, homeBench, homeStrip } from "../content/_charts.ts";
import { verdict, type Stat } from "../../dom-bench/verdict.ts";
import fair from "../../../docs/benchmarks/2026-10-23-ssr-comparison.json" with { type: "json" };
import resumeRun from "../../../docs/benchmarks/2026-10-19-fair-comparison.json" with { type: "json" };
import krausest from "../../../docs/benchmarks/2026-10-23-krausest.json" with { type: "json" };
import domRun from "../../../docs/benchmarks/2026-10-21-dom-mount-2.json" with { type: "json" };
import competitors from "../../dom-bench/competitors.json" with { type: "json" };
import reactRun from "../../../docs/benchmarks/2026-10-27-ssr-comparison-react.json" with { type: "json" };

const repo = fileURLToPath(new URL("../../../", import.meta.url));

const point = (id: string, group: number, label: string) => {
  const found = charts[id]!.groups[group]!.points.find((p) => p.label === label);
  assert.ok(found, `${id}: ${label}`);
  return found;
};
// Report verdicts for the SSR pairs (fair.comparisons, written by fair-report.ts).
const ssrVerdict = (rows: number, concurrency: number, rivet: string, peer: string, metric = "cpu_ms", profile = "tuned") =>
  fair.comparisons.find((c) => c.profile === profile && c.rows === rows && c.concurrency === concurrency && c.metric === metric && c.rivet === rivet && c.peer === peer)
    ?.verdict;
const resume = resumeRun.resume as unknown as Record<string, Record<string, Stat>>;
const resumeVerdict = (scenario: string, metric: string, peer: string) =>
  verdict(resume[`slow/${scenario}/rivet`]![metric]!, resume[`slow/${scenario}/${peer}`]![metric]!, "lower");
const dom = domRun.runTs.baseline;
const domVerdict = (rows: "1000" | "5000", metric: "mount" | "update1" | "update100", peer: "solid-stable" | "solid" | "react") =>
  verdict(dom[rows].rivet[metric], dom[rows][peer][metric], "lower");

test("every chart: id matches key, caption complete, source report exists, Rivet lane marked", () => {
  for (const [key, chart] of Object.entries(charts)) {
    assert.equal(chart.id, key);
    for (const field of ["machine", "date", "method"] as const) assert.ok(chart.caption[field], `${key} caption.${field}`);
    const path = chart.caption.source.href.replace("https://github.com/N1XUS/rivetjs/blob/main/", "");
    assert.ok(existsSync(repo + path), `${key}: ${path} exists`);
    assert.ok(
      chart.groups.some((group) => group.points.some((p) => p.rivet)),
      `${key}: has a Rivet point`,
    );
    for (const group of chart.groups) {
      for (const p of group.points) {
        assert.ok(Number.isFinite(p.value) && p.value > 0, `${key} ${p.label} value`);
        if (p.min !== undefined || p.max !== undefined) assert.ok(p.min! <= p.value && p.value <= p.max!, `${key} ${p.label} min ≤ median ≤ max`);
        assert.equal(Boolean(p.rivet), p.label.startsWith("Rivet"), `${key} ${p.label}: rivet flag only on Rivet lanes`);
      }
    }
  }
});

test("SSR charts equal the 2026-10-23 report; competitors.json stores the same numbers; page claims match its verdicts", () => {
  const ssr = fair.ssr.tuned["1000"]["1"];
  assert.equal(point("ssr-static-cpu", 0, "Rivet static").value, ssr["rivet-compiled"].cpu_ms.median);
  assert.equal(point("ssr-static-cpu", 0, "Razor (.NET 10)").max, ssr["dotnet"].cpu_ms.max);
  assert.equal(point("ssr-static-cpu", 0, "Solid 1.9 static").value, ssr["solid-stable-static"].cpu_ms.median);
  assert.equal(point("ssr-static-headline", 0, "Razor (.NET 10)").value, ssr["dotnet"].cpu_ms.median);
  assert.equal(charts["ssr-static-cpu"]!.caption.date, "2026-10-23");
  assert.ok(charts["ssr-static-cpu"]!.caption.source.href.endsWith("2026-10-23-ssr-comparison.md"));
  // Static pages: less CPU than Razor and Solid in every measured integer-page case.
  for (const [rows, c] of [
    [1000, 1],
    [1000, 10],
    [5000, 1],
    [100, 10],
    [100, 1],
  ] as const)
    for (const peer of ["dotnet", "solid-stable-static"]) assert.equal(ssrVerdict(rows, c, "rivet-compiled", peer), "WIN", `static ${rows} c${c} vs ${peer}`);
  // Text grid (concurrency 1 only in this run): the 2026-10-09 loss to Razor is closed — CPU, throughput and p50 win.
  const grid = fair.ssr["tuned+grid"]["1000"];
  assert.deepEqual(Object.keys(grid), ["1"], "the grid ran at concurrency 1 only (the page says so)");
  assert.deepEqual(
    charts["ssr-grid-cpu"]!.groups.map((g) => g.label),
    ["Concurrency 1"],
  );
  assert.equal(point("ssr-grid-cpu", 0, "Rivet static").value, grid["1"]["rivet-compiled"].cpu_ms.median);
  assert.equal(point("ssr-grid-cpu", 0, "Razor (.NET 10)").value, grid["1"]["dotnet"].cpu_ms.median);
  for (const metric of ["cpu_ms", "rps", "p50_ms"]) assert.equal(ssrVerdict(1000, 1, "rivet-compiled", "dotnet", metric, "tuned+grid"), "WIN", `grid ${metric}`);
  // Interactive pages beat the like-for-like peers; plain Solid 1.9 is level at 1,000 rows c1.
  for (const [id, rows] of [
    ["ssr-resumable-cpu-1000", "1000"],
    ["ssr-resumable-cpu-5000", "5000"],
  ] as const) {
    const lanes = fair.ssr.tuned[rows]["1"];
    assert.equal(point(id, 0, "Rivet resumable").value, lanes["rivet-resume"].cpu_ms.median);
    assert.equal(point(id, 0, "Solid 1.9 interactive").value, lanes["solid-stable-interactive"].cpu_ms.median);
    assert.equal(point(id, 1, "Solid 2 hydratable").value, lanes["solid"].cpu_ms.median);
    assert.equal(point(id, 1, "Solid 1 hydratable").value, lanes["solid-stable"].cpu_ms.median);
    assert.equal(point(id, 0, "Solid 1.9 interactive").value, competitors.ssr.metrics[rows]["solid-stable-interactive"].cpu_ms.median);
    for (const peer of ["solid-stable-interactive", "solid", "qwik-stable", "qwik"]) assert.equal(ssrVerdict(Number(rows), 1, "rivet-resume", peer), "WIN", `${id} vs ${peer}`);
    assert.equal(ssrVerdict(Number(rows), 1, "rivet-resume", "solid-stable"), rows === "1000" ? "TIE" : "WIN");
  }
  assert.equal(ssrVerdict(1000, 10, "rivet-resume", "solid-stable"), "WIN", "1,000 rows c10: ahead of plain Solid 1.9");
  assert.equal(competitors.ssr.metrics["1000"]["dotnet"].cpu_ms.median, ssr["dotnet"].cpu_ms.median);
  // Plain Solid 1.9 needs less CPU for 100 rows c10 and the text grid; the router lane ties in the small-page case.
  const small = fair.ssr.tuned["100"]["10"];
  assert.equal(point("ssr-resumable-cpu-100-c10", 0, "Rivet resumable").value, small["rivet-resume"].cpu_ms.median);
  assert.equal(point("ssr-resumable-cpu-100-c10", 1, "Rivet router").value, small["rivet-router"].cpu_ms.median);
  assert.equal(point("ssr-resumable-cpu-100-c10", 1, "Solid 1 hydratable").value, small["solid-stable"].cpu_ms.median);
  assert.equal(ssrVerdict(100, 10, "rivet-resume", "solid-stable"), "LOSE");
  assert.equal(ssrVerdict(100, 10, "rivet-resume", "solid-stable-interactive"), "WIN");
  assert.equal(ssrVerdict(100, 10, "rivet-router", "solid-stable"), "TIE");
  assert.equal(ssrVerdict(1000, 1, "rivet-resume", "solid-stable", "cpu_ms", "tuned+grid"), "LOSE");
  assert.equal(ssrVerdict(1000, 1, "rivet-resume", "solid-stable-interactive", "cpu_ms", "tuned+grid"), "WIN");
  // Memory: at 100 rows the interactive page uses more than both Solid 1.9 lanes, and is level with Solid 2.
  assert.equal(point("ssr-resumable-memory", 0, "Rivet resumable").value, fair.ssr.tuned["100"]["1"]["rivet-resume"].peak_mib.median);
  assert.equal(point("ssr-resumable-memory", 1, "Solid 1 hydratable").value, ssr["solid-stable"].peak_mib.median);
  for (const peer of ["solid-stable-interactive", "solid-stable"]) assert.equal(ssrVerdict(100, 1, "rivet-resume", peer, "peak_mib"), "LOSE", `memory vs ${peer}`);
  assert.equal(ssrVerdict(100, 1, "rivet-resume", "solid", "peak_mib"), "TIE");
  // At 1,000 rows: below Solid 1.9 interactive, above plain Solid 1.9, level with Solid 2.
  assert.equal(ssrVerdict(1000, 1, "rivet-resume", "solid-stable-interactive", "peak_mib"), "WIN");
  assert.equal(ssrVerdict(1000, 1, "rivet-resume", "solid-stable", "peak_mib"), "LOSE");
  assert.equal(ssrVerdict(1000, 1, "rivet-resume", "solid", "peak_mib"), "TIE");
  // Dynamic rendering chart = the same 1,000-row lanes.
  assert.equal(point("ssr-dynamic-cpu-1000", 0, "Qwik 1.20").value, ssr["qwik-stable"].cpu_ms.median);
  assert.equal(point("ssr-dynamic-cpu-1000", 1, "Solid 1.9 plain").value, ssr["solid-stable"].cpu_ms.median);
});

test("krausest charts use the fresh local Rivet/vanilla trials and disclose the browser-major reference mismatch", () => {
  const cpu = charts["krausest-cpu"];
  const memory = charts["krausest-memory"];
  assert.ok(cpu, "local CPU chart");
  assert.ok(memory, "local memory chart");
  for (const [chart, records] of [[cpu, krausest.cpu], [memory, krausest.memory]] as const) {
    assert.equal(chart.caption.date, "2026-10-23");
    assert.ok(chart.caption.source.href.endsWith("2026-10-23-krausest.md"));
    assert.ok(chart.caption.method.includes(krausest.environment.chrome), "exact local Chrome version");
    assert.ok(chart.caption.method.includes(krausest.comparison.reference.chrome), "exact published reference version");
    const ids: Record<string, string> = {
      "Create 1,000 rows": "01_run1k", "Replace 1,000 rows": "02_replace1k", "Update every tenth row": "03_update10th1k_x16",
      "Select a row": "04_select1k", "Swap rows": "05_swap1k", "Remove one row": "06_remove-one-1k",
      "Append 1,000 rows": "08_create1k-after1k_x2", "Clear 1,000 rows": "09_clear1k_x8",
      "Ready page": "21_ready-memory", "1,000 rows": "22_run-memory", "After five create/clear cycles": "25_run-clear-memory",
    };
    for (const group of chart.groups) {
      const record = (records as Record<string, { rivet: Stat | { total: Stat }; vanilla: Stat | { total: Stat } }>)[ids[group.label]!];
      assert.ok(record, group.label);
      assert.deepEqual(group.points.map((p) => p.label), ["Rivet", "Vanilla JS"]);
      for (const p of group.points) {
        const lane = p.rivet ? record.rivet : record.vanilla;
        const stat = "total" in lane ? lane.total : lane;
        assert.deepEqual([p.value, p.min, p.max], [stat.median, stat.min, stat.max]);
      }
    }
  }
  assert.equal(cpu.groups.length, 8, "all standard 1,000-row CPU scenarios");
  assert.equal(memory.groups.length, 3, "ready, run and create/clear memory");
  const page = readFileSync(new URL("../content/about/benchmarks.md", import.meta.url), "utf8");
  assert.match(page, /Chrome 155/);
  assert.match(page, /Chrome 154/);
  assert.match(page, /not comparable/);
});

test("resume charts equal the report; competitors.json stores the same numbers; ties and losses as the page states them", () => {
  const scenarios: Record<string, string> = { "Click (mouse)": "click", "Click (keyboard)": "keyClick", Tap: "tapClick", Filter: "filter", Navigate: "navigate" };
  const lanes: Record<string, string> = { Rivet: "rivet", "Solid 1": "solid-stable", "Solid 2": "solid", "Qwik 1": "qwik-stable", "Qwik 2": "qwik" };
  const stored = competitors.resume as unknown as Record<string, Record<string, { median: number }>>;
  for (const [id, metric] of [
    ["resume-input-paint", "paintLatency"],
    ["resume-first-change", "latency"],
  ] as const)
    for (const group of charts[id]!.groups)
      for (const p of group.points) {
        const stat = resume[`slow/${scenarios[group.label]}/${lanes[p.label]}`]![metric]!;
        assert.deepEqual([p.value, p.min, p.max], [stat.median, stat.min, stat.max], `${id} ${group.label} ${p.label}`);
        if (!p.rivet && metric === "paintLatency")
          assert.equal(stored[`slow/${scenarios[group.label]}`]![lanes[p.label]!]!.median, stat.median, `competitors.json resume ${group.label} ${p.label}`);
      }
  // Paint: click level with both Qwik lanes, faster than hydrated Solid; keyboard click, tap and filter level with Solid;
  // navigation faster than Solid, level with Qwik.
  for (const peer of ["qwik-stable", "qwik"]) assert.equal(resumeVerdict("click", "paintLatency", peer), "TIE", `click vs ${peer}`);
  for (const peer of ["solid-stable", "solid"]) assert.equal(resumeVerdict("click", "paintLatency", peer), "WIN", `click vs ${peer}`);
  for (const scenario of ["keyClick", "tapClick", "filter"])
    for (const peer of ["solid-stable", "solid"]) assert.equal(resumeVerdict(scenario, "paintLatency", peer), "TIE", `${scenario} vs ${peer}`);
  for (const peer of ["solid-stable", "solid"]) assert.equal(resumeVerdict("navigate", "paintLatency", peer), "WIN", `navigate vs ${peer}`);
  for (const peer of ["qwik-stable", "qwik"]) assert.equal(resumeVerdict("navigate", "paintLatency", peer), "TIE", `navigate vs ${peer}`);
  // First DOM change: Solid's attached handlers are ahead on click and filter.
  for (const scenario of ["click", "filter"]) assert.equal(resumeVerdict(scenario, "latency", "solid-stable"), "LOSE", `${scenario} first change`);
  // JavaScript before the first input: plain Solid 1.9 downloads less.
  const js = charts["resume-js-before-input"]!.groups[0]!.points;
  for (const p of js) assert.equal(p.value, resume[`slow/load/${lanes[p.label]}`]!.jsBytesBeforeInteraction!.median / 1000, `js ${p.label}`);
  for (const peer of ["solid-stable", "solid"]) assert.equal(resumeVerdict("load", "jsBytesBeforeInteraction", peer), "LOSE", `js vs ${peer}`);
  for (const peer of ["qwik-stable", "qwik"]) assert.equal(resumeVerdict("load", "jsBytesBeforeInteraction", peer), "WIN", `js vs ${peer}`);
});

test("DOM charts equal the interleaved 2026-10-21 run; mount level with Solid at 1,000 and 5,000 rows; updates win", () => {
  for (const [lane, label] of [
    ["solid-stable", "Solid 1.9.15"],
    ["solid", "Solid 2.0.0-rc.13"],
    ["react", "React 19.3"],
  ] as const) {
    assert.equal(point("dom-mount-1000", 0, label).value, dom["1000"][lane].mount.median);
    assert.equal(point("dom-mount-5000", 0, label).max, dom["5000"][lane].mount.max);
    assert.equal(point("dom-update-1000", 0, label).value, dom["1000"][lane].update100.median);
    assert.equal(point("dom-update-1000", 1, label).value, dom["1000"][lane].update1.median);
    assert.equal(competitors.labels[lane], label);
    // competitors.json stores the same run (fair-report.ts --dom … --store-competitors).
    for (const rows of ["1000", "5000"] as const)
      assert.deepEqual(competitors.dom[rows][lane].mount, dom[rows][lane].mount, `stored ${rows} ${lane}`);
    for (const metric of ["update100", "update1"] as const) assert.equal(domVerdict("1000", metric, lane), "WIN", `${metric} vs ${lane}`);
  }
  assert.equal(point("dom-mount-1000", 0, "Rivet").value, dom["1000"].rivet.mount.median);
  for (const rows of ["1000", "5000"] as const) {
    for (const peer of ["solid-stable", "solid"] as const) assert.equal(domVerdict(rows, "mount", peer), "TIE", `mount ${rows} vs ${peer}`);
    assert.equal(domVerdict(rows, "mount", "react"), "WIN");
  }
  assert.equal(domRun.runTs.protocol, competitors.dom.provenance.protocol, "charts and stored competitors share the mount protocol");
});

test("homepage strip: values equal the reports, big ratios computed and backed by their verdicts", () => {
  const ssr = fair.ssr.tuned["1000"]["1"];
  const strip = Object.fromEntries(homeStrip.map((chart) => [chart.id, chart]));
  assert.deepEqual(Object.keys(strip), ["ssr", "navigate", "update", "dynamic"]);
  const value = (id: string, label: string) => {
    const found = strip[id]!.points.find((p) => p.label === label);
    assert.ok(found, `${id}: ${label}`);
    return found.value;
  };
  for (const [i, chart] of homeStrip.entries()) {
    assert.ok(chart.points[0]!.rivet, `${chart.id}: Rivet bar first`);
    assert.ok(charts[chart.chart], `${chart.id}: source chart ${chart.chart}`);
    assert.match(chart.big, /^\d+(\.\d)?×$/);
    assert.ok(chart.strip.includes(chart.peer), `${chart.id}: the strip line names the peer ${chart.peer}`);
    if (i > 0) assert.notEqual(chart.big, homeStrip[i - 1]!.big, `${chart.id}: no equal neighbours`);
  }
  // Static SSR vs Razor at 1,000 and 5,000 rows (report verdicts WIN).
  assert.equal(value("ssr", "Rivet"), ssr["rivet-compiled"].cpu_ms.median);
  assert.equal(value("ssr", "Razor"), ssr["dotnet"].cpu_ms.median);
  assert.equal(strip.ssr!.big, (ssr["dotnet"].cpu_ms.median / ssr["rivet-compiled"].cpu_ms.median).toFixed(1) + "×");
  const ssr5000 = fair.ssr.tuned["5000"]["1"];
  assert.ok(strip.ssr!.footnote.startsWith((ssr5000["dotnet"].cpu_ms.median / ssr5000["rivet-compiled"].cpu_ms.median).toFixed(1) + "× at 5,000 rows"));
  // Navigation vs hydrated Solid 1.9 (WIN, tested above); the footnote names Qwik as level (TIE).
  assert.equal(value("navigate", "Rivet"), resume["slow/navigate/rivet"]!.paintLatency!.median);
  assert.equal(strip.navigate!.big, (resume["slow/navigate/solid-stable"]!.paintLatency!.median / resume["slow/navigate/rivet"]!.paintLatency!.median).toFixed(1) + "×");
  assert.match(strip.navigate!.footnote, /Qwik also resumes and is level/);
  // DOM update 100% vs Solid 1.9 (WIN vs every lane, tested above); mount level at 1,000 and 5,000 rows (TIE, tested above).
  assert.equal(value("update", "Rivet"), dom["1000"].rivet.update100.median);
  assert.equal(strip.update!.big, (dom["1000"]["solid-stable"].update100.median / dom["1000"].rivet.update100.median).toFixed(1) + "×");
  assert.match(strip.update!.footnote, /level with Solid 1\.9/);
  for (const rows of ["1000", "5000"] as const)
    assert.ok(strip.update!.footnote.includes(dom[rows]["solid-stable"].mount.median.toFixed(1) + " ms"), `${rows}-row mount carries its number`);
  assert.equal(strip.update!.loss, undefined, "no browser mount loss left");
  // Dynamic rendering: wins vs interactive Solid and both Qwik lanes; the 100-row c10 loss vs plain Solid is shown.
  assert.equal(value("dynamic", "Rivet"), ssr["rivet-resume"].cpu_ms.median);
  assert.equal(value("dynamic", "Solid 1.9"), ssr["solid-stable-interactive"].cpu_ms.median);
  assert.equal(value("dynamic", "Qwik 1.20"), ssr["qwik-stable"].cpu_ms.median);
  assert.equal(value("dynamic", "Qwik 2 rc"), ssr["qwik"].cpu_ms.median);
  assert.ok(strip.dynamic!.loss?.includes(fair.ssr.tuned["100"]["10"]["solid-stable"].cpu_ms.median.toFixed(2) + " ms"), "plain Solid loss line carries its number");
});

test("homepage benchmark: values equal the reports; the claim, every bar pair and every chip are report WINs", () => {
  const lanes = reactRun.ssr.tuned["1000"]["1"];
  const cmp = (peer: string, metric: string) =>
    reactRun.comparisons.find((c) => c.profile === "tuned" && c.rows === 1000 && c.concurrency === 1 && c.rivet === "rivet-compiled" && c.peer === peer && c.metric === metric);
  assert.equal(homeBench.big, (lanes["react-static"].cpu_ms.median / lanes["rivet-compiled"].cpu_ms.median).toFixed(0) + "×");
  assert.equal(cmp("react-static", "cpu_ms")?.verdict, "WIN", "headline claim");
  const LANES: Record<string, keyof typeof lanes> = { Rivet: "rivet-compiled", "Solid 1.9": "solid-stable-static", "Razor (.NET 10)": "dotnet", "React 19.3": "react-static" };
  assert.deepEqual(homeBench.bars.map((bar) => bar.label).sort(), Object.keys(LANES).sort());
  for (const bar of homeBench.bars) {
    assert.equal(bar.value, lanes[LANES[bar.label]!].cpu_ms.median, bar.label);
    assert.equal(bar.text, bar.value.toFixed(2) + " ms");
    if (bar.label !== "Rivet") assert.equal(cmp(LANES[bar.label]!, "cpu_ms")?.verdict, "WIN", `Rivet vs ${bar.label}`);
  }
  assert.deepEqual(homeBench.bars.filter((bar) => bar.rivet).map((bar) => bar.label), ["Rivet"]);
  assert.ok(homeBench.bars.every((bar, i, all) => i === 0 || all[i - 1]!.value <= bar.value), "fastest first");
  const [ttfb, update, heap] = homeBench.chips;
  assert.equal(ttfb!.big, (lanes["react-static"].ttfb_p50_ms.median / lanes["rivet-compiled"].ttfb_p50_ms.median).toFixed(0) + "×");
  assert.equal(cmp("react-static", "ttfb_p50_ms")?.verdict, "WIN");
  assert.equal(update!.big, (dom["1000"]["solid-stable"].update100.median / dom["1000"].rivet.update100.median).toFixed(1) + "×");
  assert.equal(domVerdict("1000", "update100", "solid-stable"), "WIN");
  assert.equal(heap!.big, (dom["1000"]["solid-stable"].heapMiB.median / dom["1000"].rivet.heapMiB.median).toFixed(1) + "×");
  assert.equal(verdict(dom["1000"].rivet.heapMiB, dom["1000"]["solid-stable"].heapMiB, "lower"), "WIN");
  const react = reactRun.comparisons.filter((c) => c.peer.startsWith("react-") && ["cpu_ms", "p50_ms", "ttfb_p50_ms"].includes(c.metric));
  assert.ok(react.length >= 60, "the run compares React on CPU, p50 and TTFB in every batch");
  for (const c of react) assert.equal(c.verdict, "WIN", `${c.rivet} vs ${c.peer} ${c.metric} ${c.rows} c${c.concurrency}`);
  for (const href of [homeBench.source.href, ttfb!.href, heap!.href]) assert.ok(existsSync(repo + href.replace("https://github.com/N1XUS/rivetjs/blob/main/", "")), href);
  assert.ok(readFileSync(repo + "docs/benchmarks/2026-10-27-ssr-comparison-react.md", "utf8").includes("\n## Methodology\n"), "#methodology anchor");
});

test("benchmarks page: the findings carry no typed numbers (charts render them from the JSON); runs table lists the latest reports", () => {
  const page = readFileSync(new URL("../content/about/benchmarks.md", import.meta.url), "utf8");
  const findings = page.slice(0, page.indexOf("## What the server benchmark measures"));
  assert.ok(findings.length > 1000);
  assert.doesNotMatch(findings, /\d+(\.\d+)?\s?(×|ms\b|MiB|KB\b|%)/, "no typed measurements above the method section");
  for (const chart of findings.matchAll(/::chart\{id=([\w-]+)\}/g)) assert.ok(charts[chart[1]!], `chart ${chart[1]} exists`);
  for (const report of ["2026-10-23-ssr-comparison.md", "2026-10-23-krausest.md", "2026-10-19-fair-comparison.md", "2026-10-21-dom-mount-2.md", "2026-10-20-dom-mount.md", "2026-10-09-fair-comparison.md", "perf-scoreboard.md"]) {
    assert.ok(page.includes(`docs/benchmarks/${report}`), `links ${report}`);
    assert.ok(existsSync(repo + "docs/benchmarks/" + report), `${report} exists`);
  }
});

