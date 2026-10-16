// TERNARY-MEMO (DOM v2, `dom_v2.rs` `cond_v2`): a conditional child with a JSX operand (`c ? <A/> : <B/>`,
// `c && <A/>`, `||`, `??`, nested) lowers to `_cond(() => test, mode, (v) => …)` — Solid's condition memo: a read
// in the test that does not switch the branch no longer rebuilds the branch's JSX. Shapes (modes, nesting, element
// / sole / fragment / lazy children), what stays unchanged (non-JSX ternaries, static tests, `this`, the server
// target, no `_cond` import when unused) and the runtime behaviour in happy-dom (build counts, `&&` / `||` / `??`
// value semantics = the server's, a non-JSX operand stays live).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile, _compileSymbolModule } from "../index.ts";

const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const reactivity = new URL("../../reactivity/index.ts", import.meta.url).href;
const load = async (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity)),
      ).toString("base64")
  );
const dom = (source: string) => {
  const r = compile(source, { target: "dom", filename: "m.tsx" });
  assert.deepEqual(r.diagnostics, []);
  return r.code;
};
const count = (code: string, needle: string) => code.split(needle).length - 1;
const HEAD = `import { signal } from "@rivetjs/reactivity";\nexport const on = signal(true);\n`;

test("shapes: one `_cond` per conditional with a JSX operand, mode per operator", () => {
  const code = dom(
    HEAD +
      `const Box = (p: any) => <section>{p.children}</section>;
export const A = () => (
  <div>
    <p>{on() ? <b>y</b> : <i>n</i>}</p>
    <p>x{on() && <b>and</b>}y</p>
    <p>{on() || <b>or</b>}</p>
    <p>{(on() ?? null) ?? <b>nullish</b>}</p>
    <p>{on() ? (on() ? <b>a</b> : <b>b</b>) : null}</p>
    {<>f{on() ? <b>frag</b> : null}</>}
    <Box>{on() && <b>lazy</b>}</Box>
  </div>
);`,
  );
  assert.match(code, /__rivet_cond\(\(\) => on\(\), 0, \(__rivetCond\w*\) => \(?__rivetCond\w* \? /);
  assert.match(code, /__rivet_cond\(\(\) => on\(\), 1, \(__rivetCond\w*\) => \(?__rivetCond\w* && /);
  assert.match(code, /__rivet_cond\(\(\) => on\(\), 2, /);
  assert.match(code, /__rivet_cond\(\(\) => \(?on\(\) \?\? null\)?, 3, /);
  // 7 sites + the nested branch.
  assert.equal(count(code, "__rivet_cond("), 8);
  // Fragment and lazy children: `_scoped(_cond(…))`.
  assert.equal(count(code, "__rivet_scoped(__rivet_cond("), 2);
  assert.match(code, /import \{[^}]*_cond as __rivet_cond[^}]*\} from "@rivetjs\/runtime\/dom"/);
});

test("unchanged: non-JSX conditionals, static tests, `this`, no import when unused, server target", () => {
  const plain = dom(
    HEAD +
      `const flag = true;
export const A = () => <div><p>{on() ? "a" : "b"}</p><p>{on() && 1}</p><p>{flag ? <b>s</b> : null}</p><p>{on() ? () => <b>f</b> : null}</p></div>;`,
  );
  assert.equal(count(plain, "_cond"), 0);
  const klass = dom(HEAD + `export class K { on = true; render() { return <p>{this.on ? <b>t</b> : null}</p>; } }`);
  assert.equal(count(klass, "_cond"), 0);
  const server = compile(HEAD + `export const A = () => <p>{on() ? <b>y</b> : <i>n</i>}{on() && <b>z</b>}</p>;`, { target: "server", filename: "m.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.equal(count(server.code, "_cond"), 0);
});

test("runtime: a branch is rebuilt only when the rendered branch changes; operators keep their value semantics", async () => {
  const code = dom(`
import { signal } from "@rivetjs/reactivity";
export const n = signal(1);
export const label = signal<string | null>("");
export let built = 0;
const Leaf = (p: { k: string }) => { built++; return <b class={p.k}>{p.k}</b>; };
export const A = () => (
  <div>
    <p id="t">{n() > 0 ? <Leaf k="pos" /> : <i>neg</i>}</p>
    <p id="a">{n() && <Leaf k="and" />}</p>
    <p id="o">{label() || <Leaf k="or" />}</p>
    <p id="q">x{label() ?? <Leaf k="nullish" />}y</p>
    <p id="v">{n() > 5 ? <Leaf k="big" /> : n()}</p>
    <p id="nest">{n() >= 0 ? (n() % 2 ? <Leaf k="odd" /> : <Leaf k="even" />) : null}</p>
  </div>
);`);
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const m = await load(code);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  const stop = mount(() => m.A(), host);
  const html = (id: string) => host.querySelector("#" + id)!.innerHTML.replace(/<!--.*?-->/g, "");
  const node = (sel: string) => host.querySelector(sel);
  // pos, and, or, nullish (label "" is not nullish: renders ""), odd.
  assert.equal(m.built, 4);
  assert.equal(html("q"), "xy");
  const pos = node(".pos"),
    and = node(".and"),
    or = node(".or");
  m.n.set(3); // same truthiness everywhere; `odd` stays odd
  assert.ok(node(".pos") === pos && node(".and") === and, "?: / && branch kept");
  assert.equal(html("v"), "3");
  assert.equal(m.built, 4);
  m.n.set(4); // nested inner branch switches: odd → even only
  assert.ok(node(".pos") === pos, "outer branch kept");
  assert.equal(html("nest"), '<b class="even">even</b>');
  assert.equal(m.built, 5);
  m.n.set(0); // `&&` renders the falsy test value (server: "0"); `?:` switches
  assert.equal(html("a"), "0");
  assert.equal(html("t"), "<i>neg</i>");
  m.label.set(null); // `||`: "" → null keeps the JSX operand; `??`: null → JSX
  assert.ok(node(".or") === or, "|| branch kept across falsy values");
  assert.equal(html("q"), 'x<b class="nullish">nullish</b>y');
  m.label.set("x"); // truthy value renders itself
  assert.equal(html("o"), "x");
  assert.equal(html("q"), "xxy");
  m.label.set("y");
  assert.equal(html("o"), "y");
  assert.equal(html("q"), "xyy");
  stop();
});

test("resume symbol modules: a binding symbol over a conditional with a JSX operand returns the `_cond` accessor", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function A() {
  const on = signal(true);
  return (
  <div>
    <p>{on() ? <b>y</b> : <i>n</i>}</p>
    <p>{on() && <b>and</b>}</p>
    <p>{on() ? "a" : "b"}</p>
    <p>{on() ? <b>{on() ? "x" : "y"}</b> : null}</p>
  </div>
  );
}`;
  const resumed = compile(source, { target: "dom", filename: "m.tsx", resume: { module: "src/m.tsx" } } as never) as unknown as {
    diagnostics: unknown[];
    symbols: { source: string; kind: string }[];
  };
  assert.deepEqual(resumed.diagnostics, []);
  const code = _compileSymbolModule(resumed.symbols as never, "/m.js");
  // `?:` and `&&` with JSX: the symbol returns the accessor; a JSX-free ternary stays a plain read.
  assert.match(code, /export const A\$\w+ = \(on\) => __rivet_cond\(\(\) => on\(\), 0, /);
  assert.match(code, /export const A\$\w+ = \(on\) => __rivet_cond\(\(\) => on\(\), 1, /);
  assert.match(code, /export const A\$\w+ = \(on\) => \(\) => on\(\) \? "a" : "b"/);
  // Plain compiles (not a symbol module) keep `() => (cond)` arrows as they are.
  const plain = dom(
    `import { signal } from "@rivetjs/reactivity";\nconst on = signal(true);\nexport const f = (x: unknown) => () => (on() ? <b>y</b> : null);`,
  );
  assert.equal(count(plain, "_cond"), 0);
});
