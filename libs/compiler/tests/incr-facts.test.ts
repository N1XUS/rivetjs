// INCR2: `$incr` facts of proven `<For>` lists (`rust/src/compile/incr.rs`, opt-in `incr`, server target, resume on) —
// the proof's accepted shapes, the generated `v` / `c` / `s` / `x`, and the shapes it refuses (no fact: unchanged output).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const IMPORTS = `import { signal } from "@rivetjs/reactivity";\nimport { For, Show } from "@rivetjs/runtime/dom";\n`;
const page = (row: string, extra = "", by = "(r) => r.id") => `${IMPORTS}${extra}
export default function List(props) {
  const filter = signal("");
  return <ul><For each={() => props.rows} by={${by}}>{${row}}</For></ul>;
}
`;
const server = (source: string, options: object = {}) =>
  compile(source, { target: "server", filename: "m.tsx", resume: { module: "src/m.tsx" }, incr: true, ...options });
const fact = (source: string, options: object = {}): string | null => {
  // (Refused shapes may carry their own diagnostics, e.g. RV2103 for `Date.now()`.)
  const out = server(source, options);
  const m = /const __rivetIncr\d+ = \/\* @__PURE__ \*\/ __rivetIncrSite\((\{[\s\S]*?\n\})\);/.exec(out.code);
  if (!m) {
    assert.ok(!out.code.includes('"$incr"'), "a $incr prop without its fact");
    return null;
  }
  assert.match(out.code, /"\$incr": __rivetIncr\d+/);
  assert.match(out.code, /import \{ _incrSite as __rivetIncrSite \} from "@rivetjs\/runtime\/server-incr";/);
  // One line: the codegen's layout folded (`{ i: …, v: (a) => [a.x], … }`).
  return m[1]!.replace(/\s+/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]");
};

test("block-body row with a keyed local signal: paths in read order + the key path, keyed state, no index", () => {
  const row = `(row) => {
    const open = signal(false);
    return <li class={row().done ? "done" : "todo"}><b>{row().title}</b> {row().owner}<button onClick={() => open.update((v) => !v)}>{open() ? "Hide" : "Show"}</button></li>;
  }`;
  const f = fact(page(row));
  assert.ok(f);
  assert.match(
    f,
    /^\{ i: "src\/m\.tsx#0", v: \(a\) => \[a\.done, a\.title, a\.owner, a\.id\], c: \(a, s\) => a\.done === s\[0\] && a\.title === s\[1\] && a\.owner === s\[2\] && a\.id === s\[3\], s: \["[0-9a-z]{5}-\d+", false\], x: 0 \}$/,
  );
  // Functions of the fact behave: `c(item, v(item))`.
  const value = (0, eval)("(" + f + ")") as { v(a: unknown): unknown[]; c(a: unknown, s: unknown[]): boolean };
  const item = { id: "1", title: "t", owner: "o", done: true };
  assert.equal(value.c(item, value.v(item)), true);
  assert.equal(value.c({ ...item, title: "u" }, value.v(item)), false);
});

test("expression body: index, templates, optional and nested paths, key path union", () => {
  const f = fact(page("(row, i) => <li data-i={i()} title={`${row()?.user.name}!`}>{row().n + 1}</li>", "", "(r) => r.meta.key"));
  assert.ok(f);
  assert.match(f, /v: \(a\) => \[a\?\.user\.name, a\.n, a\.meta\.key\]/);
  assert.match(f, /s: \[\], x: 1 \}$/);
  // A frozen (never written) local signal is no keyed state.
  const g = fact(page("(row) => { const k = signal(1); return <li>{k() + row().n}</li>; }"));
  assert.ok(g);
  assert.match(g, /s: \[\]/);
});

test("site ids count the module's proven lists", () => {
  const source = `${IMPORTS}export default function L(props) {
  return <div><ul><For each={() => props.a} by={(r) => r.id}>{(row) => <li>{row().x}</li>}</For></ul><ul><For each={() => props.b} by={(r) => r.id}>{(row) => <li>{row().y}</li>}</For></ul></div>;
}`;
  const code = server(source).code;
  assert.match(code, /i: "src\/m\.tsx#0"/);
  assert.match(code, /i: "src\/m\.tsx#1"/);
});

