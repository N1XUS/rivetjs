// RV1017: a signal written from its own read in a provably tracked scope (effect / clientEffect / computed, through batch);
// silent wherever the scope is not provably tracked (handlers, callbacks, untrack, component bodies, JSX).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { analyzeFile, applyEdits, codeFixes, createLanguageCore, selfWrites, type CheckDiagnostic } from "../index.ts";
import { compiler, tempApp } from "./helpers.ts";

const HEAD = `import { batch, computed, effect, signal, untrack } from "@rivetjs/reactivity";\nimport { clientEffect } from "@rivetjs/runtime/dom";\n`;

/** One program over every case file (one type-check setup); `files` = name → body (HEAD prepended). */
const CASES: Record<string, string> = {
  // Positive.
  effectArithmetic: `const x = signal(0);\neffect(() => { x.set(x() + 1); });`,
  effectConcise: `const x = signal(0);\neffect(() => x.set(x() * 2));`,
  effectSpread: `const items = signal<string[]>([]);\nconst next = signal("");\neffect(() => {\n  if (next()) items.set([...items(), next()]);\n});`,
  effectNested: `const x = signal(1), y = signal(2);\neffect(() => {\n  for (let i = 0; i < 2; i++) x.set(Math.max(x(), y()) + (x() > 3 ? 1 : 0));\n});`,
  computedWrite: `const x = signal(0);\nexport const c = computed(() => x.set(x() + 1));`,
  clientEffectWrite: `const x = signal(0);\nexport function C() {\n  clientEffect(() => { x.set(x() + 1); });\n  return null;\n}`,
  batchInEffect: `const x = signal(0);\neffect(() => batch(() => x.set(x() + 1)));`,
  effectInHandler: `const x = signal(0);\nexport const A = () => <button onClick={() => effect(() => x.set(x() + 1))} />;`,
  imported: `import { count } from "./state.ts";\neffect(() => count.set(count() + 1));`,
  namespaceImport: `import * as r from "@rivetjs/reactivity";\nconst x = r.signal(0);\nr.effect(() => x.set(x() + 1));`,
  memberSignal: `const state = { x: signal(0) };\neffect(() => state.x.set(state.x() + 1));`,
  objectValue: `const x = signal({ n: 0 });\neffect(() => x.set({ n: x().n + 1 }));`,
  usesV: `const x = signal(0);\nconst v = signal(1);\neffect(() => x.set(x() + v()));`,
  // Negative.
  onClick: `const x = signal(0);\nexport const A = () => <button onClick={() => x.set(x() + 1)}>{x()}</button>;`,
  onColon: `const x = signal(0);\nexport const A = () => <button on:click={() => x.set(x() + 1)} />;`,
  untracked: `const x = signal(0);\neffect(() => untrack(() => x.set(x() + 1)));`,
  otherSignal: `const x = signal(0), y = signal(0);\neffect(() => y.set(x() + 1));`,
  update: `const x = signal(0);\neffect(() => x.update((v) => v + 1));`,
  unknownCallback: `declare function later(fn: () => void): void;\nconst x = signal(0);\neffect(() => later(() => x.set(x() + 1)));`,
  timer: `const x = signal(0);\neffect(() => { setTimeout(() => x.set(x() + 1)); });`,
  asyncEffect: `const x = signal(0);\neffect(async () => { x.set(x() + 1); });`,
  renderBody: `const x = signal(0);\nexport function C() {\n  x.set(x() + 1);\n  return <p>{x()}</p>;\n}`,
  readInCallback: `const xs = signal([1]);\neffect(() => xs.set([1].filter((n) => n !== xs()[0])));`,
  notSignal: `const m = Object.assign(() => 1, { set(v: number) { return v; } });\neffect(() => m.set(m() + 1));`,
  shadowed: `const x = signal(0);\nfunction run(effect: (fn: () => void) => void) {\n  effect(() => x.set(x() + 1));\n}\nrun((fn) => fn());`,
  handlerFunction: `const x = signal(0);\nconst bump = () => x.set(x() + 1);\neffect(bump);`,
  jsxInEffect: `const x = signal(0);\neffect(() => { void (<b onClick={() => x.set(x() + 1)} />); });`,
};

let root = "";
let program: ts.Program;
const file = (name: string) => program.getSourceFile(join(root, "src", name + ".tsx"))!;
const hits = (name: string): CheckDiagnostic[] => selfWrites(ts, file(name), program.getTypeChecker());

