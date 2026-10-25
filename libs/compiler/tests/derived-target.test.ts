// Derived model (M2 C1 / C2; the only resume model since M6): the server resume target under `resume` — boundary /
// keyed-state calls and nothing else — plus `moduleFacts` boundaries and the RV2103 / RV2104 diagnostics.
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

it("server derived target: boundary + keyed state calls, no site records", () => {
  const out = server(COUNTER);
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /const __rivetB = __rivetR_b\("src\/m\.tsx#Counter", 2, undefined, "click"\);\n\s*try \{/);
  assert.match(out.code, /__rivetR_sig\("[0-9a-z]{5}-0", 0, undefined, 1\)/);
  assert.match(out.code, /return __rivetR_bOut\(__rivetB, __rivetTemplate\(__rivetFragments0, \[__rivetR_bAttr\(__rivetB\), n\(\)\]\)\);/);
  assert.match(out.code, /finally \{\n\s*__rivetR_bEnd\(__rivetB\);/);
  assert.match(out.code, /import \{ [^}]*_rB as __rivetR_b[^}]* \} from "@rivetjs\/runtime\/server-derived";/);
  for (const name of ["__rivetR_on(", "__rivetR_bind(", "__rivetR_attr(", "__rivetR_id(", "__rivetR_fn(", "__rivetR_props("])
    assert.ok(!out.code.includes(name), name);
  assert.match(out.code, /export function Static\(\) \{\n\s*return __rivetTemplate\(__rivetFragments1, \[\]\);\n\}/);
  // `resume: true` = the filename as the module.
  assert.deepEqual(compile(COUNTER, { target: "server", filename: "src/m.tsx", resume: true } as never).code, out.code);
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
  );
  assert.deepEqual(out.diagnostics, []);
  // Two returns, both through `_rBOut`; the nested function's `return 1` is untouched; fragment root → flags 0.
  assert.match(out.code, /__rivetR_b\("src\/m\.tsx#Switcher", 0, undefined, "click"\)/);
  assert.equal(out.code.match(/__rivetR_bOut\(__rivetB, /g)?.length, 3);
  assert.ok(out.code.includes("return __rivetR_bOut(__rivetB, null);"));
  assert.match(out.code, /const inner = \(\) => \{\s*return 1;\s*\};/);
  assert.match(
    out.code,
    /export const Arrow = \(props\) => \{\n\s*const __rivetB = __rivetR_b\("src\/m\.tsx#Arrow", 2, undefined, "click"\);\n\s*try \{\n\s*return __rivetR_bOut\(__rivetB, __rivetTemplate/,
  );
});

it("independent boundaries pass their props object; nested destructured props and context consumers stay dependent", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function Page() { return <main><Counter start={1} /><Shell title="x" /><Deep a={{ b: 1 }} /></main>; }
export function Counter(props) { const n = signal(props.start); return <button onClick={() => n.set(2)}>{n()}</button>; }
export function Shell({ title, n: count = 0, ...rest }) { const n = signal(0); return <b {...rest} onClick={() => n.set(1)}>{title}{count}</b>; }
export function Deep({ a: { b } }) { const n = signal(0); return <b onClick={() => n.set(1)}>{b}</b>; }
`;
  const local = server(source);
  assert.deepEqual(local.diagnostics, []);
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Counter", 3, props, "click")'), local.code);
  // ZERO A5: a flat object pattern records the object rebuilt from its bindings (defaults applied, rest spread).
  assert.match(local.code, /__rivetR_b\("src\/m\.tsx#Shell", 3, \{\s*title,\s*n: count,\s*\.\.\.rest\s*\}, "click"\)/);
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Deep", 2, undefined, "click")'), local.code);
  assert.ok(local.code.includes('__rivetR_b("src/m.tsx#Page", 2)'), local.code);
  // The build's verdicts win over the module-local closure.
  const build = server(source, { boundaries: ["Counter"], independent: [] });
  assert.ok(build.code.includes('__rivetR_b("src/m.tsx#Counter", 2, undefined, "click")'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("src/m.tsx#Page"'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("src/m.tsx#Shell"'), build.code);
  assert.ok(!build.code.includes('__rivetR_b("src/m.tsx#Deep"'), build.code);
  // M6-PARITY 6b: a `conditional` verdict (no change source of its own) sets COND (1024) on its `_rB`.
  const cond = server(source, { boundaries: ["Counter", "Page"], independent: [], conditional: ["Page"] });
  assert.ok(cond.code.includes('__rivetR_b("src/m.tsx#Page", 1026)'), cond.code);
  assert.ok(cond.code.includes('__rivetR_b("src/m.tsx#Counter", 2, undefined, "click")'), cond.code);
});

it("moduleFacts boundaries: own interactivity, context, params, renders, data-only calls", () => {
  const facts = moduleFacts(
    `
import { signal, useContext } from "@rivetjs/reactivity";
export function Page({ data: { n } }) { return <main><Shell title="x">static</Shell><Counter start={n} items={[1, 2]} /></main>; }
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
      source: false,
      provides: false,
      listens: false,
      context: false,
      params: "destructured",
      renders: ["Shell", "Counter"],
      calls: [
        { tag: "Shell", data: true, fn: false, around: [], inputs: true },
        { tag: "Counter", data: false, fn: false, around: [], inputs: false },
      ],
    },
  );
  assert.equal(facts.boundaries.get("Shell")!.context, true);
  assert.equal(facts.boundaries.get("Counter")!.interactive, true);
  // M6-PARITY 6b: keyed state + a handler = an own change source.
  assert.equal(facts.boundaries.get("Counter")!.source, true);
  assert.equal(facts.boundaries.get("Shell")!.source, false);
  assert.equal(facts.boundaries.get("Counter")!.params, "object");
  assert.deepEqual(facts.boundaries.get("default")!.calls, [{ tag: "Page", data: true, fn: false, around: [], inputs: true }]);
  assert.equal(moduleFacts(COUNTER, "m.tsx").boundaries.size, 0);
});

