// Function Bridge T8 (C6): captured `let`s written in closures / after a capture site become shared cells.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { check, compile } from "../index.ts";
import { roundTrip } from "../../runtime/tests/resume/bridge-encode.ts";

type Sym = { kind: string; component: string; source: string; id: string };
const run = (source: string, target: "server" | "dom") =>
  compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string; symbols: Sym[]; diagnostics: unknown[] };
const shared = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("0");
  let clicks = 0;
  return (<section><span>{out()}</span>
    <button class="go" onClick={() => { clicks++; }}>go</button>
    <button class="show" onClick={() => out.set(String(clicks))}>show</button></section>);
}`;

// Brief tests verbatim.
test("server: the let becomes a cell; reads and writes go through .v", () => {
  const code = run(shared, "server").code.replace(/\s+/g, " ");
  assert.match(code, /const clicks = __rivetR_cell\(0\);/);
  assert.doesNotMatch(code, /let clicks/);
});

test("symbols rewrite the captured let to .v; the DOM main module keeps the plain let", () => {
  const dom = run(shared, "dom");
  assert.match(dom.code, /let clicks = 0/);
  const sources = dom.symbols.map((s) => s.source).join("\n");
  assert.match(sources, /clicks\.v\+\+/);
  assert.match(sources, /String\(clicks\.v\)/);
});

// Fix round 1 (review H1): any write boxes, wherever it sits (execution order is not source order).
test("a let written only before the capture site boxes too (any write boxes)", () => {
  const code = run(
    `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); let step = 1; step = 5; return <button onClick={() => n.set(n() + step)}>{n()}</button>; }`,
    "server",
  ).code;
  assert.match(code, /const step = __rivetR_cell\(1\);/);
  assert.match(code, /step\.v = 5;/);
});

// Shapes.
const server = (source: string) => run(source, "server").code.replace(/\s+/g, " ");
const symbols = (source: string) =>
  run(source, "dom")
    .symbols.map((s) => s.source)
    .join("\n")
    .replace(/\s+/g, " ");

test("both targets agree on ids; the server imports _rCell once and passes the cell as the capture", () => {
  const s = run(shared, "server");
  const d = run(shared, "dom");
  assert.deepEqual(
    s.symbols.map((x) => x.id),
    d.symbols.map((x) => x.id),
  );
  assert.match(s.code, /import \{[^}]*_rCell as __rivetR_cell[^}]*\} from "@rivetjs\/runtime\/server-resume"/);
  assert.match(s.code.replace(/\s+/g, " "), /__rivetR_on\("click", "src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \[out, clicks\]/);
});

test("let-after-jsx: a write after the capturing JSX boxes the let", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let label = "early";
  const view = <button onClick={() => out.set(label)}>{out()}</button>;
  label = "late";
  return view;
}`);
  assert.match(code, /const label = __rivetR_cell\("early"\);/);
  assert.match(code, /label\.v = "late";/);
});

test("callee, shorthand, destructuring target and compound writes are rewritten", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("");
  let n = 1;
  let f = (): number => 0;
  const o = { n: 5 };
  const go = () => { n += 2; ({ n } = o); [n] = [n * 2]; out.set(JSON.stringify({ n, f: f(), g: f!() })); };
  f = () => n;
  return <button onClick={go}>{out()}</button>;
}`;
  const code = server(source);
  assert.match(code, /const n = __rivetR_cell\(1\);/);
  assert.match(code, /const f = __rivetR_cell\(__rivetR_fn\(/);
  const text = symbols(source);
  assert.match(text, /n\.v \+= 2/);
  assert.match(text, /\(\{ n: n\.v \} = o\)/);
  assert.match(text, /\[n\.v\] = \[n\.v \* 2\]/);
  assert.match(text, /\{ n: n\.v, f: \(0, f\.v\)\(\), g: \(0, f\.v\)!\(\) \}/);
});

test("a for-head let stays a per-iteration binding; a loop write before the site boxes", () => {
  const head = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("");
  const rows = [];
  for (let i = 0; i < 2; i++) rows.push(<button onClick={() => out.set(String(i))}>{i}</button>);
  return <div>{out()}{rows}</div>;
}`);
  assert.doesNotMatch(head, /__rivetR_cell/);
  const loop = server(`import { signal } from "@rivetjs/reactivity";
export function Page(props: { xs: string[] }) {
  const out = signal("");
  const rows = [];
  let k = 0;
  for (const x of props.xs) { k++; rows.push(<button onClick={() => out.set(x + k)}>{x}</button>); }
  return <div>{out()}{rows}</div>;
}`);
  assert.match(loop, /const k = __rivetR_cell\(0\);/);
  assert.match(loop, /k\.v\+\+/);
});

