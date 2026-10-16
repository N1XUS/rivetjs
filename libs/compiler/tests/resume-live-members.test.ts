// CORE-GAPS (c): with live props a member read of a component's props object (`{props.count}`, `title={props.label}`,
// `props.count * 2`) is reactive, so it is a resume site like a call: the server records it (`_rBind` / `_rAttr`) and the
// browser updates the server nodes in place instead of re-creating the component on the first change. Only props objects
// (a PascalCase component's first parameter, `mergeProps` / `splitProps` results from `@rivetjs/runtime/props`, local
// getter objects) qualify: `{item.name}` in list rows, destructured props and lowercase helpers stay plain.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/a.tsx" };
const out = (source: string, target: "server" | "dom" = "server") => {
  const r = compile(source, { target, filename: "a.tsx", resume } as never);
  assert.deepEqual(r.diagnostics, []);
  return r as typeof r & { symbols: { id: string; kind: string; component: string; captures: string[]; source: string }[] };
};
const kinds = (source: string, component: string) =>
  out(source, "dom")
    .symbols.filter((s) => s.component === component)
    .map((s) => s.kind);

test("member reads of a component's props object are bind / attribute sites (text, attribute, arithmetic)", () => {
  const source = `export function Badge(props: { count: number; label: string }) {
  return <span title={props.label}>{props.count} / {props.count * 2}</span>;
}`;
  const server = out(source).code.replace(/\s+/g, " ");
  assert.match(server, /__rivetR_attr\("title", "src\/a\.tsx#Badge\$\w+"/);
  assert.match(server, /__rivetR_bind\("src\/a\.tsx#Badge\$\w+", \(\) => props\.count, \[props\]\)/);
  assert.match(server, /__rivetR_bind\("src\/a\.tsx#Badge\$\w+", \(\) => props\.count \* 2, \[props\]\)/);
  assert.deepEqual(kinds(source, "Badge"), ["attr", "bind", "bind"]);
});

test("arrow components, optional chains and nested members qualify; `children` keeps its own rule", () => {
  const source = `export const Card = (props: any) => <p class="c" data-x={props.item?.id}>{props.item.name}{props.children}</p>;`;
  assert.deepEqual(kinds(source, "Card"), ["attr", "bind"]);
  const server = out(source).code;
  assert.match(server, /__rivetR_child\(props\.children\)/);
});

test("mergeProps / splitProps results and local getter objects are props objects too", () => {
  const source = `import { mergeProps, splitProps } from "@rivetjs/runtime/props";
export function Chip(props: any) {
  const merged = mergeProps({ size: "md" }, props);
  const [local, rest] = splitProps(props, ["tone"]);
  const view = { get label() { return props.label; } };
  return <i data-size={merged.size} data-tone={local.tone}>{rest.text}{view.label}</i>;
}`;
  const server = out(source).code.replace(/\s+/g, " ");
  assert.match(server, /__rivetR_attr\("data-size"/);
  assert.match(server, /__rivetR_attr\("data-tone"/);
  assert.match(server, /__rivetR_bind\("src\/a\.tsx#Chip\$\w+", \(\) => rest\.text/);
  assert.match(server, /__rivetR_bind\("src\/a\.tsx#Chip\$\w+", \(\) => view\.label/);
});

test("list rows, destructured props, lowercase helpers and other objects stay plain", () => {
  const rows = `export function List(props: { items: { name: string }[] }) {
  const items = props.items;
  return <ul>{items.map((item) => <li>{item.name}</li>)}</ul>;
}`;
  // The `.map` call is the site; the row's `{item.name}` is no site of its own (list mount kept).
  assert.equal(kinds(rows, "List").length, 1);
  const destructured = `export function Tag({ item }: { item: { name: string } }) { return <b title={item.name}>{item.name}</b>; }`;
  assert.deepEqual(kinds(destructured, "Tag"), []);
  const helper = `export function row(props: { name: string }) { return <b>{props.name}</b>; }`;
  assert.deepEqual(kinds(helper, "row"), []);
  const local = `export function Box(props: any) { const o = { a: 1 }; return <b>{o.a}</b>; }`;
  assert.deepEqual(kinds(local, "Box"), []);
});

test("components without props member reads compile as they do without resume", () => {
  const source = `export function P({ x }: { x: string }) { return <p class="a">{x}</p>; }`;
  for (const target of ["server", "dom"] as const)
    assert.equal(compile(source, { target, filename: "m.tsx", resume } as never).code, compile(source, { target, filename: "m.tsx" }).code);
});
