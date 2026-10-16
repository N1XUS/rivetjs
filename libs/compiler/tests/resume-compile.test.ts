import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/m.tsx" };
const both = (source: string) => (["server", "dom"] as const).map((target) => compile(source, { target, filename: "m.tsx", resume }));
const messages = (source: string, target: "server" | "dom" = "server") =>
  compile(source, { target, filename: "m.tsx", resume }).diagnostics.map((d) => d.message);

test("captures are enclosing-function locals in first-use order; module scope is referenced, not captured", () => {
  const [, dom] = both(`
import { signal } from "@rivetjs/reactivity";
const scale = 2;
function helper(n: number) { return n * scale; }
export function View({ a, b: renamed }: { a: number; b: number }, other: number) {
  const s = signal(0);
  { const inner = 1;
    return <div>
      <button onClick={(event) => { const local = event; s.set(helper(a + renamed + inner + other)); return local; }}>x</button>
      <i title={String(s() + a)}>{s()}</i>
    </div>; }
}`);
  assert.deepEqual(dom.diagnostics, []);
  const [click, title, text] = dom.symbols!;
  assert.deepEqual(click.captures, ["s", "a", "renamed", "inner", "other"]);
  assert.deepEqual(click.scope, ["helper"]);
  assert.deepEqual(title.captures, ["s", "a"]);
  assert.deepEqual(title.scope, []);
  assert.deepEqual(text.captures, ["s"]);
  assert.match(dom.code, /export \{ helper \};\n$/);
});

