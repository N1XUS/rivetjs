// Benchmark chart data (content/_charts.ts): every number traces back to a committed report.
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { charts, editorialLoss, homeFacts, homeStrip } from "../content/_charts.ts";
import fair from "../../../docs/benchmarks/2026-10-09-fair-comparison.json" with { type: "json" };
import competitors from "../../dom-bench/competitors.json" with { type: "json" };
import editorial from "../../../docs/benchmarks/2026-10-11-editorial.json" with { type: "json" };

const repo = fileURLToPath(new URL("../../../", import.meta.url));

const point = (id: string, group: number, label: string) => {
  const found = charts[id]!.groups[group]!.points.find((p) => p.label === label);
  assert.ok(found, `${id}: ${label}`);
  return found;
};

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

test("fair-comparison values equal the JSON; competitors.json stores the same SSR and resume numbers", () => {
  const ssr = fair.ssr.tuned["1000"]["1"];
  assert.equal(point("ssr-static-cpu", 0, "Rivet static").value, ssr["rivet-compiled"].cpu_ms.median);
  assert.equal(point("ssr-static-cpu", 0, "Razor (.NET 10)").max, ssr["dotnet"].cpu_ms.max);
  assert.equal(point("ssr-static-headline", 0, "Razor (.NET 10)").value, ssr["dotnet"].cpu_ms.median);
  const verdict = (rows: number, concurrency: number, rivet: string, peer: string, profile = "tuned") =>
    fair.comparisons.find(
      (c) => c.profile === profile && c.rows === rows && c.concurrency === concurrency && c.metric === "cpu_ms" && c.rivet === rivet && c.peer === peer,
    )?.verdict;
  assert.equal(verdict(1000, 1, "rivet-compiled", "dotnet"), "WIN", "headline claim matches the report verdict");
  assert.equal(verdict(1000, 1, "rivet-resume", "solid-stable"), "LOSE", "homepage interactive-SSR loss matches the report verdict");
  assert.equal(verdict(1000, 1, "rivet-resume", "solid-stable-interactive"), "WIN");
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
  }
  assert.equal(competitors.ssr.metrics["1000"]["dotnet"].cpu_ms.median, ssr["dotnet"].cpu_ms.median);
  (["1", "10"] as const).forEach((c, group) => {
    assert.equal(point("ssr-grid-cpu", group, "Rivet static").value, fair.ssr["tuned+grid"]["1000"][c]["rivet-compiled"].cpu_ms.median);
    assert.equal(point("ssr-grid-cpu", group, "Razor (.NET 10)").value, fair.ssr["tuned+grid"]["1000"][c]["dotnet"].cpu_ms.median);
  });
  for (const [lane, label] of [
    ["solid-stable", "Solid 1.9.15"],
    ["solid", "Solid 2.0.0-rc.13"],
    ["react", "React 19.3"],
  ] as const) {
    assert.equal(point("dom-mount-1000", 0, label).value, fair.dom["1000"].mount.stats[lane].median);
    assert.equal(point("dom-update-1000", 2, label).value, fair.dom["1000"].update1.stats[lane].median);
    assert.equal(competitors.labels[lane], label);
  }
  assert.equal(fair.dom["1000"].mount.verdicts["solid-stable"], "WIN", "homepage mount verdict matches the report");
  const scenarios: Record<string, string> = { "Click (mouse)": "click", "Click (keyboard)": "keyClick", Tap: "tapClick", Filter: "filter", Navigate: "navigate" };
  const lanes: Record<string, string> = { Rivet: "rivet", "Solid 1": "solid-stable", "Solid 2": "solid", "Qwik 1": "qwik-stable", "Qwik 2": "qwik" };
  const resume = fair.resume as unknown as Record<string, { paintLatency: { median: number; min: number; max: number } }>;
  const stored = competitors.resume as unknown as Record<string, Record<string, { median: number }>>;
  for (const group of charts["resume-input-paint"]!.groups) {
    for (const p of group.points) {
      const stat = resume[`slow/${scenarios[group.label]}/${lanes[p.label]}`]!.paintLatency;
      assert.deepEqual([p.value, p.min, p.max], [stat.median, stat.min, stat.max], `${group.label} ${p.label}`);
      if (!p.rivet) assert.equal(stored[`slow/${scenarios[group.label]}`]![lanes[p.label]!]!.median, stat.median, `competitors.json resume ${group.label} ${p.label}`);
    }
  }
});

