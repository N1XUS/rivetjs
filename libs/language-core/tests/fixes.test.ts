// T4: quick fixes in CRLF files, multi-line statements, bind-time handlers.
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

test("fixes keep the file's CRLF line endings", () => {
  const source = `import { signal } from "@rivetjs/reactivity";\r\nexport function A() {\r\n  const s = signal(0);\r\n  window.addEventListener("resize", () => s.set(1));\r\n  return <p>{s()}</p>;\r\n}\r\n`;
  const [out] = fixes(source, "RV2001");
  assert.ok(!/[^\r]\n/.test(out!), JSON.stringify(out));
  assert.match(out!, /import \{ clientEffect \} from "@rivetjs\/runtime\/dom";\r\n/);
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
