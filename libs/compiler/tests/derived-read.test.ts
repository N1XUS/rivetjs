// ZERO REGRESS props read back (`rust/src/compile/derived_read.rs`): the server target names, in `_rB`'s sixth argument,
// the props of an independent element-root boundary whose every use is the sole text of a native element on a static
// path from the root element (`"key=path"`, `f` firstChild / `n` nextSibling); the record leaves those values out and the
// browser reads them from the markup (runtime proof: libs/runtime/tests/derived-read-back-browser.test.ts).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "../index.ts";

const it = (name: string, fn: () => void) => (hasDerivedModel() ? test(name, fn) : test.skip(name + " — wasm without the derived model", fn));
const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { title: string }) {
  const read = signal(false);
  return <li class="card"><p>{props.title}</p><button type="button" onClick={() => read.update((v) => !v)}>{read() ? "Read" : "Not read"}</button></li>;
}
export function Mixed({ title, n }: { title: string; n: number }) {
  const read = signal(false);
  return <li>text <b>x</b>{"lit"}<span>{n}</span><button onClick={() => alert(title)}>{read() ? title : "-"}</button></li>;
}
export function Nested({ title, sub }: { title: string; sub: string }) {
  const read = signal(false);
  return <li><i>{read() ? 1 : 2}</i><p>{title}</p><div><h3>{sub}</h3></div><button onClick={() => read.set(true)}>x</button></li>;
}
export function Spread(props: { title: string }) {
  const read = signal(false);
  return <li {...props}><p>{props.title}</p><button onClick={() => read.set(true)}>x</button></li>;
}
export function Attr(props: { title: string; label: string }) {
  const read = signal(false);
  return <li><h2>{props.label}</h2><p title={props.title}>{props.title}</p><button onClick={() => read.set(true)}>{props.label}</button></li>;
}
export function Root({ title }: { title: string }) {
  const read = signal(false);
  return <li onClick={() => read.set(true)}>{title}</li>;
}
export function Passed(props: { title: string }) {
  const read = signal(false);
  return <li onClick={() => read.set(true)}><p>{props.title}</p>{String(props)}</li>;
}
export function Opaque({ title }: { title: string }) {
  const read = signal(false);
  return <li onClick={() => read.set(true)}><textarea>{title}</textarea><pre>{title}</pre></li>;
}
export function Dependent({ title }: { title: string }) {
  const read = signal(false);
  return <li onClick={() => read.set(true)}><p>{title}</p></li>;
}
`;
const NAMES = ["Card", "Mixed", "Nested", "Spread", "Attr", "Root", "Passed", "Opaque", "Dependent"];
const RESUME = { module: "src/c.tsx", boundaries: NAMES, independent: NAMES.filter((n) => n !== "Dependent") };
/** Boundary name → the `read` argument of its `_rB` (null: none). */
const reads = (target: "server" | "dom"): Record<string, string | null> => {
  const out = compile(SOURCE, { target, filename: "src/c.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const found: Record<string, string | null> = {};
  for (const m of out.code.matchAll(/__rivetR_b\("src\/c\.tsx#(\w+)", (\d+), ([\s\S]*?)\);?\n/g)) {
    const read = /, undefined, "([^"]*)"\)?$/.exec(m[3]!.trim());
    found[m[1]!] = read ? read[1]! : null;
  }
  return found;
};

it("server: each prop whose every use is an element's sole text, by path from the root element", () => {
  assert.deepEqual(reads("server"), {
    Card: "title=f",
    // `title` also reaches a handler and a conditional text: shipped; `n` after a text run, an element and a folded literal.
    Mixed: "n=fnnn",
    Nested: "title=fn sub=fnnf",
    // A spread root: any key may reach an attribute.
    Spread: null,
    // `title` is an attribute too: shipped.
    Attr: "label=f",
    // The root element's own text.
    Root: "title=",
    // `props` itself is used: any key may be read elsewhere.
    Passed: null,
    // Text the HTML parser rewrites or keeps out of `textContent` (textarea's first newline, pre).
    Opaque: null,
    // Only independent boundaries adopt standalone from their record.
    Dependent: null,
  });
});

it("dom target: no read argument (the server decides what ships; the runtime reads the names table)", () => {
  const dom = compile(SOURCE, { target: "dom", filename: "src/c.tsx", resume: RESUME } as never);
  assert.doesNotMatch(dom.code, /"title=/);
});