it("moduleFacts boundaries (6b): sources vs reads, module state, providers, function props, enclosing tags; export maps", () => {
  const facts = moduleFacts(
    `
import { Provider } from "@rivetjs/runtime/dom";
import { count, cn } from "./state.ts";
import * as ns from "./helpers.ts";
let mode = "a";
const LIMIT = 3;
const helper = (x) => x * 2;
export function Reads(props) { return <b class={cn(props.a, ns.size(props.b))} title={helper(props.c)}>{props.d}</b>; }
export function Global(props) { return <b>{count()}</b>; }
export function Let(props) { return <b>{mode.toUpperCase()}</b>; }
export function Ref(props) { return <b ref={props.ref}>{props.x}</b>; }
export function Root(props) { return <Provider token={T} value={props.v}><Part onPick={() => 1} label={LIMIT} /></Provider>; }
export const Meter = Object.assign(Root, { Part: Reads });
export { Reads as Alias };
export * from "./more.ts";
export { x as y } from "./other.ts";
`,
    "m.tsx",
    { boundaries: true },
  );
  const b = (name: string) => facts.boundaries.get(name)!;
  assert.deepEqual(
    ["Reads", "Global", "Let", "Ref", "Root"].map((n) => [n, b(n).interactive, b(n).source]),
    [
      ["Reads", true, false],
      ["Global", true, true],
      ["Let", true, true],
      ["Ref", true, false],
      ["Root", true, false],
    ],
  );
  assert.equal(b("Root").provides, true);
  assert.deepEqual(b("Root").calls, [
    { tag: "Provider", data: false, fn: false, around: [], inputs: false },
    { tag: "Part", data: false, fn: true, around: ["Provider"], inputs: false },
  ]);
  assert.equal(facts.exports.get("Alias"), "Reads");
  assert.equal(facts.exports.get("Meter"), "Meter");
  assert.deepEqual(facts.stars, ["./more.ts"]);
  assert.deepEqual(facts.reexports.get("y"), { from: "./other.ts", imported: "x" });
  assert.deepEqual([...facts.compounds.get("Meter")!.parts], [["Part", "Reads"]]);
  assert.equal(facts.compounds.get("Meter")!.root, "Root");
});

