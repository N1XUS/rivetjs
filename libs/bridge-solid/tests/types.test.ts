import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("./types-virtual/", import.meta.url));
const files: Record<string, string> = {
  "components.ts": `
import type {Component, JSX} from "solid-js";
export const Counter: Component<{count:number; onIncrement?:(n:number)=>void; children?:JSX.Element; title?:JSX.Element}> = () => null;
export const Required: Component<{label:string}> = () => null;
`,
  "native.tsx": `export function Native(props:{n:number}) {return <b>{props.n}</b>}`,
  "page.tsx": `
import "@rivetjs/bridge-solid/types";
import {Counter, Required} from './components.ts';
import {Native} from './native.tsx';
export const counter=<Counter count={1} client="load" onIncrement={n=>void n.toFixed()} />;
export const slots=<Counter count={1} title={<i>title</i>}><Native n={2}/></Counter>;
export const media=<Counter count={1} client="media:(min-width: 1px)"/>;
export const options=<Counter count={1} client={{on:"visible",rootMargin:"200px"}} fallback={<p>wait</p>}/>;
export const required=<Required label="hi" client="only"/>;
// @ts-expect-error incorrect policy
export const typo=<Counter count={1} client="visibel"/>;
// @ts-expect-error required prop
export const missing=<Required client="load"/>;
// @ts-expect-error prop type
export const wrong=<Counter count="1"/>;
// @ts-expect-error callback parameter type
export const callback=<Counter count={1} onIncrement={(n:string)=>{}}/>;
// @ts-expect-error native components retain their props
export const native=<Native n={1} client="load"/>;
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

test("Solid JSX registry preserves props, content and callbacks and rejects bad island options", async () => {
  assert.deepEqual(await diagnostics("page.tsx"), []);
});
