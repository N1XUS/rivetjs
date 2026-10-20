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
  assert.match(out.code, /const __rivetB = __rivetR_b\("src\/m\.tsx#Counter", 2\);\n\s*try \{/);
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
  // The DOM target's derived lowering (C3) is pinned by derived-adopt.test.ts; its serialized output ignores the spelled-out model.
  const dom = (options: object) => compile(COUNTER, { target: "dom", filename: "m.tsx", resume: { ...resume, ...options } });
  assert.deepEqual(dom({ model: "serialized" }), dom({}));
  // Boundary names, module-qualified (`<resume module>#<Name>`): the manifest `symbols` keys.
  assert.deepEqual(out.boundaries, ["src/m.tsx#Counter"]);
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
  assert.match(out.code, /__rivetR_b\("src\/m\.tsx#Switcher", 0\)/);
  assert.equal(out.code.match(/__rivetR_bOut\(__rivetB, /g)?.length, 3);
  assert.ok(out.code.includes("return __rivetR_bOut(__rivetB, null);"));
  assert.match(out.code, /const inner = \(\) => \{\s*return 1;\s*\};/);
  assert.match(
    out.code,
    /export const Arrow = \(props\) => \{\n\s*const __rivetB = __rivetR_b\("src\/m\.tsx#Arrow", 2\);\n\s*try \{\n\s*return __rivetR_bOut\(__rivetB, __rivetTemplate/,
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
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Counter", 3, props)'), local.code);
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Shell", 2)'), local.code);
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Page", 2)'), local.code);
  // The build's verdicts win over the module-local closure.
  const build = server(source, { model: "derived", boundaries: ["Counter"], independent: [] });
  assert.ok(build.code.includes('__rivetR_b("src/m.tsx#Counter", 2)'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("src/m.tsx#Page"'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("src/m.tsx#Shell"'), build.code);
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

it("RV2103 (non-deterministic render, error) and RV2104 (keyed state in a loop, warning); `check` reports them too", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function C(props) {
  const n = props.late ? signal(1) : null;
  const all = [];
  for (const v of props.list) all.push(signal(v));
  const t = Date.now();
  const ok = signal(Math.random());
  return <b onClick={() => n?.set(Date.now())}>{t}{ok()}</b>;
}
`;
  const out = server(source, { model: "derived" });
  assert.deepEqual(
    out.diagnostics.map((d) => [d.code, d.line]),
    [["RV2103", 7]],
  );
  assert.equal(out.code, "");
  assert.deepEqual(
    out.warnings?.map((d) => d.code),
    ["RV2104"],
  );
  // Keys are per site: the conditional `signal(1)` is fine (a render that skips it skips its key); the loop's repeats pair by order.
  assert.match(out.warnings![0]!.message, /^Keyed state `signal\(\)` is created inside a loop/);
  assert.equal(out.warnings![0]!.line, 6);
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

it("boundary eligibility: a PascalCase factory returning an object literal is not a component", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
function Root(props) { return <div onClick={() => props.go()}>{props.n}</div>; }
export function Renderer(link) {
  return {
    isVirtualized: true,
    CollectionRoot: (root) => <Root go={() => link.go(root)} n={1} />,
    onScroll: (event) => link.scroll(event),
  };
}
export function Picker(props) {
  const open = signal(false);
  return props.lazy ? { open, lazy: true } : { open, view: () => <b onClick={() => open.set(true)}>{open() ? "on" : "off"}</b> };
}
export function Accessor(props) {
  const on = signal(false);
  return () => <s onClick={() => on.set(true)}>{on() ? 1 : 0}</s>;
}
export function Mixed(props) {
  const on = signal(false);
  if (props.headless) return { on };
  return <i onClick={() => on.set(true)}>{on() ? 1 : 0}</i>;
}
`;
  const out = server(source, { model: "derived" });
  assert.deepEqual(out.diagnostics, []);
  // The factories render nothing themselves: no boundary, their objects / functions returned as they are.
  assert.deepEqual(out.boundaries, ["src/m.tsx#Root", "src/m.tsx#Accessor", "src/m.tsx#Mixed"]);
  assert.match(out.code, /export function Renderer\(link\) \{\n\s*return \{/);
  assert.doesNotMatch(out.code, /__rivetR_b\("src\/m\.tsx#(Renderer|Picker)"/);
  // An accessor component stays one; one render value among the returns is enough (`Mixed`).
  assert.match(out.code, /return __rivetR_bOut\(__rivetB, \{ on \}\);/);
  const facts = moduleFacts(source, "m.tsx", { boundaries: true });
  assert.deepEqual([...facts.boundaries.keys()], ["Root", "Accessor", "Mixed"]);
});
