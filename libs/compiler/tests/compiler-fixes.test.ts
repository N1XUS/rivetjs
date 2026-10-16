// G19 compiler fixes: null-branch regions (E3), derived consts with primitive values (E6), type-only
// server imports (E12), css`` interpolation advice (E14), ErrorBoundary children thunking.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/m.tsx" };

test("resume: a child expression mixing JSX and non-JSX branches always binds as a region (flag 1)", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function View() {
  const on = signal(false);
  const n = signal(0);
  return <div>
    <p>{on() ? <b>yes</b> : null}</p>
    <p>{on() && <i>and</i>}</p>
    <p>{n() > 1 ? "many" : n() ? <><u>one</u></> : null}</p>
    <p>{(on() || null) ?? <Item />}</p>
    <p>{n()}</p>
    <p>{on() ? "a" : "b"}</p>
    <p>{on() ? <b>always</b> : <i>jsx</i>}</p>
  </div>;
}
function Item() { return <s>item</s>; }`;
  const server = compile(source, { target: "server", filename: "m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  const binds = [...server.code.matchAll(/__rivetR_bind\("src\/m\.tsx#View\$\w+", [\s\S]*?\[(?:on|n)\](, 1)?\)/g)].map((m) => m[1] === ", 1");
  // All-JSX branches never yield a primitive: no flag (unchanged output).
  assert.deepEqual(binds, [true, true, true, true, false, false, false]);
  // The DOM output and symbols are unchanged by the flag.
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(dom.diagnostics, []);
  assert.ok(dom.symbols!.every((symbol) => symbol.kind !== "region" || symbol.source.includes("<")));
});

test("resume: a const derived through an arrow may hold a primitive (find(arrow) ?? fallback)", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
const items = [{ id: 1, name: "a" }];
export const serverLoad = () => ({ ok: true });
export default function Page() {
  const id = signal(1);
  const label = items.find((i) => i.id === 2)?.name ?? "fallback";
  const found = items.find((i) => i.id === 3);
  return <p onClick={() => id.set(id() + label.length + (found ? 1 : 0))}>{items.find((i) => i.id === id())?.name ?? "none"}</p>;
}`;
  for (const target of ["server", "dom"] as const)
    for (const options of [{ resume }, { resume, serverExports: true }, { serverExports: true }, {}]) {
      const result = compile(source, { target, filename: "m.tsx", ...options });
      assert.deepEqual(result.diagnostics, [], target + " " + JSON.stringify(options));
    }
  // Server: the derived consts are registered through _rFn (which accepts any value).
  const server = compile(source, { target: "server", filename: "m.tsx", resume });
  assert.match(server.code, /const label = __rivetR_fn\("src\/m\.tsx#Page\$\w+", items\.find/);
});

test("serverExports: type-only imports from server-only modules are erased, never rejected", () => {
  const sources = [
    `import type { Row } from "./db.server.ts";
export default function Page({ data }: { data: Row[] }) { return <p>{data.length}</p>; }`,
    `import { type Row, query } from "./db.server.ts";
export const serverLoad = () => query();
export default function Page({ data }: { data: Row[] }) { let row: Row | undefined; return <p onClick={() => { row = data[0] as Row; }}>{data.length}</p>; }`,
    `import { type Row } from "./db.server.ts";
export default function Page({ data }: { data: Row[] }) { const pick = (r: Row): Row => r; return <p>{data.map(pick).length}</p>; }`,
  ];
  for (const source of sources)
    for (const target of ["server", "dom"] as const)
      for (const options of [{}, { resume }]) {
        const result = compile(source, { target, filename: "r.tsx", serverExports: true, ...options });
        assert.deepEqual(result.diagnostics, [], target);
        if (target === "dom") {
          assert.doesNotMatch(result.code, /db\.server/);
          for (const symbol of result.symbols ?? []) assert.ok(!symbol.imports.some((entry) => entry.from.includes("db.server")));
        }
      }
});

