// Derived model (M2 C1 / C2): the server resume target under `resume: { model: "derived" }` — boundary / keyed-state calls
// and nothing else — plus `moduleFacts` boundaries and the RV2103 / RV2104 diagnostics. Needs the wasm build that carries
// the derived model (`hasDerivedModel()`); on an older build every case skips with the reason.
import { test } from "vitest";
import assert from "node:assert/strict";
import { check, compile, hasDerivedModel, moduleFacts } from "../index.ts";

const derived = hasDerivedModel();
// The Rust half (M2 C1 / C2, plan docs/design/plans/2026-10-18-derived-client.md): `rust/src/resume/derived.rs` +
// `rust/src/compile/derived.rs`; the wasm exports `has_derived_model`. An older build skips every case.
const skip = derived ? "" : "rivet_compiler.wasm has no derived model (build without M2 C1 / C2)";
const it = (name: string, fn: () => void) => (derived ? test(name, fn) : test.skip(name + " — " + skip, fn));

const COUNTER = `
import { signal } from "@rivetjs/reactivity";
export function Counter(props) {
  const n = signal(0);
  return <button onClick={() => n.update((v) => v + 1)}>{n()}</button>;
}
export function Static() { return <p>hi</p>; }
`;
const resume = { module: "src/m.tsx" };
const server = (source: string, options: object = {}) => compile(source, { target: "server", filename: "m.tsx", resume: { ...resume, ...options } });

it("server derived target: boundary + keyed state calls, no site records; serialized model byte-identical", () => {
  const out = server(COUNTER, { model: "derived" });
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /const __rivetB = __rivetR_b\("Counter", 2\);\n\s*try \{/);
  assert.match(out.code, /__rivetR_sig\("[0-9a-z]{5}-0", 0\)/);
  assert.match(out.code, /return __rivetR_bOut\(__rivetB, __rivetTemplate\(__rivetFragments0, \[__rivetR_bAttr\(__rivetB\), n\(\)\]\)\);/);
  assert.match(out.code, /finally \{\n\s*__rivetR_bEnd\(__rivetB\);/);
  assert.match(out.code, /import \{ [^}]*_rB as __rivetR_b[^}]* \} from "@rivetjs\/runtime\/server-derived";/);
  for (const name of ["__rivetR_on(", "__rivetR_bind(", "__rivetR_attr(", "__rivetR_id(", "__rivetR_fn(", "__rivetR_props("])
    assert.ok(!out.code.includes(name), name);
  assert.match(out.code, /export function Static\(\) \{\n\s*return __rivetTemplate\(__rivetFragments1, \[\]\);\n\}/);
  // The derived server output carries no symbols: nothing to chunk for the serialized runtime.
  assert.equal(out.symbols, undefined);
  // Serialized (default) model: the option spelled out changes nothing.
  assert.deepEqual(server(COUNTER, { model: "serialized" }), server(COUNTER));
  assert.ok(server(COUNTER).code.includes("__rivetR_on("));
  // DOM target: unchanged by the model (C3 adopt mode is a later task).
  const dom = (options: object) => compile(COUNTER, { target: "dom", filename: "m.tsx", resume: { ...resume, ...options } });
  assert.deepEqual(dom({ model: "derived" }), dom({}));
});

