// T4: quick fixes in JavaScript files, SVG refs, CRLF files, multi-line statements.
import { test } from "vitest";
import assert from "node:assert/strict";
import ts from "typescript";
import { applyEdits, codeFixes } from "../index.ts";
import { compiler } from "./helpers.ts";

/** All fixes for the first `code` diagnostic of `source`, applied one by one. */
function fixes(source: string, code: string, filename = "a.tsx"): string[] {
  const options = { filename, resume: { module: filename } };
  const diagnostic = compiler.check(source, options).diagnostics.find((d) => d.code === code);
  assert.ok(diagnostic, `${code} reported for ${source}`);
  const kind = filename.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  return codeFixes(ts, file, diagnostic).map((fix) => applyEdits(source, fix.edits));
}

/** Syntax errors TypeScript reports when parsing `text` as `filename`. */
const syntaxErrors = (text: string, filename: string): string[] => {
  const program = ts.createProgram({
    rootNames: [filename],
    options: { jsx: ts.JsxEmit.Preserve, allowJs: true, checkJs: false, noEmit: true },
    host: {
      ...ts.createCompilerHost({}),
      getSourceFile: (name, target) => (name === filename ? ts.createSourceFile(name, text, target, true) : undefined),
      fileExists: (name) => name === filename,
      readFile: (name) => (name === filename ? text : undefined),
    },
  });
  return program.getSyntacticDiagnostics().map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};

test("ref fixes in a .jsx file emit no type syntax (the file still parses as JavaScript)", () => {
  const source = `export function A() {\n  return <input ref={(el) => el.focus()} />;\n}\n`;
  const [object, local] = fixes(source, "RV2002", "a.jsx");
  assert.match(object!, /const inputRef = ref\(\);\n {2}return <input ref=\{inputRef\} \/>/);
  assert.match(local!, /let inputRef;\n {2}return/);
  for (const out of [object!, local!]) assert.deepEqual(syntaxErrors(out, "a.jsx"), [], out);
  // TSX keeps the typed form.
  assert.match(fixes(source, "RV2002")[0]!, /ref<HTMLElementTagNameMap\["input"\]>\(\)/);
});

test("ref fixes type SVG elements with SVGElementTagNameMap", () => {
  const svg = fixes(`export function A() {\n  return <svg><circle ref={(el) => el.getBBox()} r="1" /></svg>;\n}\n`, "RV2002")[0]!;
  assert.match(svg, /const circleRef = ref<SVGElementTagNameMap\["circle"\]>\(\);/);
  const camel = fixes(`export function A() {\n  return <svg><linearGradient ref={(el) => el.id} /></svg>;\n}\n`, "RV2002")[0]!;
  assert.match(camel, /ref<SVGElementTagNameMap\["linearGradient"\]>/);
  // `a` inside <svg> is an SVG anchor; outside it is HTML.
  const anchor = fixes(`export function A() {\n  return <svg><a ref={(el) => el.focus()} /></svg>;\n}\n`, "RV2002")[0]!;
  assert.match(anchor, /ref<SVGElementTagNameMap\["a"\]>/);
  const html = fixes(`export function A() {\n  return <a ref={(el) => el.focus()} />;\n}\n`, "RV2002")[0]!;
  assert.match(html, /ref<HTMLElementTagNameMap\["a"\]>/);
});

test("fixes keep the file's CRLF line endings", () => {
  const source = `import { signal } from "@rivetjs/reactivity";\r\nexport function A() {\r\n  const s = signal(0);\r\n  window.addEventListener("resize", () => s.set(1));\r\n  return <p>{s()}</p>;\r\n}\r\n`;
  const [out] = fixes(source, "RV2001");
  assert.ok(!/[^\r]\n/.test(out!), JSON.stringify(out));
  assert.match(out!, /import \{ clientEffect \} from "@rivetjs\/runtime\/dom";\r\n/);
  const [ref] = fixes(`export function A() {\r\n  return <input ref={(el) => el.focus()} />;\r\n}\r\n`, "RV2002");
  assert.ok(!/[^\r]\n/.test(ref!), JSON.stringify(ref));
});

test("clientEffect wrap re-indents every line of a multi-line statement", () => {
  const source = `export function A() {\n  window.addEventListener("resize", () => {\n    console.log(1);\n  });\n  return <p />;\n}\n`;
  const [out] = fixes(source, "RV2001");
  assert.equal(
    out!.split("return")[0],
    `import { clientEffect } from "@rivetjs/runtime/dom";\nexport function A() {\n  clientEffect(() => {\n    window.addEventListener("resize", () => {\n      console.log(1);\n    });\n  });\n  `,
  );
});

