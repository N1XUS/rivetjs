// DIAG-VERBOSE: every dev / build diagnostic names where it comes from (file:line:col + code frame), which package
// reported it and how to fix it (`diagnostics-format.ts`, the Vite plugin's compile errors, dev source stamps).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { appFrames, codeFrame, displayPath, formatDiagnostic, remedyLines, remedyOf } from "../diagnostics-format.ts";
import { docsUrl } from "../codes.ts";
import { sourceStamps } from "../hot.ts";
import { rivet } from "../vite.ts";

test("codeFrame: context lines, gutter and a caret under the column", () => {
  const source = "one\ntwo\n  three(x)\nfour\nfive\nsix";
  assert.equal(codeFrame(source, 3, 8), ["    1 | one", "    2 | two", "  > 3 |   three(x)", "      |        ^", "    4 | four", "    5 | five"].join("\n"));
  assert.equal(codeFrame(source, 1, 1, 0), "  > 1 | one\n      | ^");
  assert.equal(codeFrame(source, 99, 1), "");
});

test("formatDiagnostic: origin, code, location, frame, fix and docs", () => {
  const text = formatDiagnostic(
    {
      origin: "compiler",
      code: "RV1002",
      message: "Spread children are not supported",
      file: "/app/src/a.tsx",
      line: 2,
      column: 15,
      source: "const a = 1;\nexport const A = () => <ul>{...xs}</ul>;\n",
    },
    { root: "/app" },
  );
  const lines = text.split("\n");
  assert.equal(lines[0], "error: [rivet:compiler] RV1002 Spread children are not supported");
  assert.equal(lines[1], "  at src/a.tsx:2:15");
  assert.match(text, /> 2 \| export const A = \(\) => <ul>\{\.\.\.xs\}<\/ul>;\n\s+\|\s{15}\^/);
  assert.match(text, /\n  fix: Render the array as an expression child/);
  assert.ok(text.endsWith("\n  docs: " + docsUrl("RV1002")));
  // No code, no file: just the message (and an explicit fix / docs when given).
  assert.equal(formatDiagnostic({ origin: "router", message: "x", fix: "do y", docs: "https://d" }), "[rivet:router] x\n  fix: do y\n  docs: https://d");
});

test("remedies come from the language-core explanation table; displayPath keeps outside paths absolute", () => {
  assert.match(remedyOf("RV1016") ?? "", /arrow/);
  assert.equal(remedyOf("RV0000"), undefined);
  assert.equal(remedyLines("RV1002", "custom", undefined), "\n  fix: custom\n  docs: " + docsUrl("RV1002"));
  assert.equal(displayPath("/app/src/a.tsx", "/app"), "src/a.tsx");
  assert.equal(displayPath("/lib/a.tsx", "/app"), "/lib/a.tsx");
});

test("appFrames: first frames inside the root, outside node_modules and .rivet", () => {
  const stack = [
    "Error",
    "    at Object.locate (/repo/libs/compiler/vite.ts:10:5)",
    "    at labelProps (/repo/node_modules/@rivetjs/cdk/label/behaviour.ts:51:13)",
    "    at TextField (/app/.rivet/app.tsx:3:3)",
    "    at Module.Field (/app/src/field.tsx:12:7)",
    "    at /app/src/routes/index.tsx:4:10",
    "    at Page (/app/src/routes/page.tsx:1:1)",
  ].join("\n");
  assert.equal(appFrames(stack, "/app"), "at Field (src/field.tsx:12:7) ← at src/routes/index.tsx:4:10");
  assert.equal(appFrames(stack, "/elsewhere"), "");
});

test("sourceStamps: capitalized declarations and their hot wrappers, guarded by typeof", () => {
  const source = "export function Card(props) {\n  return null;\n}\nconst helper = 1;\nexport const List = (p) => null;\nconst MAX = 3;\n";
  const code = 'const __rivetHot0 = __rivetHot(Card, "src/card.tsx#Card");\n';
  const stamps = sourceStamps(source, "src/card.tsx", code);
  assert.match(stamps, /typeof Card === "function" && m\.set\(Card, \["Card","src\/card\.tsx:1:17"\]\);/);
  assert.match(stamps, /typeof List === "function" && m\.set\(List, \["List","src\/card\.tsx:5:14"\]\);/);
  assert.match(stamps, /typeof MAX === "function"/);
  assert.doesNotMatch(stamps, /helper/);
  assert.match(stamps, /m\.set\(__rivetHot0, \["Card","src\/card\.tsx:1:17"\]\);/);
  assert.match(stamps, /globalThis\[Symbol\.for\("rivet\.sources"\)\] \?\?= new WeakMap\(\)/);
  // Evaluates: functions registered, non-functions skipped, undeclared names harmless.
  const key = Symbol.for("rivet.sources");
  delete (globalThis as Record<symbol, unknown>)[key];
  const Card = () => null;
  new Function("Card", "List", "MAX", "__rivetHot0", stamps)(Card, undefined, 3, Card);
  assert.deepEqual((globalThis as Record<symbol, WeakMap<object, unknown>>)[key]!.get(Card), ["Card", "src/card.tsx:1:17"]);
  assert.equal(sourceStamps("const a = 1;\n", "a.tsx", ""), "");
});

