// G26: resume capture bugs — fragment-rooted const arrows (K5), R2 symbol extraction for function
// expressions in object literals / return values / component props (K1), conditional slot props (G25).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "a.tsx" };
const server = (source: string) => compile(source, { target: "server", filename: "a.tsx", resume });
const dom = (source: string) => compile(source, { target: "dom", filename: "a.tsx", resume });
const clean = (source: string) => {
  const [s, d] = [server(source), dom(source)];
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual(d.diagnostics, []);
  assert.deepEqual(s.symbols!.map((x) => x.id), d.symbols!.map((x) => x.id));
  return { server: s, dom: d };
};
const head = `import { signal } from "@rivetjs/reactivity";\nimport { MenuTrigger } from "./menu";\n`;

test("K5: fragment-rooted component wraps a const arrow passed to a component prop", () => {
  const { server: s, dom: d } = clean(
    head +
      `export function E() { const last = signal(""); const onAction = (k) => last.set(k); return <><MenuTrigger label="x" items={[]} onAction={onAction} /><p>{last()}</p></>; }`,
  );
  assert.match(s.code, /const onAction = __rivetR_fn\("a\.tsx#E\$\w+", \(k\) => last\.set\(k\), \[last\]\)/);
  assert.equal(d.symbols![0]!.kind, "fn");
});