test("server and DOM agree on symbol names and ids in source order", () => {
  const source = `
import { signal, computed } from "@rivetjs/reactivity";
import { clientEffect, clientEvent } from "@rivetjs/runtime/dom";
export function A() {
  const s = signal(1);
  const c = computed(() => s() * 2);
  const go = () => s.update((v) => v + 1);
  clientEffect(() => { s(); });
  clientEvent(window, "scroll", () => go());
  return <p onClick={go} window:onKeyDown={() => go()}>{c()}</p>;
}
export const B = () => {
  const t = signal("");
  return <input type="text" model:value={t} class={t()} />;
};`;
  const [server, dom] = both(source);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const names = dom.symbols!.map((s) => s.id);
  assert.deepEqual(
    names,
    server.symbols!.map((s) => s.id),
  );
  assert.deepEqual(
    // `() => go()` twice (clientEvent + window:onKeyDown): identical twins, the second `_1`.
    names.map((id) => id.replace(/\$[0-9a-z]{3,13}/, "$h")),
    ["A$h", "A$h", "A$h", "A$h", "A$h", "A$h_1", "A$h", "B$h"].map((c) => "src/m.tsx#" + c),
  );
  assert.equal(new Set(names).size, names.length);
  for (const id of names) assert.ok(server.code.includes(JSON.stringify(id)), id);
  // DOM component output stays a CSR module.
  assert.match(dom.code, /__rivet_on\(_el\$1, /);
  assert.doesNotMatch(dom.code, /server-resume/);
});

test("symbol ids are content hashes: stable when other sites change, new when their own code changes; twins get an ordinal", () => {
  const page = (before: string, body: string) => `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  return <div>${before}<button onClick={() => n.set(n() + 1)}>{n()}</button><i onClick={() => ${body}} /></div>;
}`;
  const ids = (source: string, target: "server" | "dom" = "dom") =>
    compile(source, { target, filename: "src/m.tsx", resume: { module: "src/m.tsx" } }).symbols!.map((s) => s.id);
  const base = ids(page("", "n.set(0)"));
  assert.deepEqual(base, ids(page("", "n.set(0)"), "server"));
  assert.deepEqual(base, ids(page("", "n.set(0)")), "deterministic");
  assert.ok(
    base.every((id) => /^src\/m\.tsx#Page\$[0-9a-z]{3,13}$/.test(id)),
    base.join(" "),
  );
  // A handler inserted before: every old id is still there (positional ids renumbered them).
  const inserted = ids(page("<b onClick={() => n.set(5)} />", "n.set(0)"));
  assert.equal(inserted.length, base.length + 1);
  for (const id of base) assert.ok(inserted.includes(id), id);
  // The last handler's own code changed: only its id changes.
  const changed = ids(page("", "n.set(1)"));
  assert.deepEqual(changed.slice(0, -1), base.slice(0, -1));
  assert.notEqual(changed.at(-1), base.at(-1));
  // Identical twins in one component: `<id>_1`.
  const twins = ids(page("", "n.set(n() + 1)"));
  assert.equal(twins[2], twins[0] + "_1");
});

test("components without resumable code compile as they do without resume", () => {
  const source = `export function P({ x }: { x: string }) { return <p class="a">{x}</p>; }`;
  for (const target of ["server", "dom"] as const) {
    const plain = compile(source, { target, filename: "m.tsx" });
    const resumed = compile(source, { target, filename: "m.tsx", resume });
    assert.equal(resumed.code, plain.code);
  }
});

test("resume diagnostics", () => {
  const cases: [string, RegExp][] = [
    [`export function C() { return <b onClick={() => <i />}>x</b>; }`, /JSX inside handlers, effects and computeds is not resumable/],
    [`export function C() { return <b onClick={function () { return this; }}>x</b>; }`, /capture `this`/],
    [
      `import { Robot } from "robot-sdk"; export function C() { const r = new Robot(); return <b onClick={() => r}>x</b>; }`,
      /cannot capture `r`: class instances/,
    ],
    [
      `import { clientEvent } from "@rivetjs/runtime/dom"; export function C({ el }) { clientEvent(el, "x", () => 1); return <b>x</b>; }`,
      /clientEvent target must be/,
    ],
    [`export function C() { const w = window.innerWidth; return <b>{w}</b>; }`, /Browser global `window` is read during server rendering/],
    [`export function C() { return <b ref={(el) => el.focus()}>x</b>; }`, /Resumable ref callbacks must assign a local/],
    [`export function C() { let el; el = 1; return <b ref={(x) => (el = x)}>x</b>; }`, /Ref-bound locals must be assigned only by ref callbacks/],
  ];
  for (const [source, pattern] of cases)
    assert.ok(
      messages(source).some((m) => pattern.test(m)),
      String(pattern) + " " + messages(source),
    );
  // Browser globals inside resumable closures and behind typeof are fine.
  assert.deepEqual(messages(`export function C() { const ok = typeof window; return <b onClick={() => window.scrollTo(0, 0)}>{ok}</b>; }`), []);
});

test("framework component elements with constant props render as plain calls, not regions", () => {
  const [server, dom] = both(`
import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { Link } from "@rivetjs/router/link";
import hero from "./hero.jpg?image";
const label = "Home";
export function Page() {
  const n = signal(0);
  return <div>
    <Picture image={hero} alt="" class={"w-" + 2} />
    <Link to="/x" class={\`a \${label}\`}><b>{label}</b> x</Link>
    <button onClick={() => n.set(n() + 1)}>+</button>
  </div>;
}`);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  // Only the handler is a symbol: its chunk does not import Picture or Link.
  assert.deepEqual(
    dom.symbols!.map((s) => [s.id, s.kind]),
    [[dom.symbols![0]!.id, "event"]],
  );
  assert.match(dom.symbols![0]!.id, /^src\/m\.tsx#Page\$[0-9a-z]{3,13}$/);
  assert.deepEqual(dom.symbols![0].imports, []);
  assert.deepEqual(dom.symbols![0].locals, []);
  assert.doesNotMatch(dom.code, /export \{[^}]*(Picture|Link)/);
  assert.doesNotMatch(server.code, /__rivetR_bind/);
  assert.match(server.code, /\bPicture\(\{/);
  assert.match(server.code, /\bLink\(\{/);
});

test("component elements that may depend on signals keep their region", () => {
  const regions = (body: string, head = "") => {
    const [server, dom] = both(`
import { signal } from "@rivetjs/reactivity";
import { clientOnly, lazyComponent } from "@rivetjs/runtime/dom";
import { Picture } from "@rivetjs/runtime/image";
import { Link } from "@rivetjs/router/link";
import { Imported } from "./imported.js";
import * as ui from "./ui.js";
${head}
export function Page({ c: Dynamic, src }: any) {
  const t = signal("x");
  return <div>${body}</div>;
}`);
    assert.deepEqual(dom.diagnostics, []);
    assert.match(server.code, /__rivetR_bind/, body);
    return dom.symbols!.filter((s) => s.kind === "region").length;
  };
  // Calls / non-constant bindings in props or children.
  assert.equal(regions(`<Link to={t()}>x</Link>`), 1);
  assert.equal(regions(`<Link to="/x">{t()}</Link>`), 1);
  assert.equal(regions(`<Picture image={src} alt="" />`), 1);
  assert.equal(regions(`<Link to="/x"><b onClick={() => t.set("y")}>x</b></Link>`), 1);
  assert.equal(regions(`<Link to="/x" class={t} />`), 1);
  // Client-only and lazy module consts, dynamic and member tags, other modules' and local components.
  assert.equal(regions(`<Widget />`, `const Widget = clientOnly(() => import("./w.js"));`), 1);
  assert.equal(regions(`<Later />`, `const Later = lazyComponent(() => import("./l.js"));`), 1);
  assert.equal(regions(`<Dynamic />`), 1);
  assert.equal(regions(`<ui.Card />`), 1);
  assert.equal(regions(`<Imported />`), 1);
  assert.equal(regions(`<Card title="x" />`, `function Card({ title }: { title: string }) { return <h2>{title}</h2>; }`), 1);
  assert.equal(regions(`<Card title={t()} />`, `function Card({ title }: { title: string }) { return <h2>{title}</h2>; }`), 1);
});

test("a captured import re-exported under the same name is not exported twice; a clashing re-export is a diagnostic", () => {
  // `import { Ctx } from "./context"; export { Ctx } from "./context"` — the module already exports the binding the symbols need.
  const source = `
import { Ctx, other } from "./context.ts";
import { signal } from "@rivetjs/reactivity";
export { Ctx } from "./context.ts";
export { other as aliased } from "./context.ts";
export function View() {
  const n = signal(0);
  return <button onClick={() => n.set(Ctx.step + other.step)}>{n()}</button>;
}`;
  const [, dom] = both(source);
  assert.deepEqual(dom.diagnostics, []);
  // Exactly one export of `Ctx` (the re-export); `other` (exported only as `aliased`) is exported by the compiler.
  assert.equal(dom.code.match(/export \{[^}]*\bCtx\b/g)!.length, 1);
  assert.match(dom.code, /export \{ other \};/);
  assert.deepEqual(dom.symbols![0]!.captures, ["n"]);
  // A re-export of a different binding under the captured name cannot be reused by the symbol modules.
  assert.deepEqual(
    messages(
      `
import { Ctx } from "./a.ts";
import { signal } from "@rivetjs/reactivity";
export { Ctx } from "./b.ts";
export function View() {
  const n = signal(0);
  return <button onClick={() => n.set(Ctx.step)}>{n()}</button>;
}`,
      "dom",
    ),
    ["Cannot resume View: the module exports a different binding as `Ctx` than the `Ctx` its symbols reference; rename the local or the export"],
  );
});

test("R2: method shorthands in object literals are wrapped like arrow properties", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
function Child(props: { api: { onPress(e: number): void } }) { return <b>{props.api.onPress(1)}</b>; }
export function View() {
  const n = signal(0);
  const api = { onPress(e: number) { n.set(n() + e); }, async load() { n.set(1); }, ["on" + "Key"]() { n.set(2); } };
  return <><Child api={api} /><Child api={{ onPress(e) { n.set(e); } }} /></>;
}`;
  const [server, dom] = both(source);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  // The property keeps its name; the method becomes a function expression wrapped by `_rFn`.
  assert.match(server.code, /onPress: __rivetR_fn\("src\/m\.tsx#View\$\w+", function\(e\) \{/);
  assert.match(server.code, /load: __rivetR_fn\("src\/m\.tsx#View\$\w+", async function\(\) \{/);
  assert.match(server.code, /\["on" \+ "Key"\]: __rivetR_fn\(/);
  assert.match(server.code, /"api": \{ onPress: __rivetR_fn\(/);
  const fns = dom.symbols!.filter((s) => s.kind === "fn");
  assert.equal(fns.length, 4);
  assert.deepEqual(
    fns.map((s) => s.captures),
    [["n"], ["n"], ["n"], ["n"]],
  );
  assert.match(fns[0]!.source, /=> \(function \(e: number\) \{/);
  assert.match(fns[1]!.source, /=> \(async function \(\) \{/);
});
