// R-PLAN: resumable keyed `<For>` rows written from a compiled row plan (`$rows`, `_rRowPlan`, `_onForRows`) render the
// same HTML and resume state as the row-by-row path. Differential: each fixture compiles twice, with row plans (default)
// and without (`serverListMounts: false` turns compiled list mounts and row plans off), and every case renders both.
import { test } from "vitest";
import assert from "node:assert/strict";
import * as compiler from "@rivetjs/compiler";
import { _setRowPaths, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

type Rows = (props: { items: unknown[] }) => unknown;
interface Compiled {
  code: string;
  diagnostics: { message: string }[];
}
const compile = compiler.compile as unknown as (source: string, options: Record<string, unknown>) => Compiled;

const source = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
function Tag({ label }) {
  return <em>{label}</em>;
}
function Btn() {
  const n = signal(0);
  return <button onClick={() => n.set(n() + 1)}>{n()}</button>;
}
// Binding + handler per row (the bench row shape).
export function Basic({ items }) {
  const picked = signal("b");
  return <ul><For each={() => items} by={(x) => x}>{(x) =>
    <li class={picked() === x() ? "on" : "off"}><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
// Index param in a binding, a plain attribute and text; an env constant; a capture-phase handler; a link handler (nav).
export function Indexed({ items }) {
  const sel = signal(-1);
  const prefix = "row-";
  return <ol><For each={() => items} by={(x) => x}>{(x, i) =>
    <li id={prefix + x()} data-n={i()} data-sel={sel() === i()}>
      <a href={"/x/" + x()} onClick={() => sel.set(i())}>{x()}</a>
      <span onClickCapture={() => sel.set(-1)}>{i() + 1}</span>
    </li>}</For></ol>;
}
// No resume site in the row.
export function Plain({ items }) {
  const q = signal("");
  return <ul><For each={() => items.filter((x) => x.includes(q()))} by={(x) => x}>{(x) => <li title={x()}>{x()}</li>}</For></ul>;
}
// Rows whose binding reads differ (a row reads another signal): those rows keep their own records.
export function Uneven({ items }) {
  const picked = signal("");
  const other = signal("o");
  return <ul><For each={() => items} by={(x) => x}>{(x) =>
    <li class={x() === "z" ? other() : picked() === x() ? "on" : ""}><button onClick={() => picked.set(x())}>{x()}</button></li>}</For></ul>;
}
// A resumable component per row: a component site (\`_rBind\`), no row plan.
export function Nested({ items }) {
  return <ul><For each={() => items} by={(x) => x}>{(x) => <li data-k={x()}><Tag label={x()} /><Btn /></li>}</For></ul>;
}
// A call child (a resumable component behind a module function) is its own site (\`_rBind\`): no row plan.
function badge(on) {
  return on ? <Btn /> : null;
}
export function Deep({ items }) {
  return <ul><For each={() => items} by={(x) => x}>{(x) => <li data-k={x()}>{badge(x() === "c")}</li>}</For></ul>;
}
// Object items (row data in the state), a binding without signal reads on some rows.
export function Records({ items }) {
  const picked = signal(0);
  return <section><For each={() => items} by={(r) => r.id}>{(row) =>
    <article data-row={row().id} data-state={row().live ? (picked() === row().id ? "selected" : "even") : "static"}>
      <h2>{row().title}</h2>
      <button type="button" onClick={() => picked.set(row().id)}>Pick</button>
    </article>}</For></section>;
}
`;
const NAMES = ["Basic", "Indexed", "Plain", "Uneven", "Nested", "Deep", "Records"] as const;
/** Fixtures whose rows compile to a row plan. */
const PLANNED = NAMES.filter((name) => name !== "Nested" && name !== "Deep");
const symbols = compileResume(source, "dom").symbols;
const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };
const build = (lists: boolean): Compiled => {
  const result = compile(source, { target: "server", filename: "fixture.tsx", resume: { module: "src/fixture.tsx" }, serverListMounts: lists });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return result;
};
const planned = build(true),
  plain = build(false);
const withPlans = await importServer<Record<(typeof NAMES)[number], Rows>>(planned.code);
const withoutPlans = await importServer<Record<(typeof NAMES)[number], Rows>>(plain.code);

const letters = (n: number) => Array.from({ length: n }, (_, k) => "abcdefghijklmnopqrstuvwxy"[k % 25]! + (k >= 25 ? k : ""));
const records = (n: number) => Array.from({ length: n }, (_, k) => ({ id: k + 1, title: "Row " + k, live: k % 7 !== 3 }));
const cases: [(typeof NAMES)[number], unknown[]][] = [];
for (const name of NAMES)
  for (const n of [0, 1, 2, 3, 40]) cases.push([name, name === "Records" ? records(n) : name === "Uneven" && n > 2 ? [...letters(n - 1), "z"] : letters(n)]);
cases.push(["Uneven", ["z", "a", "b"]], ["Uneven", ["a", "z", "b", "c"]], ["Basic", ["b", "a", "c"]]);

test("R-PLAN: eligible rows compile to a row plan (`$rows`); serverListMounts: false keeps the row-by-row lowering", () => {
  assert.match(planned.code, /_rRowPlan/);
  assert.equal((planned.code.match(/"\$rows":/g) ?? []).length, PLANNED.length);
  assert.doesNotMatch(plain.code, /\$rows|_rRowPlan/);
});

test("R-PLAN: HTML and resume state equal the row-by-row path's (uniform, uneven, nested, empty, object rows)", async () => {
  // Path-addressed rows off: planned rows take the row-by-row path's ids (byte-identical output).
  _setRowPaths(false);
  try {
    for (const [name, items] of cases) {
      const a = await resumableToString(() => withPlans[name]({ items: structuredClone(items) }) as never, { manifest });
      const b = await resumableToString(() => withoutPlans[name]({ items: structuredClone(items) }) as never, { manifest });
      assert.equal(a, b, `${name} × ${items.length}`);
    }
  } finally {
    _setRowPaths(true);
  }
});

test("R-PLAN: path-addressed rows (default) change ids only: the markup equals the row-by-row path's without them", async () => {
  // Path plans number a row's elements by position (row id + 1 + k), whether or not an element takes an id.
  const body = (html: string) =>
    html
      .slice(0, html.indexOf("<script"))
      .replace(/ data-r="\d+"/g, "")
      .replace(/<!--r\d+/g, "<!--r");
  _setRowPaths(true, 1);
  try {
    for (const [name, items] of cases) {
      const a = await resumableToString(() => withPlans[name]({ items: structuredClone(items) }) as never, { manifest });
      const b = await resumableToString(() => withoutPlans[name]({ items: structuredClone(items) }) as never, { manifest });
      assert.equal(body(a), body(b), `${name} × ${items.length}`);
      if ((name === "Basic" || name === "Records") && items.length) assert.match(a, /"w":/, `${name} × ${items.length}`);
    }
  } finally {
    _setRowPaths(true);
  }
});

test("R-PLAN: a list rendered twice in one site, and a page rendering several lists, stay equal", async () => {
  const twice = `
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/server";
export function Page({ items }) {
  const picked = signal("a");
  const open = signal(true);
  return <main>
    <ul><For each={() => items} by={(x) => x}>{(x) => <li class={picked() === x() ? "on" : ""} onClick={() => picked.set(x())}>{x()}</li>}</For></ul>
    <Show when={open()}><ol><For each={() => items.slice(1)} by={(x) => x}>{(x) => <li onClick={() => open.set(false)}>{x()}</li>}</For></ol></Show>
  </main>;
}`;
  const dom = compileResume(twice, "dom").symbols;
  const man: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.map((s) => [s.id, "/c.js"])) };
  const compileTwice = (lists: boolean) =>
    compile(twice, { target: "server", filename: "fixture.tsx", resume: { module: "src/fixture.tsx" }, serverListMounts: lists }).code;
  const [a, b] = await Promise.all([importServer<{ Page: Rows }>(compileTwice(true)), importServer<{ Page: Rows }>(compileTwice(false))]);
  _setRowPaths(false);
  try {
    for (const items of [[], ["a"], letters(5), letters(30)])
      assert.equal(
        await resumableToString(() => a.Page({ items }) as never, { manifest: man }),
        await resumableToString(() => b.Page({ items }) as never, { manifest: man }),
      );
  } finally {
    _setRowPaths(true);
  }
});