test("K5: component element as the returned root, and in a nested fragment, wraps const arrows", () => {
  const { server: s } = clean(
    head +
      `export function R() { const last = signal(""); const go = (k) => last.set(k); return <MenuTrigger onAction={go} />; }
export function N() { const n = signal(0); const inc = () => n.set(n() + 1); return <><><MenuTrigger onAction={inc} /></></>; }`,
  );
  assert.match(s.code, /const go = __rivetR_fn\("a\.tsx#R\$\w+"/);
  assert.match(s.code, /const inc = __rivetR_fn\("a\.tsx#N\$\w+"/);
});

test("K5: element-rooted output is unchanged (already captured by the region)", () => {
  const { server: s } = clean(
    head +
      `export function E() { const last = signal(""); const onAction = (k) => last.set(k); return <section><MenuTrigger onAction={onAction} /><p>{last()}</p></section>; }`,
  );
  assert.equal(s.symbols!.map((x) => x.kind).join(), "fn,region,bind");
});

test("K1: inline function component prop becomes a symbol with captures", () => {
  const { server: s, dom: d } = clean(
    head + `export function P() { const last = signal(""); return <><MenuTrigger onAction={(k) => last.set(k)} /><p>{last()}</p></>; }`,
  );
  assert.match(s.code, /"onAction": __rivetR_fn\("a\.tsx#P\$\w+", \(k\) => last\.set\(k\), \[last\]\)/);
  const [fn] = d.symbols!;
  assert.equal(fn!.kind, "fn");
  assert.deepEqual(fn!.captures, ["last"]);
  assert.match(fn!.source, /export const P\$\w+ = \(last\) => \(\(k\) => last\.set\(k\)\);/);
});

test("K1: function expressions in object literals and return values become symbols", () => {
  const { server: s, dom: d } = clean(
    head +
      `function useCounter(step) { const n = signal(0); return { n, bind: { onClick: () => n.set(n() + step) } }; }
function useToggle() { const on = signal(false); return () => on.set(!on()); }
export function B() { const c = useCounter(2); const flip = useToggle(); return <><MenuTrigger bag={{ onKeyDown: function (e) { c.n.set(e.key.length); } }} onFlip={flip} /><p>{c.n()}</p></>; }`,
  );
  assert.match(s.code, /onClick: __rivetR_fn\("a\.tsx#useCounter\$\w+", \(\) => n\.set\(n\(\) \+ step\), \[n, step\]\)/);
  assert.match(s.code, /return __rivetR_fn\("a\.tsx#useToggle\$\w+", \(\) => on\.set\(!on\(\)\), \[on\]\)/);
  assert.match(s.code, /onKeyDown: __rivetR_fn\("a\.tsx#B\$\w+", function ?\(e\)/);
  assert.deepEqual(
    d.symbols!.map((x) => [x.id, x.kind, x.captures.join()]),
    [
      ["a.tsx#useCounter$gyn", "fn", "n,step"],
      ["a.tsx#useToggle$4r7", "fn", "on"],
      ["a.tsx#B$hp2", "fn", "c"],
      ["a.tsx#B$3n6", "bind", "c"],
    ],
  );
});

test("K1: not extracted — module scope, browser-only closures, methods, `this`, argument positions", () => {
  const { server: s } = clean(
    head +
      `const table = { a: () => 1 };
export function M() {
  const n = signal(0);
  const self = { count: 0, bump() { this.count++; }, inc: function () { return this.count; } };
  const ids = [1, 2].map((x) => x * 2);
  self.bump();
  return <button onClick={() => { const o = { f: () => n.set(1) }; o.f(); }} data-x={table.a()}>{n()}{ids.length}</button>;
}`,
  );
  assert.doesNotMatch(s.code, /__rivetR_fn/);
});

test("K1: an extracted function capturing a class instance compiles (serialization fails only if it is captured)", () => {
  const { server: s } = clean(
    head + `class Store { n = 0; }\nexport function C() { const store = new Store(); return <MenuTrigger onAction={() => store.n++} />; }`,
  );
  assert.match(s.code, /__rivetR_fn\("a\.tsx#C\$\w+", \(\) => store\.n\+\+, \[store\]\)/);
});

test("K1: components imported from @rivetjs/* keep plain function props", () => {
  const { server: s } = clean(
    `import { signal } from "@rivetjs/reactivity";\nimport { For } from "@rivetjs/runtime/server";
export function L() { const items = signal([1]); return <ul><For each={items}>{(i) => <li>{i}</li>}</For></ul>; }`,
  );
  assert.doesNotMatch(s.code, /__rivetR_fn/);
});

test("G25 b: conditional JSX function props and children become slot symbols", () => {
  const { server: s, dom: d } = clean(
    `import { signal } from "@rivetjs/reactivity";
function Toggle(props) { const open = signal(false); return <div class={(props.header ? "h" : "n") + (open() ? " o" : "")} />; }
export function Page() { const on = signal(true); return <><Toggle header={on() ? () => <h2>H</h2> : undefined} footer={on() && (() => <i>F</i>)} /><Toggle>{on() ? () => <b>C</b> : null}</Toggle></>; }`,
  );
  const slots = d.symbols!.filter((x) => x.kind === "slot");
  assert.equal(slots.length, 3);
  // Live props recipes (LIVE-PROPS P3): the dynamic props are getters of an `_rProps` object.
  assert.match(s.code, /__rivetPropsGetter\(o, "header", 0\);\s*__rivetPropsGetter\(o, "footer", 1\);/);
  assert.match(s.code, /\$rivetKey === 0 \? on\(\) \? __rivetR_fn\("a\.tsx#Page\$\w+", \(\) => [\s\S]* : on\(\) && __rivetR_fn\(/);
});

test("G25 a: conditional r:slot child lowers to a conditional slot prop (all targets)", () => {
  const source = `function Card(props) { return <div class={props.header ? "a" : "b"}><slot r:name="header" /><slot /></div>; }
export function Page(props) { return <Card>{props.on && <h2 r:slot="header">H</h2>}body</Card>; }
export function Alt(props) { return <Card>{props.on ? null : <h2 r:slot="header">A</h2>}{props.x ? <i r:slot="footer">X</i> : <b r:slot="footer">Y</b>}</Card>; }`;
  for (const target of ["server", "dom"] as const) {
    const out = compile(source, { target, filename: "a.tsx" });
    assert.deepEqual(out.diagnostics, [], target);
  }
  const plain = compile(source, { target: "server", filename: "a.tsx" });
  assert.match(plain.code, /"header": props\.on \? \(\(\) => __rivetTemplate\(__rivetFragments1, \[\]\)\) : void 0/);
  assert.match(plain.code, /"header": props\.on \? void 0 : \(\(\) => /);
  assert.match(plain.code, /"footer": props\.x \? \(\(\) => __rivetTemplate\(__rivetFragments3, \[\]\)\) : \(\(\) => __rivetTemplate\(__rivetFragments4/);
  const { server: s, dom: d } = clean(source);
  assert.equal(d.symbols!.filter((x) => x.kind === "slot").length, 4);
  // CORE-GAPS (c): `props.on` is a live-props read, so Page's Card call is a props recipe (`header` a getter).
  assert.match(s.code, /\$rivetKey === 0 \? props\.on \? __rivetR_fn\("a\.tsx#Page\$\w+", \(\) => __rivetTemplate/);
});

test("G25 a: a conditional r:slot child and a direct one of the same name conflict", () => {
  const out = compile(
    `function Card(props) { return <div><slot r:name="header" /></div>; }
export function Page(props) { return <Card><h2 r:slot="header">A</h2>{props.on && <h2 r:slot="header">B</h2>}</Card>; }`,
    { target: "dom", filename: "a.tsx" },
  );
  assert.deepEqual(out.diagnostics.map((d) => d.message), ['slot "header" is passed more than once']);
});

test("K2: functions in an inline spread object are symbols; the spread site keeps its own symbol", () => {
  const { server: s, dom: d } = clean(
    `import { signal } from "@rivetjs/reactivity";\nexport function S() { const n = signal(0); return <button {...{ "data-n": n(), onClick: () => n.set(n() + 1) }}>x</button>; }`,
  );
  assert.match(s.code, /onClick: __rivetR_fn\("a\.tsx#S\$\w+", \(\) => n\.set\(n\(\) \+ 1\), \[n\]\)/);
  assert.deepEqual(d.symbols!.map((x) => x.kind), ["spread", "fn"]);
});

test("K1: components of the UI source packages (@rivetjs/cdk) get symbol callback props", () => {
  // `sourcePackages` as rivet() (vite.ts) passes it for modules importing those packages.
  const source = `import { signal } from "@rivetjs/reactivity";\nimport { Button } from "@rivetjs/cdk/button";
export function A() { const n = signal(0); return <><Button onPress={() => n.set(n() + 1)}>+</Button><p>{n()}</p></>; }`;
  const s = compile(source, { target: "server", filename: "a.tsx", resume, sourcePackages: ["@rivetjs/cdk"] });
  assert.deepEqual(s.diagnostics, []);
  assert.match(s.code, /"onPress": __rivetR_fn\("a\.tsx#A\$\w+"/);
});

test("type + value of one name (`type C` + `const C`): symbols reference the value; the module re-exports it", () => {
  const { dom: d } = clean(
    `import { createContext, useContext } from "@rivetjs/reactivity";\ntype C = { a?: number };\nconst C = createContext<C>({});\n` +
      `export function P() { return <div onClick={() => useContext(C)}>x</div>; }`,
  );
  const sym = d.symbols!.find((s) => s.source.includes("useContext(C)"))!;
  assert.ok(sym, "click handler symbol");
  assert.ok(sym.locals.includes("C"), `locals: ${sym.locals.join()}`);
  assert.match(d.code, /export \{[^}]*\bC\b[^}]*\};/);
});
