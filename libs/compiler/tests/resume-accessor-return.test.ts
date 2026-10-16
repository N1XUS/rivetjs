// RESUME-ACCESSOR-ROW (2026-10-12): a component's returned parameterless accessor (`return () => …`, concise
// `(props) => () => …`) is a resume child site on the server — `__rivetR_child(__rivetR_fn(…))` — so its reads are
// recorded where the component renders. Hooks (lowercase), nested functions, accessors with parameters and async
// functions keep the plain `_rFn` value (or no site); the DOM target and the symbols are unchanged.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const source = `import { signal } from "@rivetjs/reactivity";
export function Panel(props: { id: number; sel: () => number }) {
  return () => (props.sel() === props.id ? <b>on</b> : <i>off</i>);
}
export const Concise = (props: { sel: () => number }) => () => (props.sel() > 1 ? <b>many</b> : <i>one</i>);
export function Block(props: { sel: () => number }) {
  return function () { const v = props.sel(); return <p>{v}</p>; };
}
export function useThing(props: { sel: () => number }) { return () => props.sel() + 1; }
export function WithArg(props: { sel: () => number }) { return (x: number) => props.sel() + x; }
export function Later(props: { sel: () => number }) { return async () => props.sel(); }
export function Outer(props: { sel: () => number }) {
  const inner = () => { return () => props.sel(); };
  return <div>{inner()}</div>;
}`;
const resume = { module: "src/a.tsx" };

test("server: a component's returned accessor is a `_rChild` site; hooks / arguments / async / nested stay plain", () => {
  const server = compile(source, { target: "server", filename: "a.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  for (const name of ["Panel", "Concise", "Block"]) assert.match(server.code, new RegExp(`__rivetR_child\\(__rivetR_fn\\("src/a\\.tsx#${name}\\$\\w+"`), name);
  for (const name of ["useThing", "WithArg", "Later", "Outer"])
    assert.doesNotMatch(server.code, new RegExp(`__rivetR_child\\(__rivetR_fn\\("src/a\\.tsx#${name}\\$`), name);
  assert.equal(server.code.match(/__rivetR_child\(/g)?.length, 3);
});

test("DOM: output and symbols carry no child wrapper", () => {
  const dom = compile(source, { target: "dom", filename: "a.tsx", resume });
  assert.deepEqual(dom.diagnostics, []);
  assert.doesNotMatch(dom.code, /_rChild|__rivetR_child/);
  const ids = (dom.symbols ?? []).map((s) => s.id);
  for (const name of ["Panel", "Concise", "Block"])
    assert.ok(
      ids.some((id) => id.startsWith(`src/a.tsx#${name}$`)),
      name,
    );
});

// Fix 1 (review MED): a ternary / logical of accessors and a returned local `const` arrow are covered; forms that cannot
// resume as a child site (anonymous default export, wrapper call) warn RV2015 instead of staying silent.
const forms = `import { memo } from "./memo";
export function Tern(props: { c: boolean; sel: () => number }) {
  return props.c ? () => <b>{props.sel()}</b> : () => <i>{props.sel()}</i>;
}
export function Named(props: { sel: () => number }) {
  const view = () => (props.sel() > 1 ? <b>many</b> : <i>one</i>);
  return view;
}
export function Either(props: { sel: () => number; fallback?: () => unknown }) {
  return props.fallback ?? (() => <b>{props.sel()}</b>);
}
export function Plain(props: { c: boolean }) {
  return props.c ? <b>a</b> : <i>b</i>;
}
export const Wrapped = memo((props: { sel: () => number }) => () => props.sel());
export default function (props: { sel: () => number }) {
  return () => props.sel();
}`;

test("fix 1: ternary / logical / named const accessors are `_rChild` returns; plain returns unchanged", () => {
  const server = compile(forms, { target: "server", filename: "a.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /return __rivetR_child\(props\.c \? __rivetR_fn\("src\/a\.tsx#Tern\$\w+"[^]*: __rivetR_fn\("src\/a\.tsx#Tern\$\w+"/);
  assert.match(server.code, /const view = __rivetR_fn\("src\/a\.tsx#Named\$\w+"[^]*return __rivetR_child\(view\);/);
  assert.match(server.code, /return __rivetR_child\(props\.fallback \?\? \(?__rivetR_fn\("src\/a\.tsx#Either\$\w+"/);
  assert.doesNotMatch(server.code, /__rivetR_child\(props\.c \? __rivetTemplate/);
  assert.equal(server.code.match(/__rivetR_child\(/g)?.length, 3);
});

test("fix 1: an anonymous default export or a wrapper call returning an accessor warns RV2015 (code still emitted)", () => {
  for (const target of ["server", "dom"] as const) {
    const result = compile(forms, { target, filename: "a.tsx", resume });
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.code.length > 0);
    const warnings = (result.warnings ?? []).filter((w) => w.code === "RV2015");
    assert.deepEqual(
      warnings.map((w) => [w.line, /wrapped in `memo\(…\)`|an anonymous default export/.exec(w.message)?.[0]]),
      [
        [15, "wrapped in `memo(…)`"],
        [17, "an anonymous default export"],
      ],
      target,
    );
  }
  const plain = compile(forms, { target: "server", filename: "a.tsx" });
  assert.equal(plain.warnings, undefined, "no resume: no warning");
});

// Fix 2 (re-review L2): a hoisted `function view() {}` returned by name is covered like a named `const`; a `let` one
// warns RV2015 (it may be reassigned); declarations with parameters / async / generators stay plain.
const declared = `export function Hoisted(props: { sel: () => number }) {
  return view;
  function view() { return props.sel() > 1 ? <b>many</b> : <i>one</i>; }
}
export function Mutable(props: { sel: () => number }) {
  let view = () => <b>{props.sel()}</b>;
  return view;
}
export function Param(props: { sel: () => number }) {
  function view(x: number) { return props.sel() + x; }
  return view;
}
export function Gen(props: { sel: () => number }) {
  function* view() { yield props.sel(); }
  return view;
}`;

test("fix 2: a returned hoisted function declaration is a `_rChild` return; a returned `let` warns RV2015", () => {
  const server = compile(declared, { target: "server", filename: "a.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetR_fn\("src\/a\.tsx#Hoisted\$\w+", view, \(\) => \[[^\]]*\]\);\n\treturn __rivetR_child\(view\);/);
  assert.equal(server.code.match(/__rivetR_child\(/g)?.length, 1);
  for (const target of ["server", "dom"] as const) {
    const result = compile(declared, { target, filename: "a.tsx", resume });
    const warnings = (result.warnings ?? []).filter((w) => w.code === "RV2015");
    assert.deepEqual(
      warnings.map((w) => [w.line, /returned through `let view`/.exec(w.message)?.[0]]),
      [[7, "returned through `let view`"]],
      target,
    );
  }
});