test("RV1016: wrap a bind-time handler in an arrow that re-selects it per event", () => {
  const head = `const one = () => {}, two = () => {};\nexport const A = (props: { on: () => boolean; event: string }) => `;
  const [conditional] = fixes(head + `<button onClick={(props.on() ? one : two)} />;\n`, "RV1016");
  assert.equal(conditional, head + `<button onClick={(event) => (props.on() ? one : two)?.(event)} />;\n`);
  // The parameter never shadows a name the expression reads.
  const [shadow] = fixes(head + `<button onClick={props.on() && props.event ? one : two} />;\n`, "RV1016");
  assert.equal(shadow, head + `<button onClick={(e) => (props.on() && props.event ? one : two)?.(e)} />;\n`);
  const [call] = fixes(`export const A = (props: { pick: () => () => void }) => <a window:onKeyDown={props.pick()} />;\n`, "RV1016");
  assert.match(call!, /window:onKeyDown=\{\(event\) => \(props\.pick\(\)\)\?\.\(event\)\}/);
  for (const out of [conditional!, shadow!, call!]) assert.deepEqual(syntaxErrors(out, "a.tsx"), [], out);
  // The fixed source compiles.
  assert.deepEqual(compiler.check(conditional!, { filename: "a.tsx", resume: { module: "a.tsx" } }).diagnostics, []);
});

