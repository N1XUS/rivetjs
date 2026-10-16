import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "../../runtime/tests/resume/compile.ts";

// SRV-ROWFN (server resume target): resumed attribute reads are module-level functions over the captures
// array, one shared captures array per row template when the lists repeat, closed `<For by>` hoisted.
// Differential: the `plain` variant defeats every rewrite (a `__rivet` string in the read keeps the thunk,
// a dead write to `selected` keeps per-call arrays — a `var`, so Function Bridge T8 does not box it into a cell —,
// `by` reads the props) and must render the same HTML + state.
const source = (plain: boolean) => `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/server";
export function Page(p: { rows: { id: number; label: string }[] }) {
  ${plain ? "var" : "let"} selected = signal(-1);
  ${plain ? "if (p.rows.length < 0) selected = signal(-2);" : ""}
  return <main><For each={() => p.rows} by={(r: { id: number }) => r.id${plain ? " + 0 * p.rows.length" : ""}}>{(row) =>
    <article data-state={selected() === row().id ? "selected" : "even"${plain ? ' + "__rivet".slice(7)' : ""}} data-id={row().id}>
      <button onClick={() => selected.set(row().id)}>{row().label}</button>
    </article>}</For></main>;
}
`;

const rows = [
  { id: 1, label: "a" },
  { id: 2, label: "b<" },
  { id: 3, label: "c" },
];

test("lifted read, shared row captures and hoisted key keep server output identical", async () => {
  const fast = compileResume(source(false), "server").code;
  const plain = compileResume(source(true), "server").code;
  assert.match(fast, /const __rivetRead\d+ = \(__rivetCaps\) => \{\s*const selected = __rivetCaps\[0\], row = __rivetCaps\[1\];/);
  assert.match(fast, /const __rivetBy\d+ = \(r\) => r\.id;/);
  assert.match(fast, /\(row\) => \{\s*const __rivetCaps = \[selected, row\];\s*return /);
  assert.match(fast, /__rivetR_attr\("data-state", "[^"]+", __rivetRead\d+, __rivetCaps\)/);
  assert.match(fast, /__rivetR_on\("click", "[^"]+", __rivetCaps\)/);
  assert.doesNotMatch(plain, /__rivetCaps\b|__rivetBy/);
  assert.match(plain, /__rivetR_attr\("data-state", "[^"]+", \(\) => /);
  // Symbol ids are content hashes: the plain variant's (other code) differ — compared through the fast ones (same order).
  const [symbols, plainSymbols] = [compileResume(source(false), "dom").symbols, compileResume(source(true), "dom").symbols];
  assert.equal(symbols.length, plainSymbols.length);
  const manifestOf = (list: typeof symbols): ResumeManifest => ({
    runtime: "/rt.js",
    symbols: Object.fromEntries(list.map((s) => [s.id, "/c/" + s.component + ".js"])),
  });
  const same = (html: string): string =>
    plainSymbols.reduce((out, s, i) => out.replaceAll(s.name.slice(s.name.indexOf("$")), symbols[i]!.name.slice(symbols[i]!.name.indexOf("$"))), html);
  type Mod = { Page(p: { rows: typeof rows }): never };
  const [a, b] = [await importServer<Mod>(fast + "\n// fast"), await importServer<Mod>(plain + "\n// plain")];
  for (const input of [{ rows }, { rows: [] }]) {
    const x = await resumableToString(() => a.Page(input), { manifest: manifestOf(symbols) });
    const y = await resumableToString(() => b.Page(input), { manifest: manifestOf(plainSymbols) });
    assert.equal(x, same(y));
  }
});

test("captures are not shared when a captured binding is written, or across templates", () => {
  const code = compileResume(
    `import { signal } from "@rivetjs/reactivity";
export function Counter() {
  let n = signal(0);
  const reset = () => { n = signal(0); };
  return <div data-n={n()} onClick={() => n.set(n() + 1)}><span data-m={n()} onClick={reset} /></div>;
}
export function Split() {
  const n = signal(0);
  return <div data-n={n()}>{() => <b onClick={() => n.set(1)} />}</div>;
}`,
    "server",
  ).code;
  assert.doesNotMatch(code, /__rivetCaps =/);
  assert.match(code, /const __rivetRead\d+ = \(__rivetCaps\) => \{\s*const n = __rivetCaps\[0\];/);
});

test("reads depending on the enclosing function stay thunks", () => {
  const code = compileResume(
    `import { signal } from "@rivetjs/reactivity";
export function A() {
  const n = signal(0);
  return <div data-a={(function () { return arguments.length + n(); })()} />;
}`,
    "server",
  ).code;
  assert.doesNotMatch(code, /__rivetRead/);
});