it("STATIC-ZERO T3: a conditional handler is a per-instance source (`listens`, `_rHandler`), an in-place one a source", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { sync } from "./chat.ts";
export function Root(props) { return <div onScroll={props.track ? (e) => sync(e.currentTarget) : undefined}>{props.children}</div>; }
export function Forward(props) { return <button type="button" onClick={props.onClick}>{props.label}</button>; }
function go() {}
const run = () => 1;
export function Literal() { return <p><a onClick={() => 1}>a</a><b onClick={go}>b</b><i onClick={run}>c</i></p>; }
export function Mixed(props) { return <p onClick={() => 1} onPointerEnter={props.onEnter}>x</p>; }
`;
  const facts = moduleFacts(source, "m.tsx", { boundaries: true });
  const b = (name: string) => facts.boundaries.get(name)!;
  assert.deepEqual(
    ["Root", "Forward", "Literal", "Mixed"].map((n) => [n, b(n).source, b(n).listens]),
    [
      ["Root", false, true],
      ["Forward", false, true],
      ["Literal", true, false],
      ["Mixed", true, true],
    ],
  );
  const out = server(source);
  assert.deepEqual(out.diagnostics, []);
  // The value is recorded under the boundary token; a type the loader does not delegate by default rides along and
  // leaves the static `_rB` events list.
  assert.ok(out.code.includes('__rivetR_handler(__rivetB, props.track ? (e) => sync(e.currentTarget) : undefined, "scroll")'), out.code);
  assert.ok(out.code.includes('__rivetR_b("src/m.tsx#Root", 2)'), out.code);
  // D5 (ZERO R2): every conditional handler names its type (default delegated ones too): the record's listened types.
  assert.ok(out.code.includes('__rivetR_handler(__rivetB, props.onClick, "click")'), out.code);
  assert.ok(out.code.includes('__rivetR_b("src/m.tsx#Mixed", 2, undefined, "click")'), out.code);
  assert.ok(out.code.includes('__rivetR_handler(__rivetB, props.onEnter, "pointerenter")'), out.code);
  assert.ok(!/__rivetR_handler\(__rivetB, (go|run)\b/.test(out.code), out.code);
  assert.ok(
    out.code.includes(
      "import { _rB as __rivetR_b, _rBOut as __rivetR_bOut, _rBEnd as __rivetR_bEnd, _rBAttr as __rivetR_bAttr, _rHandler as __rivetR_handler }",
    ),
    out.code,
  );
  // DOM target: unchanged handlers.
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.ok(!dom.code.includes("_rHandler"), dom.code);
});

it("STATIC-ZERO T1: module data (literal trees, asset imports) is not browser state", () => {
  const facts = moduleFacts(
    `
import icon from "./bell.png?image";
import data from "./rows.json";
import { store } from "./state.ts";
const items = [{ src: icon.src, title: "a" }, { src: \`/x/\${1 + 2}\`, title: "b" }];
const live = [{ v: store }];
let mode = "a";
export function List() { return <ul>{items.map((i) => <li><img src={i.src} alt={i.title} /></li>)}</ul>; }
export function Img() { return <img src={icon.src} alt={data.title} />; }
export function Live() { return <p>{live.map((x) => x.v.n)}</p>; }
export function Let() { return <p>{mode.toUpperCase()}</p>; }
`,
    "m.tsx",
    { boundaries: true },
  );
  const b = (name: string) => facts.boundaries.get(name)!;
  assert.deepEqual(
    ["List", "Img", "Live", "Let"].map((n) => [n, b(n).source]),
    [
      ["List", false],
      ["Img", false],
      ["Live", true],
      ["Let", true],
    ],
  );
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
  const out = server(source);
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
  const checked = check(source, { filename: "m.tsx", resume });
  assert.deepEqual(
    checked.diagnostics.map((d) => [d.code, d.severity, d.targets]),
    [
      ["RV2103", "error", ["server"]],
      ["RV2104", "warning", ["server"]],
    ],
  );
  // Without resume neither applies.
  assert.deepEqual(compile(source, { target: "server", filename: "m.tsx" }).diagnostics, []);
});

