import { test } from "vitest";
import assert from "node:assert/strict";
import { check, compile } from "../index.ts";

const span = (source: string, d: { start: number; end: number }) => source.slice(d.start, d.end);

test("check reports code, severity and the exact UTF-16 range", () => {
  const source = `const label = "Grüße 👋";\nexport const A = (p: unknown[]) => <div title={label}>{...p}</div>;\n`;
  const { diagnostics } = check(source, { filename: "a.tsx" });
  assert.equal(diagnostics.length, 1);
  const [d] = diagnostics;
  assert.equal(d!.code, "RV1002");
  assert.equal(d!.severity, "error");
  assert.equal(
    d!.message,
    "Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)",
  );
  assert.equal(d!.filename, "a.tsx");
  assert.equal(span(source, d!), "{...p}");
  assert.equal(d!.line, 2);
  assert.equal(d!.column, source.split("\n")[1]!.indexOf("{...p}") + 1);
});

test("compile diagnostics carry their code and severity", () => {
  const { diagnostics } = compile(`export const A = (p: any[]) => <div>{...p}</div>;`, { filename: "a.tsx" });
  assert.deepEqual(diagnostics, [
    {
      category: "error",
      code: "RV1002",
      severity: "error",
      message:
        "Spread children are not supported: render the array as one child ({items}) or map it ({items.map((x) => <li>{x}</li>)} / <For each={items} by={…}>)",
      filename: "a.tsx",
      line: 1,
      column: 37,
    },
  ]);
});

test("parse errors carry a span", () => {
  const source = `export const A = () => <div>;\n`;
  const { diagnostics } = check(source, { filename: "a.tsx" });
  assert.ok(diagnostics.length >= 1);
  for (const d of diagnostics) {
    assert.equal(d.code, "RV1000");
    assert.ok(d.end >= d.start && d.start > 0, JSON.stringify(d));
  }
});

test("compile parse errors carry line/column of the parser label (UTF-16 columns)", () => {
  const source = `const a = "👋";\nexport const A = () => <div>;\n`;
  const { diagnostics } = compile(source, { filename: "a.tsx" });
  assert.ok(diagnostics.length >= 1);
  const checked = check(source, { filename: "a.tsx" }).diagnostics;
  for (const [i, d] of diagnostics.entries()) {
    assert.equal(typeof d.line, "number", JSON.stringify(d));
    assert.equal(typeof d.column, "number", JSON.stringify(d));
    assert.equal(d.line, checked[i]!.line);
    assert.equal(d.column, checked[i]!.column);
  }
  assert.ok(diagnostics.some((d) => d.line === 2));
});

test("both targets are checked and merged without duplicates", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function A() {
  const s = signal(0);
  const w = window.innerWidth;
  return <p><div onClick={() => s.set(w)}>{s()}</div><span>{...[]}</span></p>;
}`;
  const result = check(source, { filename: "a.tsx", resume: { module: "src/a.tsx" } });
  const codes = result.diagnostics.map((d) => d.code).sort();
  // Browser global (server only), spread children (both targets, reported once), parser-repaired nesting.
  assert.deepEqual(codes, ["RV1002", "RV1005", "RV2001"]);
  assert.equal(
    span(
      source,
      result.diagnostics.find((d) => d.code === "RV2001")!,
    ),
    "window",
  );
  const serverOnly = check(source, { filename: "a.tsx", resume: { module: "src/a.tsx" }, targets: ["dom"] });
  assert.ok(!serverOnly.diagnostics.some((d) => d.code === "RV2001"));
});

test("resume sites: kind, ids, spans, capture declarations and where they run", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
export function Counter({ step }: { step: number }) {
  const count = signal(0);
  let el!: HTMLElement;
  const bump = () => count.set(count() + step);
  clientEffect(() => { el.title = String(count()); });
  return <button ref={(node) => (el = node)} onClick={() => bump()}>{count()}</button>;
}`;
  const { diagnostics, sites } = check(source, { filename: "c.tsx", resume: { module: "src/c.tsx" } });
  assert.deepEqual(diagnostics, []);
  const byKind = Object.fromEntries(sites.map((s) => [s.kind, s]));
  assert.deepEqual(Object.keys(byKind).sort(), ["bind", "effect", "event", "fn", "ref"]);
  const click = byKind.event!;
  assert.equal(click.id, `src/c.tsx#${click.name}`);
  assert.equal(click.component, "Counter");
  assert.equal(click.runsOn, "client");
  assert.equal(span(source, click), "() => bump()");
  assert.equal(span(source, { start: click.anchorStart, end: click.anchorEnd }), "onClick");
  assert.deepEqual(
    click.captures.map((c) => [c.name, c.kind, span(source, c)]),
    [["bump", "fn", "bump"]],
  );
  const effect = byKind.effect!;
  assert.equal(span(source, { start: effect.anchorStart, end: effect.anchorEnd }), "clientEffect");
  assert.deepEqual(
    effect.captures.map((c) => [c.name, c.kind]),
    [
      ["el", "ref"],
      ["count", "value"],
    ],
  );
  assert.equal(span(source, effect.captures[1]!), "count");
  const fn = byKind.fn!;
  assert.equal(span(source, { start: fn.anchorStart, end: fn.anchorEnd }), "bump");
  assert.deepEqual(
    fn.captures.map((c) => [c.name, c.kind, span(source, c)]),
    [
      ["count", "value", "count"],
      ["step", "value", "step"],
    ],
  );
  assert.equal(byKind.bind!.runsOn, "both");
  assert.equal(fn.runsOn, "both");
  assert.equal(effect.runsOn, "client");
  assert.equal(byKind.ref!.runsOn, "client");
});