/** The `rivetReconstruct` fix for the first `code` diagnostic, applied; the output compiles without it. */
function reconstructFix(source: string, code: string): string {
  const options = { filename: "a.tsx", resume: { module: "a.tsx" } };
  const diagnostic = compiler.check(source, options).diagnostics.find((d) => d.code === code);
  assert.ok(diagnostic, `${code} reported for ${source}`);
  const file = ts.createSourceFile("a.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fix = codeFixes(ts, file, diagnostic).find((f) => f.fixName === "rivetReconstruct");
  assert.ok(fix, `rivetReconstruct for ${code}`);
  assert.equal(fix.description, "Build it in the browser: reconstruct(() => …)");
  const out = applyEdits(source, fix.edits);
  const after = compiler.check(out, options).diagnostics;
  assert.deepEqual(
    after.filter((d) => d.severity === "error"),
    [],
    out,
  );
  return out;
}

test("RV2003 (captured WeakMap): reconstruct wraps the initializer, reads become calls (T28)", () => {
  const source = `export function A(props: { n: object }) {\n  const m = new WeakMap();\n  return <button onClick={() => console.log(m.has(props.n), { m })}>x</button>;\n}\n`;
  const out = reconstructFix(source, "RV2003");
  assert.match(out, /^import \{ reconstruct \} from "@rivetjs\/runtime\/dom";\n/);
  assert.match(out, /const m = reconstruct\(\(\) => new WeakMap\(\)\);/);
  assert.match(out, /m\(\)\.has\(props\.n\)/);
  assert.match(out, /\{ m: m\(\) \}/);
});

test("RV2003: a typed declaration moves its type to reconstruct<T>; an existing runtime/dom import gains the name", () => {
  const source = `import { clientEffect } from "@rivetjs/runtime/dom";\nexport function A() {\n  const m: WeakMap<object, number> = new WeakMap();\n  clientEffect(() => void m.get(document));\n  return <p>x</p>;\n}\n`;
  const out = reconstructFix(source, "RV2003");
  assert.match(out, /import \{ clientEffect, reconstruct \} from "@rivetjs\/runtime\/dom";/);
  assert.match(out, /const m = reconstruct<WeakMap<object, number>>\(\(\) => new WeakMap\(\)\);/);
  assert.match(out, /m\(\)\.get\(document\)/);
});

test("RV2102 (captured resource class): reconstruct(() => new Conn(…)) and conn().live", () => {
  const source = `class Conn {\n  live = new WebSocket("wss://x");\n}\nexport function A() {\n  const conn = new Conn();\n  return <button onClick={() => conn.live.send("x")}>x</button>;\n}\n`;
  const out = reconstructFix(source, "RV2102");
  assert.match(out, /const conn = reconstruct\(\(\) => new Conn\(\)\);/);
  assert.match(out, /conn\(\)\.live\.send\("x"\)/);
  // A parameter shadowing the name is left alone.
  const shadow = reconstructFix(source.replace(`return <button`, `const f = (conn: Conn) => conn.live;\n  void f;\n  return <button`), "RV2102");
  assert.match(shadow, /const f = \(conn: Conn\) => conn\.live;/);
});

test("rivetReconstruct rewrites only reads of the captured binding: members, enum members, labels, destructuring keys keep the name (T28 review F1)", () => {
  const source = [
    `enum E { m }`,
    `class K { m = 1; n() { return this.m; } }`,
    `class L { m() { return 2; } }`,
    `export function A(props: { n: object; o: { m: number } }) {`,
    `  const m = new WeakMap();`,
    `  const { m: y } = props.o;`,
    `  const obj = { m() { return 1; } };`,
    `  m: for (;;) { break m; }`,
    `  return <button onClick={() => console.log(m.has(props.n), y, obj.m(), E.m, new K().m, new L().m())}>x</button>;`,
    `}`,
    ``,
  ].join("\n");
  const out = reconstructFix(source, "RV2003");
  assert.match(out, /const m = reconstruct\(\(\) => new WeakMap\(\)\);/);
  assert.match(out, /console\.log\(m\(\)\.has\(props\.n\), y, obj\.m\(\), E\.m, new K\(\)\.m, new L\(\)\.m\(\)\)/);
  for (const kept of [
    `enum E { m }`,
    `class K { m = 1; n() { return this.m; } }`,
    `class L { m() { return 2; } }`,
    `const { m: y } = props.o;`,
    `const obj = { m() { return 1; } };`,
    `m: for (;;) { break m; }`,
  ])
    assert.ok(out.includes(kept), `${kept} kept in:\n${out}`);
});

test("rivetReconstruct: `typeof x` in a type becomes ReturnType<typeof x> (T28 review F2)", () => {
  const source = `export function A() {\n  const m = new WeakMap<object, number>();\n  let last: typeof m | undefined;\n  void last;\n  return <button onClick={() => m.set(document, 1)}>x</button>;\n}\n`;
  const out = reconstructFix(source, "RV2003");
  assert.match(out, /let last: ReturnType<typeof m> \| undefined;/);
  assert.match(out, /m\(\)\.set\(document, 1\)/);
});

test("rivetReconstruct: `typeof x.a.b` indexes ReturnType; an instantiation expression `x<T>` gets no fix (T29 review F5)", () => {
  const source = `export function A() {\n  const m = new WeakMap<object, number>();\n  let has: typeof m.has | undefined;\n  void has;\n  return <button onClick={() => m.set(document, 1)}>x</button>;\n}\n`;
  const out = reconstructFix(source, "RV2003");
  assert.match(out, /let has: ReturnType<typeof m>\["has"\] \| undefined;/);
  const generic = `export function A() {\n  const m = new WeakMap();\n  const g = m<object>;\n  void g;\n  return <button onClick={() => m.has(document)}>x</button>;\n}\n`;
  const file = ts.createSourceFile("a.tsx", generic, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const start = generic.indexOf("() => m.has");
  const diagnostic = { code: "RV2003", start, end: start + 23, message: "Resumable code cannot capture `m`: WeakMap instance is not serializable" };
  assert.deepEqual(
    codeFixes(ts, file, diagnostic).filter((f) => f.fixName === "rivetReconstruct"),
    [],
  );
  // Control: the same source without the instantiation expression gets the fix.
  const plain = generic.replace("  const g = m<object>;\n  void g;\n", "");
  const control = ts.createSourceFile("a.tsx", plain, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = plain.indexOf("() => m.has");
  assert.equal(codeFixes(ts, control, { ...diagnostic, start: at, end: at + 23 }).filter((f) => f.fixName === "rivetReconstruct").length, 1);
});

test("rivetReconstruct: an existing (aliased) reconstruct import is reused; a .ts module gets no fix (T28 review F3)", () => {
  const aliased = `import { reconstruct as build } from "@rivetjs/runtime/dom";\nexport function A() {\n  const m = new WeakMap();\n  return <button onClick={() => m.has(document)}>x</button>;\n}\n`;
  const out = reconstructFix(aliased, "RV2003");
  assert.match(out, /const m = build\(\(\) => new WeakMap\(\)\);/);
  assert.equal(out.match(/import /g)!.length, 1, out);
  const ts_ = `export const m = new WeakMap();\nexport const read = () => m.has(globalThis);\n`;
  const file = ts.createSourceFile("a.ts", ts_, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const start = ts_.indexOf("() => m.has");
  const diagnostic = { code: "RV2003", start, end: start + 18, message: "Resumable code cannot capture `m`: class instances are not serializable" };
  assert.deepEqual(codeFixes(ts, file, diagnostic), []);
});