test("a let used as a JSX tag is never boxed", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
function A() { return <b>a</b>; }
function B() { return <i>b</i>; }
export function Page() {
  const out = signal("");
  let Tag = A;
  const view = <div><Tag /><button onClick={() => out.set(String(Tag === B))}>{out()}</button></div>;
  Tag = B;
  return view;
}`);
  assert.doesNotMatch(code, /__rivetR_cell/);
});

test("holder-let-later: the holder's function captures the cell, the later function is its recipe", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  const api: { inc?: () => void } = {};
  let step: (() => void) | undefined;
  api.inc = () => step!();
  step = () => n.set(n() + 1);
  return <button onClick={() => api.inc!()}>{n()}</button>;
}`);
  assert.match(code, /const step = __rivetR_cell\(\);/);
  assert.match(code, /api\.inc = __rivetR_fn\("src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \(\) => \(0, step\.v\)\(\), \[step\]\);/);
  assert.match(code, /step\.v = __rivetR_fn\(/);
});

test("check sites report the capture kind cell", () => {
  const result = check(shared, { filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as {
    sites: { captures: { name: string; kind: string }[] }[];
  };
  const kinds = result.sites.flatMap((s) => s.captures.filter((c) => c.name === "clicks").map((c) => c.kind));
  assert.ok(kinds.length >= 2, JSON.stringify(result.sites));
  assert.deepEqual([...new Set(kinds)], ["cell"]);
});

test("a module without such lets compiles byte-identically to a captured const", () => {
  const plain = `import { signal } from "@rivetjs/reactivity";
export function Page() { const n = signal(0); let step = 1; return <button onClick={() => n.set(n() + step)}>{n()}</button>; }`;
  const code = run(plain, "server").code;
  assert.doesNotMatch(code, /__rivetR_cell|_rCell|step\.v/);
});

// Executed: compile with the real wasm, render `Page` inside a resumable render, encode what the page exposes through
// `globalThis.__held` and decode it with the browser decoder. Every symbol factory returns its decoded captures.
type Recipe = { id: string; captures: unknown[] };
// `ons`: hold the capture lists of every `_rOn` call instead (what the resumed handlers receive).
const executed = async (body: string, ons = false): Promise<unknown> => {
  let code = run(`import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`, "server").code;
  if (ons) {
    code = code.replace(/__rivetR_on\(/g, "__spyOn(");
    code += "\nconst __spyOn = (...a) => ((globalThis.__held ??= []).push(a[2]), __rivetR_on(...a));\n";
  }
  const ids = [...new Set([...code.matchAll(/"(src\/a\.tsx#[^"]+)"/g)].map((m) => m[1]!))];
  const dir = mkdtempSync(join(tmpdir(), "rivet-t8-"));
  try {
    const file = join(dir, "page.mjs");
    writeFileSync(
      file,
      code.replace(/"(@rivetjs\/[^"]+)"/g, (_, spec: string) => JSON.stringify(import.meta.resolve(spec))),
    );
    const { Page } = (await import(pathToFileURL(file).href)) as { Page: () => unknown };
    const g = globalThis as { __held?: unknown };
    try {
      const { values } = await roundTrip(
        () => {
          Page();
          return [g.__held];
        },
        Object.fromEntries(ids.map((id) => [id, (...captures: unknown[]): Recipe => ({ id, captures })])),
      );
      return values[0];
    } finally {
      delete g.__held;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("executed: two recipes share one decoded cell holding the value at encode", async () => {
  const [inc, read] = (await executed(`  let clicks = 0;
  const inc = () => { clicks++; };
  const read = () => clicks;
  (globalThis as { __held?: unknown }).__held = [inc, read];
  clicks = 3;
  return <button onClick={() => { inc(); n.set(read()); }}>{n()}</button>;`)) as [Recipe, Recipe];
  assert.notEqual(inc.id, read.id);
  assert.equal(inc.captures.length, 1);
  assert.equal(inc.captures[0], read.captures[0]);
  assert.deepEqual(inc.captures[0], { v: 3 });
});

test("executed: holder-let-later resumes with the function assigned after the holder site", async () => {
  const api = (await executed(`  const api: { inc?: () => void } = {};
  let step: (() => void) | undefined;
  api.inc = () => step!();
  step = () => n.set(n() + 1);
  (globalThis as { __held?: unknown }).__held = api;
  return <button onClick={() => api.inc!()}>{n()}</button>;`)) as { inc: Recipe };
  const cell = api.inc.captures[0] as { v: Recipe };
  assert.equal(typeof cell.v, "object");
  assert.notEqual(cell.v.id, api.inc.id);
  assert.equal(cell.v.captures.length, 1);
});

// Fix round 1 regressions (review H1 / M1), executed end to end: the decoded `_rOn` captures.
const sig = (v: unknown) => typeof v === "function";
test("executed H1: a capturing closure in a hoisted function declaration placed after the write sees the late value", async () => {
  const source = `  const out = signal("");
  let x = 0;
  const view = make();
  x = 5;
  return view;
  function make() { return <button onClick={() => out.set(String(x))}>{out()}</button>; }`;
  const [[out, cell]] = (await executed(source, true)) as [[unknown, { v: number }]];
  assert.ok(sig(out));
  assert.deepEqual(cell, { v: 5 });
});

test("executed H1: a write in a class field initializer that runs after the site boxes", async () => {
  const source = `  const out = signal("");
  let x = 0;
  class K { v = (x = 2); }
  const view = <button onClick={() => out.set(String(x))}>{out()}</button>;
  new K();
  return view;`;
  const [[, cell]] = (await executed(source, true)) as [[unknown, { v: number }]];
  assert.deepEqual(cell, { v: 2 });
});

test("M1: a handler by name over a boxed let captures the value at JSX evaluation, closures keep the cell", async () => {
  const body = `  const out = signal("");
  let h = () => out.set("a");
  const view = <div><button onClick={h}>{out()}</button><i onClick={() => h()}>x</i></div>;
  h = () => out.set("b");
  return view;`;
  const source = `import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`;
  const code = server(source);
  assert.match(code, /__rivetR_on\("click", "src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \[h\.v\]\)/);
  assert.match(code, /__rivetR_on\("click", "src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \[h\]\)/);
  const text = symbols(source);
  assert.match(text, /= \(h\) => \(h\);/);
  assert.match(text, /\(\) => \(0, h\.v\)\(\)/);
  const result = check(source, { filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as {
    sites: { captures: { name: string; kind: string }[] }[];
  };
  const kinds = result.sites.flatMap((s) => s.captures.filter((c) => c.name === "h").map((c) => c.kind)).sort();
  assert.deepEqual(kinds, ["cell", "value"]);
  const [[first], [second]] = (await executed(body, true)) as [[Recipe], [{ v: Recipe }]];
  const early = run(source, "dom").symbols.find((s) => s.source.includes('"a"'))!.id;
  const late = run(source, "dom").symbols.find((s) => s.source.includes('"b"'))!.id;
  assert.equal(first.id, early);
  assert.equal(second.v.id, late);
});

// Fix round 2 (review M2): a function nested in an eager handler expression runs later and shares the cell.
test("executed M2: an arrow inside an eager handler expression shares the cell with a sibling handler", async () => {
  const body = `  const out = signal("");
  const on = true as boolean;
  let x = 0;
  return <div><button onClick={on ? () => { x++; out.set(String(x)); } : undefined}>{out()}</button><i onClick={() => out.set(String(x))}>x</i></div>;`;
  const source = `import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`;
  assert.match(symbols(source), /on \? \(\) => \{ x\.v\+\+; out\.set\(String\(x\.v\)\); \} : undefined/);
  const lists = (await executed(body, true)) as unknown[][];
  const cells = lists.map((list) => list.find((v) => typeof v === "object" && v !== null && "v" in v));
  assert.equal(cells.length, 2);
  assert.ok(cells[0]);
  assert.equal(cells[0], cells[1]);
  assert.deepEqual(cells[0], { v: 0 });
});

// T8 follow-up (with T11): a mixed eager expression snapshots its eager references (`h$s`, the JSX-time value) and keeps
// the shared cell for the ones inside a nested function.
test("executed mixed: eager references read the JSX-time snapshot, nested ones the shared cell", async () => {
  const body = `  const out = signal("");
  let h = () => out.set("a");
  const view = <div><button onClick={h ?? (() => h())}>x</button><i onClick={() => h()}>y</i></div>;
  h = () => out.set("b");
  return view;`;
  const source = `import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`;
  assert.match(server(source), /__rivetR_on\("click", "src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?", \[h, __rivetR_member\(h, "v"\)\]\)/);
  assert.match(symbols(source), /\(h, h\$s\) => \(h\$s \?\? \(\(\) => \(0, h\.v\)\(\)\)\)/);
  const [[cell, snapshot], [sibling]] = (await executed(body, true)) as [[{ v: Recipe }, Recipe], [{ v: Recipe }]];
  const ids = run(source, "dom").symbols;
  assert.equal(snapshot.id, ids.find((s) => s.source.includes('"a"'))!.id);
  assert.equal(cell, sibling);
  assert.equal(cell.v.id, ids.find((s) => s.source.includes('"b"'))!.id);
});

test("a direct eval in the component keeps the let plain (L2)", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("");
  let x = 0;
  const v = <button onClick={() => { x++; out.set(String(x)); }}>{out()}</button>;
  eval("x = 7");
  return v;
}`);
  assert.doesNotMatch(code, /__rivetR_cell/);
  assert.match(code, /let x = 0;/);
});

// Review L5: shapes that work, pinned.
test("multi-declarator: only the boxed declarator is a cell and the declaration keeps let", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("");
  let a = 1, b = 2;
  return <button onClick={() => { a++; out.set(String(a + b)); }}>{out()}</button>;
}`;
  assert.match(server(source), /let a = __rivetR_cell\(1\), b = 2;/);
  assert.match(symbols(source), /a\.v\+\+; out\.set\(String\(a\.v \+ b\)\)/);
});

test("non-ASCII names and strings around edits keep byte offsets right", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("ü");
  let größe = "ä";
  return <button title="→" onClick={() => { größe += "é"; out.set("ö" + größe); }}>{out()}</button>;
}`;
  assert.match(server(source), /const größe = __rivetR_cell\("ä"\);/);
  assert.match(symbols(source), /\{ größe\.v \+= "é"; out\.set\("ö" \+ größe\.v\); \}/);
});

test("server-side shorthand and destructuring writes go through the cell", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page(props: { o: { n: number } }) {
  const out = signal("");
  let n = 0;
  ({ n } = props.o);
  const box = { n };
  return <button onClick={() => out.set(String(n + box.n))}>{out()}</button>;
}`);
  assert.match(code, /\(\{ ?n: n\.v ?\} = props\.o\);/);
  assert.match(code, /const box = \{ n: n\.v \};/);
});

test("a For row capturing a cell passes the cell", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime";
export function Page(props: { xs: string[] }) {
  const out = signal("");
  let picks = 0;
  return <ul><For each={props.xs}>{(x) => <li onClick={() => { picks++; out.set(x + picks); }}>{x}</li>}</For>{out()}</ul>;
}`;
  assert.match(server(source), /const picks = __rivetR_cell\(0\);/);
  assert.match(symbols(source), /picks\.v\+\+; out\.set\(x \+ picks\.v\)/);
});

test("a loop-body let gets one cell per iteration", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page(props: { xs: number[] }) {
  const out = signal("");
  const rows = [];
  for (const x of props.xs) { let k = x; rows.push(<button onClick={() => { k++; out.set(String(k)); }}>{x}</button>); }
  return <div>{out()}{rows}</div>;
}`);
  assert.match(code, /for \(const x of props\.xs\) \{ const k = __rivetR_cell\(x\);/);
});