test("sites are returned even when the file has diagnostics; non-resume files have none", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function A() {
  const s = signal(0);
  return <div ref={(el) => el.focus()} onClick={() => s.set(2)}><i>{...[]}</i></div>;
}`;
  const resumed = check(source, { filename: "a.tsx", resume: { module: "a.tsx" } });
  assert.ok(resumed.diagnostics.some((d) => d.code === "RV1002"));
  assert.ok(resumed.sites.some((s) => s.kind === "event"));
  assert.deepEqual(check(source, { filename: "a.tsx" }).sites, []);
});

test("message families map to stable codes", () => {
  const cases: [string, string, boolean?][] = [
    [`export const A = () => <svg:rect />;`, "RV1003"],
    [`export const A = () => <x$y />;`, "RV1004"],
    [`export const A = () => <div innerHTML="x" />;`, "RV1101"],
    [`export const A = () => <div preload="soon" onClick={() => 1} />;`, "RV1102"],
    [`export const A = () => <br>x</br>;`, "RV1008"],
    [`export const A = () => <div onFrobnicate={() => 1} />;`, "RV1012"],
    [`export { clientEffect } from "@rivetjs/runtime/dom";`, "RV3001"],
    [`import * as dom from "@rivetjs/runtime/dom";\nexport const f = () => dom.For;`, "RV3002"],
    [`export function A() { const t = Date.now(); return <b onClick={() => t}>{t}</b>; }`, "RV2103", true],
  ];
  for (const [source, code, resume] of cases) {
    const { diagnostics } = check(source, { filename: "a.tsx", ...(resume ? { resume: { module: "a.tsx" } } : {}) });
    assert.ok(
      diagnostics.some((d) => d.code === code),
      `${source}: ${JSON.stringify(diagnostics.map((d) => [d.code, d.message]))}`,
    );
    for (const d of diagnostics) assert.notEqual(d.code, "RV9000", d.message);
  }
});

// T2: UTF-16 positions come from one per-source index (was a prefix re-encode per position:
// quadratic in file size: 15× for 4× the sites before, ~4–5× now). 4× the sites must stay under 10× the time.
// Timing under a loaded host: small / large runs are interleaved (a load spike hits both), each size keeps
// its best of 7, and a failing ratio is re-measured up to 3 times — a quadratic regression (≥ 15×) fails
// every attempt, a transient spike does not.
test("check scales linearly with sites in a non-ASCII file", () => {
  const src = (n: number) =>
    `import { signal } from "@rivetjs/reactivity";\nexport function App() {\n  const [n, setN] = signal(0);\n  return <div>\n${Array.from({ length: n }, (_, i) => `    <button title="é ${i} — ✓" onClick={() => setN(n() + ${i})}>héllo 😀 {n()}</button>`).join("\n")}\n  </div>;\n}\n`;
  const sources = { small: src(500), large: src(2000) };
  const run = (source: string, sites: number) => {
    const t = performance.now();
    const result = check(source, { resume: { module: "a.tsx" } });
    const ms = performance.now() - t;
    assert.equal(result.sites.length, sites);
    return ms;
  };
  run(src(100), 200); // warm-up (wasm instance, JIT)
  const ratios: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let small = Infinity,
      large = Infinity;
    for (let i = 0; i < 7; i++) {
      small = Math.min(small, run(sources.small, 1000));
      large = Math.min(large, run(sources.large, 4000));
    }
    if (large < small * 10) return;
    ratios.push(`500 sites ${small.toFixed(1)} ms, 2000 sites ${large.toFixed(1)} ms`);
  }
  assert.fail(`check is superlinear in sites: ${ratios.join("; ")}`);
});