it("option validation: RV7001 for a malformed resume option / non-string verdict lists", () => {
  assert.deepEqual(
    compile(COUNTER, { target: "server", filename: "m.tsx", resume: 1 as never }).diagnostics.map((d) => [d.code, d.message]),
    [["RV7001", "Invalid compiler option `resume`: expected `{ module?, boundaries?, independent?, conditional? }`, true or false"]],
  );
  assert.deepEqual(
    server(COUNTER, { boundaries: [1] }).diagnostics.map((d) => d.code),
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
  const out = server(source);
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

it("ZERO A1: `resume.static` components carry no slot markers; `componentValues` lists components used as values", () => {
  const SOURCE = `
import { Card } from "./card.tsx";
export function List(props) {
  return <ul><li>{props.a}</li><Card title={props.b} /><Item /></ul>;
}
function Item() { const n = 2; return <li>{n}<b>{n}</b></li>; }
export const table = { card: Card, item: Item };
`;
  const marked = server(SOURCE, { boundaries: [], independent: [] }).code;
  assert.match(marked, /<!--\[-->/);
  const plain = server(SOURCE, { boundaries: [], independent: [], static: ["List", "Item"] }).code;
  assert.ok(!plain.includes("<!--["), plain);
  // Only the listed component loses its markers.
  const one = server(SOURCE, { boundaries: [], independent: [], static: ["Item"] }).code;
  assert.match(one, /<\/li><!--\[-->/);
  const pairs = (code: string) => code.split("<!--[-->").length - 1;
  assert.deepEqual([pairs(marked), pairs(one), pairs(plain)], [3, 2, 0]);
  const facts = moduleFacts(SOURCE, "m.tsx", { boundaries: true });
  assert.deepEqual(facts.componentValues?.sort(), ["Card", "Item"]);
  // JSX tags, exports, `typeof` and compound parts are no value uses.
  const compound = moduleFacts(
    `function Root() { return <p/>; }\nfunction Part() { return <i/>; }\nexport const Menu = Object.assign(Root, { Part });\nexport { Root };\nexport default function Page() { return typeof Root === "function" ? <Menu.Part /> : <Root />; }`,
    "c.tsx",
    { boundaries: true },
  );
  assert.deepEqual(compound.componentValues, []);
});

it("ZERO A2: never-written const signals and signals in static components are not keyed; literal children fold into the template", () => {
  const SOURCE = `
import { signal } from "@rivetjs/reactivity";
export function Pane() {
  const fixed = signal(1);
  const count = signal(0);
  const passed = signal(2);
  const stamp = signal(Date.now());
  use(passed);
  return <button onClick={() => count.set(count() + 1)}>{fixed()} {count()} {passed()} {stamp()} {"Hello"} {42} {true}</button>;
}
function Quiet() { const s = signal(3); s.set(4); return <i>{s()}</i>; }
export function Page() { return <div><Pane /><Quiet /></div>; }
`;
  const out = server(SOURCE, { boundaries: ["Pane"], independent: [] }).code;
  const keys = (code: string) => (code.match(/__rivetR_sig\(/g) ?? []).length;
  // `count` (written), `passed` (escapes into `use`) and `stamp` (non-literal init) keep keys; `fixed` is only read.
  assert.equal(keys(out), 4, out);
  const quiet = server(SOURCE, { boundaries: ["Pane"], independent: [], static: ["Quiet"] }).code;
  assert.equal(keys(quiet), 3, quiet);
  assert.match(out, /Hello/);
  assert.ok(!/"Hello"\)|_escape\("Hello"/.test(out), out);
  const client = compile(SOURCE, { target: "dom", filename: "m.tsx", resume: { module: "m.tsx", boundaries: ["Pane"], independent: [] } }).code;
  assert.match(client, /Hello/);
  assert.equal((client.match(/_sig\("/g) ?? []).length, 4, client);
});

it("ZERO A3: keyed state over a syntactic data literal carries LIT (server only, BE-STATE S1)", () => {
  const SOURCE = `
import { signal } from "@rivetjs/reactivity";
import { createStore } from "@rivetjs/reactivity/store";
const START = { a: [1, "x"] };
export function Pane(props) {
  const a = signal(0);
  const b = signal([1, { c: "d" }], { equals: false });
  const c = signal(START);
  const d = signal(props.start);
  const e = signal();
  const f = signal(-1,);
  const s = createStore({ open: false });
  const t = createStore(props.items);
  return <button onClick={() => { a.set(1); b.set([]); c.set(null); d.set(1); e.set(1); f.set(2); s.open = true; t.x = 1; }}>{a()}{d()}</button>;
}
`;
  const out = server(SOURCE, { boundaries: ["Pane"], independent: [] });
  assert.deepEqual(out.diagnostics, []);
  const code = out.code.replace(/\s+/g, " ");
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-0", 0, undefined, 1\)/);
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-1", \[1, \{ c: "d" \}\], \{ equals: false \}, 1\)/);
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-2", START, undefined, 1\)/);
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-3", props\.start\)/);
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-4", undefined, undefined, 1\)/);
  assert.match(code, /__rivetR_sig\("[0-9a-z]{5}-5", -1, undefined, 1,? ?\)/);
  assert.match(code, /__rivetR_sigStore\("[0-9a-z]{5}-6", \{ open: false \}, 1\)/);
  assert.match(code, /__rivetR_sigStore\("[0-9a-z]{5}-7", props\.items\)/);
  // The DOM target keeps `_sig(key, init)`: an absent key already means the init.
  const client = compile(SOURCE, { target: "dom", filename: "m.tsx", resume: { module: "m.tsx", boundaries: ["Pane"], independent: [] } }).code;
  assert.ok(!client.includes("undefined, 1)") && !/false \}, 1\)/.test(client.replace(/\s+/g, " ")), client);
});

it("ZERO C3: call sites passing plain values over pure module data are data; a pure module const is no source", () => {
  const facts = (source: string) => {
    const f = moduleFacts(source, "m.tsx", { boundaries: true });
    return Object.fromEntries([...f.boundaries].map(([name, c]) => [name, { source: c.source, data: c.calls.map((call) => call.data) }]));
  };
  const LIST = `
import { Card } from "./card.tsx";
const books = Array.from({ length: 3 }, (_, i) => ({ title: "Book " + i }));
const COLORS = ["a", "b"];
export default function Home() {
  return <ul>{books.map((b, i) => <Card title={b.title} n={i + 1} label={\`#\${i}\`} color={COLORS[i % 2]} />)}</ul>;
}`;
  assert.deepEqual(facts(LIST), { Home: { source: false, data: [true] } });
  // Reactive or unknown roots stay non-data: an import (a store / signal may hide behind it), a component local, a prop.
  const cases = {
    imported: `import { Card } from "./card.tsx";\nimport { books } from "./books.ts";\nexport function Home() { return <ul>{books.map((b) => <Card title={b.title} />)}</ul>; }`,
    store: `import { Card } from "./card.tsx";\nimport { createStore } from "@rivetjs/reactivity/store";\nconst books = createStore([{ title: "x" }]);\nexport function Home() { return <ul>{books.map((b) => <Card title={b.title} />)}</ul>; }`,
    local: `import { Card } from "./card.tsx";\nexport function Home() { const xs = [{ t: "a" }]; return <ul>{xs.map((b) => <Card title={b.t} />)}</ul>; }`,
    prop: `import { Card } from "./card.tsx";\nexport function Home(props) { return <ul>{props.items.map((b) => <Card title={b.t} />)}</ul>; }`,
    call: `import { Card } from "./card.tsx";\nconst books = [{ t: "a" }];\nexport function Home() { return <ul>{books.map((b) => <Card title={b.t.toUpperCase()} />)}</ul>; }`,
  };
  for (const [name, source] of Object.entries(cases)) assert.deepEqual(facts(source).Home!.data, [false], name);
});
