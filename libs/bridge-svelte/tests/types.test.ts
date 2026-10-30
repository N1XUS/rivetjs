import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("./types-virtual/", import.meta.url));
const files: Record<string, string> = {
  "components.ts": `
import type { Component, Snippet } from "svelte";
export declare const Counter: Component<{ count: number; title?: Snippet; children?: Snippet; onIncrement?: (by: number) => void }>;
export declare const Minimal: Component<{ label: string }>;
`,
  "page.tsx": `
import "@rivetjs/bridge-svelte/types";
import "@rivetjs/bridge-react/types";
import type { ReactElement } from "react";
import { Counter, Minimal } from "./components.ts";
function Badge(props: { n: number }) { return <b>{props.n}</b>; }
function Empty(props: {}) { return <b>empty</b>; }
function NoProps() { return <i>none</i>; }
declare function ReactNote(props: { text: string }): ReactElement;
export const svelte = <Counter count={1} client="load" onIncrement={(by) => void by} />;
export const slots = <Counter count={1} title={<i>T</i>}><Badge n={1} /></Counter>;
export const minimal = <Minimal label="hello" client={{ on: "visible" }} />;
export const react = <ReactNote text="hello" client="idle" />;
export const rivet = <Badge n={1} />;
// @ts-expect-error count is required
export const missing = <Counter />;
// @ts-expect-error count stays a number
export const wrong = <Counter count="one" />;
// @ts-expect-error callback parameters remain typed
export const callback = <Counter count={1} onIncrement={(by: string) => void by} />;
// @ts-expect-error policy typo
export const typo = <Counter count={1} client="visibel" />;
// @ts-expect-error Rivet components do not acquire island props
export const rivetClient = <Badge n={1} client="load" />;
// @ts-expect-error empty Rivet props must not be mistaken for Svelte Component internals
export const emptyIsland = <Empty client="load" />;
// @ts-expect-error zero-argument Rivet components remain Rivet
export const zeroIsland = <NoProps client="load" />;
// @ts-expect-error React props remain checked
export const reactWrong = <ReactNote text={1} />;
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
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
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
    .map(
      (d) =>
        (d.file ? d.file.fileName.slice(dir.length) + ":" + (d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1) + ": " : "") +
        ts.flattenDiagnosticMessageText(d.messageText, "\n"),
    );
}

test("Svelte 5 components accept island props and snippets while Rivet and React keep their own props", async () => {
  assert.deepEqual(await diagnostics("page.tsx"), []);
});