test("Vite compile errors: [RVnnnn] file:line:col header, frame, fix and docs lines", () => {
  mkdirSync(".artifacts", { recursive: true });
  const dir = mkdtempSync(resolve(".artifacts/rivet-diag-"));
  try {
    const file = join(dir, "bad.tsx");
    const source = "export const A = (p: { xs: any[] }) => (\n  <ul>{...p.xs}</ul>\n);\nexport const B = () => <br>x</br>;\n";
    writeFileSync(file, source);
    const plugin = rivet();
    const transform = plugin.transform as unknown as (this: unknown, code: string, id: string) => unknown;
    let error: { message: string; frame?: string; loc?: { line: number; column: number }; plugin?: string; pluginCode?: string; url?: string } | undefined;
    try {
      transform.call(
        {
          error(value: typeof error): never {
            error = value;
            throw Error(value!.message);
          },
        },
        source,
        file,
      );
    } catch {
      // Thrown by the stub after recording.
    }
    assert.ok(error, "transform failed");
    const [first, ...rest] = error.message.split("\n");
    assert.match(first!, new RegExp(`^\\[RV1002\\] ${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:2:\\d+: Spread children are not supported`));
    assert.match(rest.join("\n"), /^  fix: Render the array as an expression child/m);
    assert.match(rest.join("\n"), new RegExp("^  docs: " + docsUrl("RV1002").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "$", "m"));
    // The second diagnostic carries its own frame in the message; the first one's frame is the error's `frame`.
    assert.match(error.message, /\[RV1008\] .*:4:\d+: Void elements cannot have children[^\n]*\n(?: {4}.*\n)*  > 4 \| export const B/);
    assert.match(error.frame!, /> 2 \|   <ul>\{\.\.\.p\.xs\}<\/ul>\n\s+\|\s+\^/);
    assert.equal(error.loc?.line, 2);
    assert.equal(error.plugin, "vite-plugin-rivet");
    assert.equal(error.pluginCode, "RV1002");
    assert.equal(error.url, docsUrl("RV1002"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Vite groups same-code warnings in a file and does not repeat them on another transform", async () => {
  mkdirSync(".artifacts", { recursive: true });
  const dir = mkdtempSync(resolve(".artifacts/rivet-warning-"));
  try {
    const file = join(dir, "warning.tsx");
    const source =
      'import { signal } from "@rivetjs/reactivity"; export function Counter(p: {list: number[]}) { const all = []; for (const n of p.list) { all.push(signal(n)); all.push(signal(n)); } return <p onClick={() => all[0]?.set(1)} />; }';
    writeFileSync(file, source);
    const plugin = rivet({ resume: { modules: [file] }, comptime: false });
    const messages: string[] = [];
    const summaries: string[] = [];
    (plugin.configResolved as (config: unknown) => void)({
      root: dir,
      command: "build",
      plugins: [],
      logger: {
        warn(message: string) {
          summaries.push(message);
        },
      },
    });
    const transform = plugin.transform as unknown as (this: unknown, code: string, id: string, options: { ssr: boolean }) => unknown;
    const ctx = {
      warn(message: string) {
        messages.push(message);
      },
      error(value: { message: string }): never {
        throw new Error(value.message);
      },
    };
    await transform.call(ctx, source, file, { ssr: true });
    await transform.call(ctx, source, file, { ssr: true });
    (plugin.buildEnd as () => void)();
    assert.deepEqual(summaries, ["[rivet:compiler] 0 errors, 2 warnings"]);
    assert.equal(messages.length, 1, messages.join("\n"));
    assert.match(messages[0]!, /warning: \[rivet:compiler\] RV2104/);
    assert.match(messages[0]!, /occurrences: 2/);
    assert.match(messages[0]!, /docs: https:\/\/rivetjs.severyn.pro\/errors\/RV2104/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