beforeAll(() => {
  const files: Record<string, string> = { "src/state.ts": `import { signal } from "@rivetjs/reactivity";\nexport const count = signal(0);\n` };
  for (const [name, body] of Object.entries(CASES)) files[`src/${name}.tsx`] = HEAD + body + "\n";
  root = tempApp(files);
  program = ts.createProgram({
    rootNames: Object.keys(files).map((path) => join(root, path)),
    options: {
      jsx: ts.JsxEmit.Preserve,
      jsxImportSource: "@rivetjs/runtime",
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      allowImportingTsExtensions: true,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
  });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("RV1017 self-write", () => {
  it.each([
    ["effectArithmetic", ["x.set(x() + 1)"]],
    ["effectConcise", ["x.set(x() * 2)"]],
    ["effectSpread", ["items.set([...items(), next()])"]],
    ["effectNested", ["x.set(Math.max(x(), y()) + (x() > 3 ? 1 : 0))"]],
    ["computedWrite", ["x.set(x() + 1)"]],
    ["clientEffectWrite", ["x.set(x() + 1)"]],
    ["batchInEffect", ["x.set(x() + 1)"]],
    ["effectInHandler", ["x.set(x() + 1)"]],
    ["imported", ["count.set(count() + 1)"]],
    ["namespaceImport", ["x.set(x() + 1)"]],
    ["memberSignal", ["state.x.set(state.x() + 1)"]],
    ["objectValue", ["x.set({ n: x().n + 1 })"]],
  ])("warns: %s", (name, expected) => {
    const found = hits(name);
    expect(found.map((d) => file(name).text.slice(d.start, d.end))).toEqual(expected);
    for (const d of found) expect(d).toMatchObject({ code: "RV1017", severity: "warning" });
  });
  it("names the scope in the message", () => {
    expect(hits("effectArithmetic")[0]!.message).toMatch(/^`x` is read and written in an effect: .*Use `x\.update\(\(v\) => …\)`/);
    expect(hits("computedWrite")[0]!.message).toMatch(/^`x` is read and written in a computed: .*signal writes throw/);
  });
  it.each(Object.keys(CASES).filter((name) => !/^(effect|computed|clientEffect|batch|imported|namespace|member|object|usesV)/.test(name)))(
    "silent: %s",
    (name) => expect(hits(name)).toEqual([]),
  );

  const fixed = (name: string): string | undefined => {
    const f = file(name);
    const [d] = hits(name);
    const [fix, ...rest] = codeFixes(ts, f, d!);
    expect(rest).toEqual([]);
    return fix && applyEdits(f.text, fix.edits).slice(HEAD.length).trim();
  };
  it("quick fix: x.set(<expr>) → x.update((v) => <expr with x() as v>)", () => {
    expect(fixed("effectArithmetic")).toBe(`const x = signal(0);\neffect(() => { x.update((v) => v + 1); });`);
    expect(fixed("effectSpread")).toContain(`if (next()) items.update((v) => [...v, next()]);`);
    expect(fixed("effectNested")).toContain(`x.update((v) => Math.max(v, y()) + (v > 3 ? 1 : 0))`);
    expect(fixed("batchInEffect")).toBe(`const x = signal(0);\neffect(() => batch(() => x.update((v) => v + 1)));`);
    expect(fixed("memberSignal")).toContain(`effect(() => state.x.update((v) => v + 1));`);
    expect(fixed("objectValue")).toContain(`effect(() => x.update((v) => ({ n: v.n + 1 })));`);
    expect(fixed("usesV")).toContain(`effect(() => x.update((value) => value + v()));`);
    expect(codeFixes(ts, file("effectArithmetic"), hits("effectArithmetic")[0]!)[0]!.fixName).toBe("rivetSignalUpdate");
  });
  it("quick fix: none in a computed (every write throws there)", () => expect(fixed("computedWrite")).toBeUndefined());
  it("analyzeFile reports it with line, column and docs link", () => {
    const core = createLanguageCore({ compiler });
    const found = analyzeFile(ts, core, program, file("effectArithmetic"), { typeAware: false }).diagnostics.filter((d) => d.code === "RV1017");
    expect(found).toMatchObject([{ line: 4, column: 16, docs: "https://rivetjs.severyn.pro/errors/RV1017" }]);
  });
});
