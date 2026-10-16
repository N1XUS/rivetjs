// Foreign JSX types (bridge ABI, types only): `RivetForeignObjects` / `RivetForeignProps<C>` registries that framework
// bridges augment. Without an augmentation JSX typing is unchanged; with one, foreign components type as islands.
// Virtual fixtures (a compiler host overlay), so the augmentation never leaks into the runtime project.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./jsx-foreign/", import.meta.url));
const files: Record<string, string> = {
  // A fake framework: class components plus function components that return its own node type.
  "fake-fw.ts": `
export interface FakeNode { readonly $$fake: true }
export declare class FakeClass<P> { constructor(props: P); declare readonly $$props: P; render(): FakeNode }
export type FakeFC<P> = (props: P) => FakeNode;
export declare class Counter extends FakeClass<{ start: number }> {}
export declare const Label: FakeFC<{ text: string }>;
`,
  // What a bridge package's types do.
  "fake-bridge.ts": `
import type { FakeClass, FakeNode } from "./fake-fw.ts";
type Client = "load" | "idle" | "visible" | "interaction" | "only";
type Island<P> = P & { client?: Client };
declare module "@rivetjs/runtime/jsx-runtime" {
  interface RivetForeignObjects { fake: abstract new (props: never) => FakeClass<any> }
  interface RivetForeignProps<C> {
    fake: C extends abstract new (props: never) => FakeClass<infer P> ? Island<P> : C extends (props: infer P) => FakeNode ? Island<P> : never;
  }
}
export {};
`,
  "rivet.tsx": `
export function Badge(props: { n: number }) {
  return <b>{props.n}</b>;
}
`,
  "plain.tsx": `
import { Counter, Label } from "./fake-fw.ts";
import { Badge } from "./rivet.tsx";
export const ok = <main><Badge n={1} /></main>;
// @ts-expect-error a class is no JSX tag without bridge types (no ElementType widening leak)
export const klass = <Counter start={1} />;
// @ts-expect-error no island props without bridge types
export const fc = <Label text="a" client="idle" />;
// @ts-expect-error Rivet props still checked
export const bad = <Badge n="1" />;
`,
  "bridged.tsx": `
import "./fake-bridge.ts";
import { Counter, Label } from "./fake-fw.ts";
import { Badge } from "./rivet.tsx";
export const klass = <Counter start={1} client="visible" />;
export const fc = <Label text="a" client="idle" />;
export const plainFc = <Label text="a" />;
// @ts-expect-error unknown client policy
export const policy = <Counter start={1} client="soon" />;
// @ts-expect-error foreign props are checked
export const props = <Counter start="1" />;
// @ts-expect-error required foreign props
export const missing = <Label />;
export const ok = <Badge n={1} />;
// @ts-expect-error Rivet components keep their own props (no client)
export const rivetClient = <Badge n={1} client="idle" />;
// @ts-expect-error Rivet props still checked
export const bad = <Badge n="1" />;
`,
};

async function diagnostics(root: string): Promise<string[]> {
  const { default: ts } = await import("typescript");
  const options = {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const virtual = (path: string) => (path.startsWith(dir) ? files[path.slice(dir.length)] : undefined);
  const { getSourceFile, fileExists, readFile, directoryExists } = host;
  host.directoryExists = (path) => dir.startsWith(path.endsWith("/") ? path : path + "/") || directoryExists!.call(host, path);
  host.fileExists = (path) => virtual(path) !== undefined || fileExists.call(host, path);
  host.readFile = (path) => virtual(path) ?? readFile.call(host, path);
  host.getSourceFile = (path, language, ...rest) => {
    const text = virtual(path);
    return text === undefined ? getSourceFile.call(host, path, language, ...rest) : ts.createSourceFile(path, text, language);
  };
  const program = ts.createProgram([dir + root], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => (d.file ? d.file.fileName.slice(dir.length) + ": " : "") + ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

test("without bridge types: foreign tags and island props error, Rivet components unchanged", async () => {
  assert.deepEqual(await diagnostics("plain.tsx"), []);
});

test("with a bridge augmentation: foreign components type as islands with checked props and client policy", async () => {
  assert.deepEqual(await diagnostics("bridged.tsx"), []);
});