test("off by default, DOM target and non-resume compiles: no fact", () => {
  const source = page("(row) => <li>{row().title}</li>");
  assert.ok(fact(source));
  assert.equal(fact(source, { incr: false }), null);
  assert.equal(fact(source, { incr: undefined }), null);
  assert.equal(fact(source, { resume: undefined }), null);
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume: { module: "src/m.tsx" }, incr: true });
  assert.ok(!dom.code.includes("$incr") && !dom.code.includes("__rivetIncr") && !dom.code.includes("server-incr"));
  // Without a proof the output is the incr-off output.
  const refused = page("(row) => <li>{filter()}{row().title}</li>");
  assert.equal(server(refused).code, server(refused, { incr: false }).code);
  assert.ok(!server(refused).code.includes("server-incr"));
});

test("refused rows: outer reads, calls, components, structural children, spreads, raw content, unsafe operators", () => {
  const refused: [string, string, string?][] = [
    ["outer signal", "(row) => <li>{filter()}{row().title}</li>"],
    ["method call", "(row) => <li>{row().title.toUpperCase()}</li>"],
    ["global call", "(row) => <li>{Date.now()}{row().n}</li>"],
    ["computed member", "(row) => <li>{row()['title']}</li>"],
    ["whole item free identifier", "(row) => <li>{props.x}</li>"],
    ["division", "(row) => <li>{row().n / 2}</li>"],
    ["remainder", "(row) => <li>{row().n % 2}</li>"],
    ["in", "(row) => <li>{'a' in row()}</li>"],
    ["component", "(row) => <Item item={row()} />", "function Item(p) { return <li>{p.item.title}</li>; }\n"],
    ["nested Show", "(row) => <li><Show when={row().done}><b>x</b></Show></li>"],
    ["conditional JSX", "(row) => <li>{row().done && <b>x</b>}</li>"],
    ["fragment", "(row) => <><li>{row().title}</li></>"],
    ["spread", "(row) => <li {...row()}>x</li>"],
    ["textarea", "(row) => <li><textarea value={row().title} /></li>"],
    ["svg", "(row) => <li><svg><title>{row().title}</title></svg></li>"],
    ["innerHTML", "(row) => <li innerHTML={row().html} />"],
    ["ref", "(row) => <li ref={(el) => el}>{row().title}</li>"],
    ["handler expression", "(row) => <li onClick={pick(row())}>x</li>", "const pick = (r) => () => r;\n"],
    ["conditional handler", "(row) => <li onClick={row().done ? () => 1 : undefined}>x</li>"],
    ["model binding", "(row) => { const v = signal(''); return <li><input model:value={v} /></li>; }"],
    ["non-literal signal init", "(row) => { const open = signal(row().done); return <li onClick={() => open.set(true)}>{open() ? 1 : 0}</li>; }"],
    ["let local", "(row) => { let n = 1; return <li>{n}</li>; }"],
    ["other statement", "(row) => { console.log(1); return <li>{row().title}</li>; }"],
    ["async callback", "async (row) => <li>{row().title}</li>"],
    ["custom element", "(row) => <my-row>{row().title}</my-row>"],
  ];
  for (const [name, row, extra = ""] of refused) assert.equal(fact(page(row, extra)), null, name);
  assert.equal(fact(page("(row) => <li>{row().title}</li>", "", "(r) => r.id + filter()")), null, "impure key");
  assert.equal(fact(page("(row) => <li>{row().title}</li>", "", "(r) => r[0]")), null, "computed key");
  // A row signal written outside handlers at render would be a write the server makes: not a const signal read.
  assert.equal(fact(page("(row) => { const open = signal(false); open.set(true); return <li>{open()}</li>; }")), null, "render write");
});
