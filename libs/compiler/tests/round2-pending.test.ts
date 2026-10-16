// Round-2 compiler items whose fix lives in rust/src/compile.rs (user ruling 2026-10-06). C3, C5 (G-CMP-1:
// statically visible For / Show / .map directly in <table>; more cases in gap-cmp.test.ts), C6, C14 and the
// `unique` speed fix landed; C2 (needs the runtime `_rText` ABI) stays skipped.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const reason = "C2 pending";
const ok = (source: string, options: Parameters<typeof compile>[1]) => {
  const result = compile(source, options);
  assert.deepEqual(result.diagnostics, []);
  return result.code;
};

describe(`round 2 compile.rs items (${reason})`, () => {
  it.skip("C2: resumed RCDATA children (<title>, <textarea>) bind the element, never comment markers", () => {
    const source = `import { signal } from "@rivetjs/reactivity";\nexport function A() { const [n] = signal(1); return <head><title>T {n()}</title><textarea>{String(n())}</textarea></head>; }`;
    const code = ok(source, { target: "server", resume: { module: "a.tsx" } });
    // No `_rBind` (text markers) inside RCDATA; an element-level text binding instead.
    assert.doesNotMatch(code, /__rivetR_bind\(/);
    assert.match(code, /__rivetR_text\(/);
  });

  it("C3: explicit <textarea value> renders as content on the server (literal and dynamic)", () => {
    const code = ok(`export function A(p) { return <div><textarea value={p.v} /><textarea value="lit&amp;" /></div>; }`, { target: "server" });
    // No `value` attribute; the value is the content slot after the `>\n` sentinel.
    assert.doesNotMatch(code, /value=/);
    assert.match(code, /__rivetOmitted\(__rivetTextareaValue = p\.v\),\s*__rivetTextareaValue,/);
    assert.match(code, /__rivetOmitted\(__rivetTextareaValue_ = "lit&"\),\s*__rivetTextareaValue_\s*\]/);
  });

  it("C5: a dynamic child directly in <table> is a compile error (implied <tbody> splits resume markers)", () => {
    const result = compile(
      `import { For } from "@rivetjs/runtime/server";\nexport function A(p) { return <table><For each={p.rows}>{(r) => <tr><td>{r}</td></tr>}</For></table>; }`,
      { target: "server" },
    );
    assert.equal(result.diagnostics[0]?.code, "RV1005");
  });

  it("C6: RV1005 follows the HTML parser (no false positives, missing rules, server target too)", () => {
    for (const fine of [
      "<table><tbody><tr><td><table><tbody><tr><td>x</td></tr></tbody></table></td></tr></tbody></table>",
      "<p><button><div>x</div></button></p>",
    ])
      for (const target of ["server", "dom"] as const) assert.deepEqual(compile(`export const A = () => ${fine};`, { target }).diagnostics, [], fine);
    for (const bad of [
      "<p><h4>x</h4></p>",
      "<p><nav/></p>",
      "<p><pre/></p>",
      "<a href='/'><a href='/x'>y</a></a>",
      "<ul><li><p><li>x</li></p></li></ul>",
      "<table><div/></table>",
    ])
      for (const target of ["server", "dom"] as const)
        assert.equal(compile(`export const A = () => ${bad};`, { target }).diagnostics[0]?.code, "RV1005", `${target} ${bad}`);
  });

  it("C14: literal (string) event handlers are diagnostics on every target", () => {
    for (const options of [{ target: "server" }, { target: "dom" }] as const) {
      assert.equal(compile(`export function A() { return <button onClick={"alert(1)"}>x</button>; }`, options).diagnostics.length, 1);
    }
  });

  it("speed: `unique` names are O(1) per call (many lists in one module compile linearly)", () => {
    const comp = (i: number) => `export function C${i}(p) { return <ul>{p.xs.map((x) => <li>{x}</li>)}</ul>; }\n`;
    const time = (n: number) => {
      const source = Array.from({ length: n }, (_, i) => comp(i)).join("");
      const t = performance.now();
      ok(source, { target: "server" });
      return performance.now() - t;
    };
    time(50);
    // Best of 3: the suite runs files in parallel workers, one slow sample must not fail it.
    const best = (n: number) => Math.min(time(n), time(n), time(n));
    const small = best(250);
    const large = best(1000);
    // Output names still grow (`__rivetTape_…`), so allow ~n log n headroom, not n².
    assert.ok(large < small * 12, `${small.toFixed(1)} → ${large.toFixed(1)} ms`);
  });
});
