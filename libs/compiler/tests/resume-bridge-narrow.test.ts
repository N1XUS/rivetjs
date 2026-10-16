// Function Bridge T11 (C7): member-only captures are narrowed for handlers and bindings too.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const run = (call: string, target: "server" | "dom") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); const store = { count: n, blob: "BIG", inc() { this.count.set(this.count() + 1); } };
  return <button onClick={() => ${call}}>{n()}</button>; }`,
    { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never,
  ) as { code: string; symbols: { kind: string; captures: string[]; source: string }[] };

test("a handler reading store.count captures that path only", () => {
  assert.match(run("store.count.set(store.count() + 1)", "server").code, /__rivetR_member\(store, "count"\)/);
  const handler = run("store.count.set(store.count() + 1)", "dom").symbols.find((s) => s.captures.includes("store$count"))!;
  assert.match(handler.source, /const store = \{ count: store\$count \};/);
});

test("a method call keeps the whole object", () => {
  const server = run("store.inc()", "server").code;
  assert.doesNotMatch(server, /__rivetR_member\(store/);
});

// Beyond the brief: which objects narrow, and how the symbols rebuild them.
const compiled = (source: string, target: "server" | "dom" = "server") =>
  compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as {
    code: string;
    symbols: { captures: string[]; source: string }[];
  };
const flat = (source: string) => compiled(source).code.replace(/\s+/g, " ");
const sources = (source: string) =>
  compiled(source, "dom")
    .symbols.map((s) => s.source)
    .join("\n")
    .replace(/\s+/g, " ");
const page = (setup: string, jsx: string) => `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); ${setup}
  return ${jsx}; }`;

test("narrow-object: the big field is not captured; bindings narrow too; the prologue is a plain object", () => {
  const source = page(`const store = { count: n, blob: "BIGDATA" };`, `<button onClick={() => store.count.set(store.count() + 1)}>{store.count()}</button>`);
  const code = flat(source);
  assert.match(code, /__rivetR_on\("click", "src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \[__rivetR_member\(store, "count"\)\]\)/);
  assert.match(code, /__rivetR_bind\("src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \(\) => store\.count\(\), \[__rivetR_member\(store, "count"\)\]\)/);
  const text = sources(source);
  assert.match(text, /\(store\$count\) => \{ const store = \{ count: store\$count \}; return \(\(\) => store\.count\.set\(store\.count\(\) \+ 1\)\); \}/);
  assert.doesNotMatch(text, /__rivetMembers/);
});

test("the whole object stays captured when it escapes, is written, spread, iterated or has an accessor", () => {
  const whole = (setup: string, call: string) =>
    assert.doesNotMatch(flat(page(setup, `<button onClick={() => ${call}}>{n()}</button>`)), /__rivetR_member\(store/, setup + " / " + call);
  whole(`const store = { count: n };`, `use(store)`);
  whole(`const store = { count: n }; store.count = signal(1);`, `store.count.set(1)`);
  whole(`const store = { count: n }; const copy = { ...store };`, `store.count.set(copy.count())`);
  whole(`const store = { count: n }; for (const k in store) void k;`, `store.count.set(1)`);
  whole(`const store = { count: n, get twice() { return n() * 2; } };`, `n.set(store.twice)`);
  whole(`const store = { count: n, inc() { this.count = signal(9); } };`, `store.count.set(1)`);
  whole(`const store = { count: n };`, `store?.count.set(1)`);
  whole(`const store = { count: n };`, `store["co" + "unt"].set(1)`);
  whole(`let store = { count: n };`, `store.count.set(1)`);
  whole(`const store = makeStore();`, `store.count.set(1)`);
});

test("fix round 1: a called key narrows only when its value is this-free; only own keys narrow", () => {
  const ext = (setup: string, call: string) =>
    flat(`import { signal } from "@rivetjs/reactivity";\nimport { ext } from "./x.ts";\nexport function Page() { const n = signal(0); ${setup}
  return <button onClick={() => ${call}}>{n()}</button>; }`);
  // Review H1: `this` would be the rebuilt object.
  for (const setup of [
    `const inc = function () { this.count.set(this.count() + 1); }; const store = { count: n, inc };`,
    `const store = { count: n, inc: ext };`,
    `const base = { inc() { this.count.set(1); } }; const store = { count: n, inc: base.inc };`,
    `const store = { count: n, inc: make() };`,
    `const store = { count: n, inc() { n.set(1); } };`,
  ])
    assert.match(ext(setup, `store.inc()`), /__rivetR_on\("click", "src\/a\.tsx#Page\$\w+", \[store\]\)/, setup);
  // Review H2: inherited / undeclared keys and `__proto__` literals.
  assert.match(ext(`const store = { count: n };`, `n.set(store.hasOwnProperty("count") ? 1 : 0)`), /\[n, store\]/);
  assert.match(ext(`const store = { count: n };`, `n.set(store.missing ? 1 : 0)`), /\[n, store\]/);
  assert.match(ext(`const store = { __proto__: { inc() { this.count.set(1); } }, count: n };`, `store.inc()`), /\[store\]/);
  // This-free called values still narrow: arrows, const arrows, reactivity primitives.
  assert.match(ext(`const store = { count: n, f: () => n.set(1) };`, `store.f()`), /\[__rivetR_member\(store, "f"\)\]/);
  assert.match(ext(`const g = () => n.set(1); const store = { count: n, g };`, `store.g()`), /\[__rivetR_member\(store, "g"\)\]/);
  assert.match(ext(`const store = { count: signal(1) };`, `n.set(store.count())`), /\[n, __rivetR_member\(store, "count"\)\]/);
});

test("props narrow per called member for handlers (forward boxes through __rivetMembers); other reads keep the whole props", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { onPress: () => void; onClose: () => void }) {
  const out = signal("");
  return <button onClick={() => { props.onPress(); props.onClose(); }}>{out()}</button>;
}`;
  assert.match(flat(source), /\[ ?__rivetR_member\(props, "onPress"\), __rivetR_member\(props, "onClose"\) ?\]/);
  assert.match(
    sources(source),
    /\(props\$onPress, props\$onClose\) => \{ const props = __rivetMembers\(\{ onPress: props\$onPress, onClose: props\$onClose \}\); return/,
  );
  // A non-called read may be an object value: a constant getter's member capture would serialize it by value (runtime
  // forwardSources), the whole props object serializes as its recipe (corpus narrow-props, narrow-props-object; T12).
  for (const read of [`"id" + props.item.id`, `JSON.stringify(props.item)`, `props.label`]) {
    const other = `import { signal } from "@rivetjs/reactivity";
export function Card(props: any) {
  const out = signal("");
  return <button onClick={() => out.set(${read})}>{out()}</button>;
}`;
    assert.match(flat(other), /__rivetR_on\("click", "src\/a\.tsx#Card\$\w+", \[out, props\]\)/, read);
  }
});

test("an Fn symbol narrows too; a boxed let holding an object is not narrowed", () => {
  const fn = flat(
    page(`const store = { count: n, blob: "B" }; const inc = () => store.count.set(store.count() + 1);`, `<button onClick={() => inc()}>{n()}</button>`),
  );
  assert.match(
    fn,
    /const inc = __rivetR_fn\("src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \(\) => store\.count\.set\(store\.count\(\) \+ 1\), \[__rivetR_member\(store, "count"\)\]\)/,
  );
  const boxed = flat(
    page(
      `let store = { count: n }; const swap = () => { store = { count: signal(5) }; };`,
      `<button onClick={() => { swap(); store.count.set(1); }}>{n()}</button>`,
    ),
  );
  assert.match(boxed, /const store = __rivetR_cell\(/);
  assert.doesNotMatch(boxed, /__rivetR_member\(store/);
});
