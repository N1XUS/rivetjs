import { test } from "vitest";
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { analyzeFile, createLanguageCore, serializabilityDiagnostics } from "../index.ts";
import { compiler, repo, tempApp } from "./helpers.ts";

const source = `
import { signal, computed } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
class Store { items: string[] = []; }
declare function makeStore(): Store;
declare function load(): Promise<string>;
interface Row { id: number; when: Date; tags: Set<string>; meta: Map<string, { url: URL }> }
export function View({ rows, holder, node }: { rows: Row[]; holder: { store: Store }; node: HTMLDivElement }) {
  const store = makeStore();
  const pending = load();
  const count = signal(0);
  const doubled = computed(() => count() * 2);
  const plain = { a: 1, b: [true, null] as const, c: undefined as string | undefined };
  const sym = Symbol("x");
  let el!: HTMLElement;
  const helper = () => count();
  clientEffect(() => {
    void [store, pending, rows, holder, count, doubled, plain, sym, el, helper(), node];
  });
  return <i ref={(e) => (el = e)}>{count()}</i>;
}
`;

test("RV2101 warns for captures whose types resume state cannot carry", () => {
  const root = tempApp({ "src/view.tsx": source });
  try {
    const file = join(root, "src/view.tsx");
    const config = ts.getParsedCommandLineOfConfigFile(join(repo, "tsconfig.base.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
    const program = ts.createProgram([file], { ...config.options, noEmit: true });
    const { sites, diagnostics } = compiler.check(ts.sys.readFile(file)!, { filename: file, resume: { module: "src/view.tsx" } });
    assert.deepEqual(diagnostics, []);
    const warnings = serializabilityDiagnostics(ts, program.getTypeChecker(), program.getSourceFile(file)!, sites);
    const byName = Object.fromEntries(warnings.map((w) => [w.message.slice(1, w.message.indexOf("`", 1)), w]));
    assert.deepEqual(Object.keys(byName).sort(), ["holder", "node", "pending", "store", "sym"]);
    assert.match(byName.store!.message, /class instance \(Store\)/);
    assert.match(byName.pending!.message, /Promise/);
    assert.match(byName.holder!.message, /\.store: class instance \(Store\)/);
    assert.match(byName.node!.message, /DOM node/);
    assert.match(byName.sym!.message, /symbol/);
    for (const warning of warnings) {
      assert.equal(warning.code, "RV2101");
      assert.equal(warning.severity, "warning");
      assert.equal(source.slice(warning.start, warning.end), warning.message.slice(1, warning.message.indexOf("`", 1)));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("RV2101 trusts the compiler's class verdicts: data / revive classes of resume modules are not flagged (T28, T24 L4)", () => {
  const model = `import { revive } from "@rivetjs/runtime/resume-format";
export class Point { constructor(public x: number, public y: number) {} }
export class Lazy { n = 1; static [revive](data: unknown) { void data; return new Lazy(); } }
export class Secret { #n = 1; get n() { return this.#n; } }
`;
  const view = `import { clientEffect } from "@rivetjs/runtime/dom";
import { Point, Lazy, Secret } from "./model.tsx";
import { Plain } from "./plain.tsx";
class Local { items: string[] = []; }
declare function make<T>(): T;
export function View() {
  const point = make<Point>();
  const lazy = make<Lazy>();
  const secret = make<Secret>();
  const plain = make<Plain>();
  const local = make<Local>();
  clientEffect(() => { void [point, lazy, secret, plain, local]; });
  return <p>x</p>;
}
`;
  const root = tempApp({
    "src/view.tsx": view,
    "src/model.tsx": model,
    "src/plain.tsx": `export class Plain { n = 1; }\n`,
    ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/view.tsx", "src/model.tsx"] }),
  });
  try {
    const file = join(root, "src/view.tsx");
    const config = ts.getParsedCommandLineOfConfigFile(join(repo, "tsconfig.base.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
    const program = ts.createProgram([file], { ...config.options, noEmit: true });
    const core = createLanguageCore({ compiler });
    const { diagnostics } = analyzeFile(ts, core, program, program.getSourceFile(file)!);
    const flagged = diagnostics.filter((d) => d.code === "RV2101").map((d) => d.message.slice(1, d.message.indexOf("`", 1)));
    // Point (data) / Lazy (static [revive]) / Local (data, same module) resume; Secret has a private field; Plain's module is not resume-compiled.
    assert.deepEqual(flagged.sort(), ["plain", "secret"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("RV2101 class verdicts follow edits of the class module; a node_modules class is still flagged (T28 review F4)", () => {
  const view = `import { clientEffect } from "@rivetjs/runtime/dom";
import { Point } from "./model.tsx";
import { Pkg } from "../node_modules/fake-pkg/model.tsx";
declare function make<T>(): T;
export function View() {
  const point = make<Point>();
  const pkg = make<Pkg>();
  clientEffect(() => { void [point, pkg]; });
  return <p>x</p>;
}
`;
  const root = tempApp({
    "src/view.tsx": view,
    "src/model.tsx": `export class Point { x = 1; }\n`,
    "node_modules/fake-pkg/model.tsx": `export class Pkg { x = 1; }\n`,
    ".rivet/editor.json": JSON.stringify({ version: 1, resumeModules: ["src/view.tsx", "src/model.tsx", "node_modules/fake-pkg/model.tsx"] }),
  });
  try {
    const file = join(root, "src/view.tsx");
    const config = ts.getParsedCommandLineOfConfigFile(join(repo, "tsconfig.base.json"), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} })!;
    const core = createLanguageCore({ compiler });
    const flagged = (): string[] => {
      const program = ts.createProgram([file], { ...config.options, noEmit: true });
      const { diagnostics } = analyzeFile(ts, core, program, program.getSourceFile(file)!);
      return diagnostics.filter((d) => d.code === "RV2101").map((d) => d.message.slice(1, d.message.indexOf("`", 1)));
    };
    assert.deepEqual(flagged(), ["pkg"]);
    // The class gains a private field: the module's new text is checked again, Point no longer resumes as data.
    writeFileSync(join(root, "src/model.tsx"), `export class Point { #x = 1; get x() { return this.#x; } }\n`);
    assert.deepEqual(flagged().sort(), ["pkg", "point"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
