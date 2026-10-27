// fair-report.ts: like-for-like peer classes, provenance refusal, noise-aware verdicts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { summarize } from "../fair-report.ts";

const provenance = { generator: "node", generator_sha256: "abc", duration: 10, warmup: 3, repeats: 3, gc: "tuned", strings: false, rate: 0 };
const kase = (framework: string, rps: number, repeat = 0) => ({
  framework,
  rows: 1000,
  concurrency: 1,
  repeat,
  load: { rps, p50_ms: 1000 / rps, p99_ms: 2000 / rps, p50_ttfb_ms: 100 / rps, mean_response_bytes: 700000, failed: 0 },
  resources: { frontend: { cpu_ms_per_response: 900 / rps, peak_memory_bytes: 80 * 1048576 } },
});
const run = (cases: ReturnType<typeof kase>[], p: object = provenance) => ({
  file: "x.json",
  metadata: { run_id: "r", utc: "", provenance: p as typeof provenance },
  cases,
});

test("rivet-compiled ranks only against static peers, rivet-resume only against resumable peers", () => {
  const cases = ["rivet-compiled", "rivet-resume", "dotnet", "solid-stable-static", "react-static", "solid-stable", "react-interactive", "qwik"].flatMap(
    (f, i) => [0, 1, 2].map((r) => kase(f, 100 + 50 * i + r, r)),
  );
  const { comparisons } = summarize([run(cases)]);
  const peers = (lane: string) => [...new Set(comparisons.filter((c) => c.rivet === lane).map((c) => c.peer))].sort();
  assert.deepEqual(peers("rivet-compiled"), ["dotnet", "react-static", "solid-stable-static"]);
  assert.deepEqual(peers("rivet-resume"), ["qwik", "react-interactive", "solid-stable"]);
  const rps = comparisons.find((c) => c.rivet === "rivet-compiled" && c.peer === "dotnet" && c.metric === "rps")!;
  assert.equal(rps.verdict, "LOSE"); // 100–102 vs 200–202 req/s
  const bytes = comparisons.find((c) => c.rivet === "rivet-compiled" && c.peer === "dotnet" && c.metric === "html_kb")!;
  assert.equal(bytes.verdict, "TIE");
});

test("refuses to merge runs with different provenance into one profile", () => {
  assert.throws(() => summarize([run([kase("dotnet", 1)]), run([kase("dotnet", 1)], { ...provenance, generator_sha256: "other" })]), /provenance differs/);
  assert.throws(() => summarize([{ file: "old.json", metadata: { run_id: "r", utc: "" }, cases: [] }]), /no metadata.provenance/);
  const { profiles } = summarize([run([kase("dotnet", 1)]), run([kase("dotnet", 1)], { ...provenance, gc: "default" })]);
  assert.deepEqual(Object.keys(profiles).sort(), ["default", "tuned"]);
});

test("a later run supersedes earlier runs for the groups it re-measured", () => {
  const first = run([0, 1, 2].map((r) => kase("dotnet", 50, r)));
  const again = run([0, 1, 2].map((r) => kase("dotnet", 100, r)));
  const { table } = summarize([first, again]);
  assert.equal(table.tuned![1000]![1]!.dotnet!.rps!.median, 100);
  assert.equal(table.tuned![1000]![1]!.dotnet!.rps!.n, 3);
});