test("css`` interpolation diagnostic names the supported alternatives", () => {
  const source =
    'import { css } from "@rivetjs/runtime/css";\nconst size = 2;\nconst s = css`.a { margin: ${size}px; }`;\nexport const A = () => <p class={s.a} />;';
  const [message] = compile(source, { target: "server", filename: "a.tsx", styles: { scope: "a.tsx" } }).diagnostics.map((d) => d.message);
  assert.match(message!, /css`` interpolations are not supported/);
  assert.match(message!, /cx\(/);
  assert.match(message!, /data-/);
  // G10: the dynamic-value path is a custom property set with a style object.
  assert.match(message!, /custom property on the element \(style=\{\{ "--x": value \}\}\) and read var\(--x\)/);
  assert.match(message!, /class:active=\{on\}/);
});

test("ErrorBoundary: plain JSX children are thunked on both targets (function children unchanged)", () => {
  const source = `
import { ErrorBoundary } from "@rivetjs/runtime/dom";
function Boom() { return <b>ok</b>; }
export const plain = () => <ErrorBoundary fallback={() => <p>x</p>}><Boom /></ErrorBoundary>;
export const many = () => <ErrorBoundary fallback={() => <p>x</p>}><i>a</i>{"b"}</ErrorBoundary>;
export const fn = () => <ErrorBoundary fallback={() => <p>x</p>}>{() => <Boom />}</ErrorBoundary>;
export const attr = () => <ErrorBoundary fallback={() => <p>x</p>} children={<Boom />} />;`;
  const server = compile(source, { target: "server", filename: "b.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /plain = \(\) => ErrorBoundary\(\{[\s\S]*?children: \(\) => Boom\(\{\}\)/);
  assert.match(server.code, /many = \(\) => ErrorBoundary\(\{[\s\S]*?children: __rivetSlot\(\(\) => \[/);
  assert.match(server.code, /fn = \(\) => ErrorBoundary\(\{[\s\S]*?children: \(\) => Boom\(\{\}\)\n/);
  assert.doesNotMatch(server.code, /\(\) => \(\) => Boom/);
  assert.match(server.code, /attr = \(\) => ErrorBoundary\(\{[\s\S]*?"children": \(\) => Boom\(\{\}\)/);
  const dom = compile(source, { target: "dom", filename: "b.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  assert.match(dom.code, /plain = \(\) => __rivet_c\(ErrorBoundary, \{[\s\S]*?children: __rivetSlot\(\(\) => __rivet_c\(Boom, \{\}\)\)/);
  assert.match(dom.code, /many = \(\) => __rivet_c\(ErrorBoundary, \{[\s\S]*?children: __rivetSlot\(\(\) => \[__rivetTpl\d+\(\), "b"\]\)/);
  assert.match(dom.code, /fn = \(\) => __rivet_c\(ErrorBoundary, \{[\s\S]*?children: \(\) => __rivet_c\(Boom, \{\}\)\n/);
  assert.match(dom.code, /attr = \(\) => __rivet_c\(ErrorBoundary, \{[\s\S]*?"children": \(\) => __rivet_c\(Boom, \{\}\)/);
  assert.doesNotMatch(dom.code, /children: __rivet_c|\(\) => \(\) => __rivet_c/);
  // A local component named ErrorBoundary is not the runtime's (its element children are lazy like any component's).
  const local = compile(`function ErrorBoundary(p: any) { return p.children; }\nexport const v = () => <ErrorBoundary><b>x</b></ErrorBoundary>;`, {
    target: "server",
    filename: "c.tsx",
  });
  assert.match(local.code, /children: __rivetSlot\(\(\) => __rivetTemplate/);
});

test("ErrorBoundary: resume modules thunk plain children inside the boundary's region", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { ErrorBoundary } from "@rivetjs/runtime/server";
function Boom() { return <b>ok</b>; }
export function Page() {
  const n = signal(0);
  return <main><button onClick={() => n.set(1)}>{n()}</button><ErrorBoundary fallback={(e, reset) => <p onClick={reset}>x</p>}><Boom /></ErrorBoundary></main>;
}`;
  for (const target of ["server", "dom"] as const) {
    const result = compile(source, { target, filename: "m.tsx", resume });
    assert.deepEqual(result.diagnostics, [], target);
    assert.match(
      result.code,
      target === "server" ? /children: __rivetSlot\(\(\) => Boom\(\{\}\)\)/ : /children: __rivetSlot\(\(\) => __rivet_c\(Boom, \{\}\)\)/,
    );
  }
});

test("Show / Match: plain JSX children are thunked in resume modules only", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { Show, Switch, Match } from "@rivetjs/runtime/dom";
export function View() {
  const n = signal(0);
  return <main onClick={() => n.set(n() + 1)}>
    <Show when={() => n() > 0} fallback={() => <i>none</i>}><b>some</b></Show>
    <Show when={() => n()}>{(v: () => number) => <u>{v()}</u>}</Show>
    <Switch><Match when={() => n() === 1}><s>one</s></Match></Switch>
  </main>;
}`;
  const server = compile(source, { target: "server", filename: "m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /Show\(\{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTemplate/);
  assert.match(server.code, /Show\(\{[\s\S]*?children: \(v\) => __rivetTemplate/);
  assert.match(server.code, /Match\(\{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTemplate/);
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(dom.diagnostics, []);
  assert.match(dom.code, /__rivet_c\(__rivet_show, \{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTpl\d+\(\)\)/);
  assert.match(dom.code, /__rivet_c\(__rivet_show, \{[\s\S]*?children: \(v\) => \{/);
  assert.match(dom.code, /__rivet_c\(__rivet_match, \{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTpl\d+\(\)\)/);
  // Outside resume modules element children are lazy too (every component's are); Switch keeps its Match markers eager.
  const plain = compile(source, { target: "server", filename: "m.tsx" });
  assert.match(plain.code, /Show\(\{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTemplate/);
  assert.match(plain.code, /Match\(\{[\s\S]*?children: __rivetSlot\(\(\) => __rivetTemplate/);
  assert.match(plain.code, /Switch\(\{ children: Match\(/);
});