it("every return of a boundary is wrapped; non-element roots get comment markers; concise arrows become blocks", () => {
  const out = server(
    `
import { signal } from "@rivetjs/reactivity";
export function Switcher(props) {
  const on = signal(false);
  if (props.off) return null;
  const inner = () => { return 1; };
  return <>{inner()}<b onClick={() => on.set(true)}>{on() ? "on" : "off"}</b></>;
}
export const Arrow = (props) => <i onClick={() => props.go()}>go</i>;
`,
    { model: "derived" },
  );
  assert.deepEqual(out.diagnostics, []);
  // Two returns, both through `_rBOut`; the nested function's `return 1` is untouched; fragment root → flags 0.
  assert.match(out.code, /__rivetR_b\("Switcher", 0\)/);
  assert.equal(out.code.match(/__rivetR_bOut\(__rivetB, /g)?.length, 3);
  assert.ok(out.code.includes("return __rivetR_bOut(__rivetB, null);"));
  assert.match(out.code, /const inner = \(\) => \{\s*return 1;\s*\};/);
  assert.match(
    out.code,
    /export const Arrow = \(props\) => \{\n\s*const __rivetB = __rivetR_b\("Arrow", 2\);\n\s*try \{\n\s*return __rivetR_bOut\(__rivetB, __rivetTemplate/,
  );
});

it("independent boundaries pass their props object; destructured props and context consumers stay dependent", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function Page() { return <main><Counter start={1} /><Shell title="x" /></main>; }
export function Counter(props) { const n = signal(props.start); return <button onClick={() => n.set(2)}>{n()}</button>; }
export function Shell({ title }) { const n = signal(0); return <b onClick={() => n.set(1)}>{title}</b>; }
`;
  const local = server(source, { model: "derived" });
  assert.deepEqual(local.diagnostics, []);
  assert.ok(local.code.includes('__rivetR_b("Counter", 3, props)'), local.code);
  assert.ok(local.code.includes('__rivetR_b("Shell", 2)'), local.code);
  assert.ok(local.code.includes('__rivetR_b("Page", 2)'), local.code);
  // The build's verdicts win over the module-local closure.
  const build = server(source, { model: "derived", boundaries: ["Counter"], independent: [] });
  assert.ok(build.code.includes('__rivetR_b("Counter", 2)'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("Page"'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("Shell"'), build.code);
});

it("moduleFacts boundaries: own interactivity, context, params, renders, data-only calls", () => {
  const facts = moduleFacts(
    `
import { signal, useContext } from "@rivetjs/reactivity";
export function Page({ data }) { return <main><Shell title="x">static</Shell><Counter start={data.n} items={[1, 2]} /></main>; }
export function Shell(props) { const v = useContext(Ctx); return <section>{props.children}</section>; }
export function Counter(props) { const n = signal(props.start); return <button onClick={() => n.set(2)}>{n()}</button>; }
export default function () { return <Page data={null} />; }
`,
    "m.tsx",
    { boundaries: true },
  );
  const page = facts.boundaries.get("Page")!;
  assert.deepEqual(
    { ...page, renders: [...page.renders] },
    {
      interactive: false,
      context: false,
      params: "destructured",
      renders: ["Shell", "Counter"],
      calls: [
        { tag: "Shell", data: true },
        { tag: "Counter", data: false },
      ],
    },
  );
  assert.equal(facts.boundaries.get("Shell")!.context, true);
  assert.equal(facts.boundaries.get("Counter")!.interactive, true);
  assert.equal(facts.boundaries.get("Counter")!.params, "object");
  assert.deepEqual(facts.boundaries.get("default")!.calls, [{ tag: "Page", data: true }]);
  assert.equal(moduleFacts(COUNTER, "m.tsx").boundaries.size, 0);
});

it("RV2103 (non-deterministic render, error) and RV2104 (conditional keyed state, warning); `check` reports them too", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function C(props) {
  const n = props.late ? signal(1) : null;
  const t = Date.now();
  const ok = signal(Math.random());
  return <b onClick={() => n?.set(Date.now())}>{t}{ok()}</b>;
}
`;
  const out = server(source, { model: "derived" });
  assert.deepEqual(
    out.diagnostics.map((d) => [d.code, d.line]),
    [["RV2103", 5]],
  );
  assert.equal(out.code, "");
  assert.deepEqual(
    out.warnings?.map((d) => d.code),
    ["RV2104"],
  );
  assert.match(out.warnings![0]!.message, /^Keyed state `signal\(\)` is created inside a conditional expression/);
  const checked = check(source, { filename: "m.tsx", resume: { ...resume, model: "derived" } });
  assert.deepEqual(
    checked.diagnostics.map((d) => [d.code, d.severity, d.targets]),
    [
      ["RV2103", "error", ["server"]],
      ["RV2104", "warning", ["server"]],
    ],
  );
  // The serialized model knows neither.
  assert.deepEqual(server(source).diagnostics, []);
});

it("option validation: RV7001 for an unknown model / non-string verdict lists", () => {
  assert.deepEqual(
    server(COUNTER, { model: "adopted" }).diagnostics.map((d) => [d.code, d.message]),
    [["RV7001", 'Invalid compiler option `resume.model`: expected "serialized" or "derived"']],
  );
  assert.deepEqual(
    server(COUNTER, { model: "derived", boundaries: [1] }).diagnostics.map((d) => d.code),
    ["RV7001"],
  );
});
