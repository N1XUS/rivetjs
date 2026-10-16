// CORE-GAPS (d) + Function Bridge T3 (fix round 1, M3): a local `const f = g` aliasing a module-level function
// (declaration / const function) or an import, and such a value passed as a component prop, hold module references.
// Since T3 the value itself is stamped once per module (`__rivetR_mod((() => g), "<unit>#g$<h5>$ref")`) and encodes as
// that reference wherever a render reaches it, so the former per-site `_rFn(id, g, [])` wrappers and their `fn`
// symbols are gone (dead code). Value positions (`c ? g : h`) qualify; other locals stay plain captures.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/a.tsx" };
const out = (source: string, target: "server" | "dom" = "server") => {
  const r = compile(source, { target, filename: "a.tsx", resume } as never);
  assert.deepEqual(r.diagnostics, []);
  return r as typeof r & { symbols: { id: string; kind: string; component: string; captures: string[]; source: string }[] };
};

const source = `import { signal } from "@rivetjs/reactivity";
import { fmt } from "./fmt.ts";
import pad from "./pad.ts";
function double(n: number) { return n * 2; }
const triple = (n: number) => n * 3;
function Calc(props: { f: (n: number) => unknown; n: number }) {
  return <b>{String(props.f(props.n))}</b>;
}
export function Page() {
  const n = signal(1);
  const a = double;
  const b = fmt;
  const c = pad;
  const t = n() > 5 ? triple : double;
  return <div><Calc f={a} n={n()} /><Calc f={b} n={n()} /><Calc f={c} n={n()} /><Calc f={t} n={n()} /></div>;
}`;

test("aliases of module functions and imports: plain consts, the values stamped as module references", () => {
  const server = out(source).code.replace(/\s+/g, " ");
  for (const line of ["const a = double;", "const b = fmt;", "const c = pad;", "const t = n() > 5 ? triple : double;"]) assert.ok(server.includes(line), line);
  assert.doesNotMatch(server, /__rivetR_fn\(/);
  for (const [value, id, flag] of [
    ["double", "src/a.tsx#double$l", ""],
    ["fmt", "src/fmt.ts#fmt", ", 1"],
    ["pad", "src/pad.ts#default", ", 1"],
    ["triple", "src/a.tsx#triple$l", ""],
  ])
    assert.match(server, new RegExp(`__rivetR_mod\\(\\(\\(\\) => ${value}\\), "${id.replace(/[./$]/g, "\\$&")}\\$[0-9a-z]{5}\\$ref"${flag}\\);`), value);
  const symbols = out(source, "dom").symbols;
  assert.ok(!symbols.some((s) => s.kind === "fn" && s.component === "Page"));
  assert.equal(symbols.filter((s) => s.kind === "ref").length, 4);
});

test("a module function / import passed directly as a component prop: the value itself, stamped as a module reference", () => {
  const direct = `import { fmt } from "./fmt.ts";
function double(n: number) { return n * 2; }
function Step(props: any) { return <b onClick={() => props.f(1)}>x</b>; }
export function Page() { return <div><Step f={double} /><Step f={fmt} /></div>; }`;
  const server = out(direct).code.replace(/\s+/g, " ");
  assert.match(server, /"f": double \}/);
  assert.match(server, /"f": fmt \}/);
  assert.match(server, /__rivetR_mod\(\(\(\) => double\), "src\/a\.tsx#double\$l\$[0-9a-z]{5}\$ref"\);/);
  assert.match(server, /__rivetR_mod\(\(\(\) => fmt\), "src\/fmt\.ts#fmt\$[0-9a-z]{5}\$ref", 1\);/);
  const symbols = out(direct, "dom").symbols;
  assert.ok(!symbols.some((s) => s.kind === "fn" && s.component === "Page"));
});

test("other locals stay plain captures", () => {
  const plain = `import { signal } from "@rivetjs/reactivity";
function Calc(props: any) { return <b>{String(props.f)}</b>; }
const LIMIT = { max: 3 };
export function Page(props: { g: () => number }) {
  const n = signal(1);
  const l = LIMIT;
  const g = props.g;
  return <div><Calc f={l} n={n()} /><Calc f={g} n={n()} /></div>;
}`;
  const server = out(plain).code;
  assert.match(server, /const l = LIMIT;/);
  assert.match(server, /const g = props\.g;/);
});