test("homepage strip: values equal the report, big ratios computed and backed by its verdicts", () => {
  const ssr = fair.ssr.tuned["1000"]["1"];
  const verdict = (rows: number, rivet: string, peer: string) =>
    fair.comparisons.find((c) => c.profile === "tuned" && c.rows === rows && c.concurrency === 1 && c.metric === "cpu_ms" && c.rivet === rivet && c.peer === peer);
  const strip = Object.fromEntries(homeStrip.map((chart) => [chart.id, chart]));
  assert.deepEqual(Object.keys(strip), ["ssr", "navigate", "update", "dynamic"]);
  const value = (id: string, label: string) => {
    const found = strip[id]!.points.find((p) => p.label === label);
    assert.ok(found, `${id}: ${label}`);
    return found.value;
  };
  for (const chart of homeStrip) {
    assert.ok(chart.points[0]!.rivet, `${chart.id}: Rivet bar first`);
    assert.ok(charts[chart.chart], `${chart.id}: source chart ${chart.chart}`);
    assert.match(chart.big, /^\d+(\.\d)?×$/);
    assert.ok(chart.strip.includes(chart.peer), `${chart.id}: the strip line names the peer ${chart.peer}`);
  }
  // Static SSR vs Razor: 3.6× at 1,000 rows, 6.0× at 5,000 (report verdicts WIN).
  assert.equal(value("ssr", "Rivet"), ssr["rivet-compiled"].cpu_ms.median);
  assert.equal(value("ssr", "Razor"), ssr["dotnet"].cpu_ms.median);
  assert.equal(strip.ssr!.big, (ssr["dotnet"].cpu_ms.median / ssr["rivet-compiled"].cpu_ms.median).toFixed(1) + "×");
  assert.equal(verdict(1000, "rivet-compiled", "dotnet")?.verdict, "WIN");
  const ssr5000 = fair.ssr.tuned["5000"]["1"];
  assert.ok(strip.ssr!.footnote.startsWith((ssr5000["dotnet"].cpu_ms.median / ssr5000["rivet-compiled"].cpu_ms.median).toFixed(1) + "× at 5,000 rows"));
  assert.equal(verdict(5000, "rivet-compiled", "dotnet")?.verdict, "WIN");
  // Dynamic rendering: wins vs interactive Solid and both Qwik lanes, loss vs plain hydratable Solid shown.
  assert.equal(value("dynamic", "Rivet"), ssr["rivet-resume"].cpu_ms.median);
  assert.equal(value("dynamic", "Solid 1.9"), ssr["solid-stable-interactive"].cpu_ms.median);
  assert.equal(value("dynamic", "Qwik 1.20"), ssr["qwik-stable"].cpu_ms.median);
  assert.equal(value("dynamic", "Qwik 2 rc"), ssr["qwik"].cpu_ms.median);
  for (const peer of ["solid-stable-interactive", "qwik-stable", "qwik"]) assert.equal(verdict(1000, "rivet-resume", peer)?.verdict, "WIN", peer);
  assert.equal(verdict(1000, "rivet-resume", "solid-stable")?.verdict, "LOSE");
  assert.ok(strip.dynamic!.loss?.includes(ssr["solid-stable"].cpu_ms.median.toFixed(2) + " ms"), "plain Solid loss line carries its number");
  // Navigation after resume vs the fastest competitor; first click a tie.
  const paint = (scenario: string, lane: string) => (fair.resume as unknown as Record<string, { paintLatency: { median: number } }>)[`slow/${scenario}/${lane}`]!.paintLatency.median;
  assert.equal(value("navigate", "Rivet"), paint("navigate", "rivet"));
  const best = Math.min(...["qwik-stable", "qwik", "solid", "solid-stable"].map((lane) => paint("navigate", lane)));
  assert.equal(strip.navigate!.big, (best / paint("navigate", "rivet")).toFixed(1) + "×");
  // DOM update 100%: WIN vs every lane.
  const update = fair.dom["1000"].update100;
  assert.equal(value("update", "Rivet"), update.stats.rivet.median);
  assert.equal(value("update", "React 19"), update.stats.react.median);
  assert.deepEqual(Object.values(update.verdicts), ["WIN", "WIN", "WIN"]);
});

test("homepage loss row: editorial numbers equal the JSON", () => {
  assert.deepEqual(editorialLoss.zeroJs, ["Astro", "Eleventy", "Hugo"]);
  assert.equal(editorialLoss.rivetInlineJS, editorial.output["1000"].rivet.article.inlineJS);
  assert.equal(editorialLoss.rivetFetchedJS, editorial.serve["1000"].rivet.client.jsBytes);
  assert.equal(editorialLoss.rivetLcp, editorial.serve["1000"].rivet.lighthouse.article.lcp.median);
  assert.ok(editorialLoss.rivetLcp > editorialLoss.astroLcp, "still a loss: Rivet's article LCP is above Astro's");
  assert.ok(existsSync(repo + editorialLoss.source.href.replace("https://github.com/N1XUS/rivetjs/blob/main/", "")));
});

test("home feature grid facts equal the JSON", () => {
  assert.equal(homeFacts.domUpdate1000, fair.dom["1000"].update100.stats.rivet.median.toFixed(2) + " ms");
  const p99 = fair.ssr.tuned["5000"]["1"];
  assert.equal(homeFacts.streamP99, p99["rivet-compiled"].p99_ms.median.toFixed(1) + " ms");
  assert.equal(homeFacts.razorP99, p99["dotnet"].p99_ms.median.toFixed(1) + " ms");
  assert.ok(p99["rivet-compiled"].p99_ms.median < p99["dotnet"].p99_ms.median);
});
