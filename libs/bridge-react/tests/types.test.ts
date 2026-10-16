// T6 types: `import "@rivetjs/bridge-react/types"` makes React components (functions returning React elements, memo /
// forwardRef / lazy, classes) Rivet JSX tags with React's props + `client` / `preload` / `fallback`; ReactNode props
// accept Rivet content; a `client` typo, wrong / missing React props error; Rivet components keep their own props.
// Virtual fixtures (a compiler host overlay) so the augmentation never leaks into the package project.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./types-virtual/", import.meta.url));
const files: Record<string, string> = {
  "react-components.ts": `
import { Component, createElement, forwardRef, lazy, memo, type ReactElement, type ReactNode } from "react";
export function Counter(props: { count: number; onIncrement?: (by: number) => void; children?: ReactNode }): ReactElement {
  return createElement("b", null, props.count, props.children);
}
export const Memo = memo((props: { label: string }) => createElement("i", null, props.label));
export const Ref = forwardRef<HTMLInputElement, { value: string }>((props, ref) => createElement("input", { ref, value: props.value }));
export const Lazy = lazy(async () => ({ default: Counter }));
export class Clock extends Component<{ tz: string }> {
  render() { return createElement("time", null, this.props.tz); }
}
export async function Server(props: { id: number }): Promise<ReactNode> { return createElement("p", null, props.id); }
/** Not a component: returns no React element. */
export function helper(props: { n: number }): number { return props.n; }
export function Empty(): null { return null; }
`,
  "rivet.tsx": `
export function Badge(props: { n: number }) {
  return <b>{props.n}</b>;
}
`,
  "page.tsx": `
import "@rivetjs/bridge-react/types";
import { signal } from "@rivetjs/reactivity";
import { Clock, Counter, Empty, Lazy, Memo, Ref, Server, helper } from "./react-components.ts";
import { Badge } from "./rivet.tsx";
const n = signal(1);
export const counter = <Counter count={n()} client="visible" onIncrement={(by) => n.set(n() + by)} />;
export const slotted = <Counter count={1} client="load"><Badge n={2} /></Counter>;
export const media = <Counter count={1} client="media:(min-width: 40rem)" />;
export const policyObject = <Counter count={1} client={{ on: "visible", rootMargin: "200px" }} />;
export const fallback = <Counter count={1} client="only" fallback={<p>wait</p>} />;
export const memo = <Memo label="a" client="idle" />;
export const ref = <Ref value="v" client="interaction" />;
export const lazyTag = <Lazy count={1} />;
export const klass = <Clock tz="UTC" client="intent" />;
export const server = <Server id={1} />;
export const rivet = <Badge n={1} />;
// @ts-expect-error client typo
export const typo = <Counter count={1} client="visibel" />;
// @ts-expect-error React props are checked
export const wrongProp = <Counter count="1" />;
// @ts-expect-error required React props
export const missing = <Clock />;
// @ts-expect-error memo props checked
export const memoProp = <Memo label={1} />;
// @ts-expect-error callback parameter types flow from React props
export const callback = <Counter count={1} onIncrement={(by: string) => void by} />;
// @ts-expect-error a function returning no React element is no island
export const notComponent = <helper n={1} />;
// @ts-expect-error a function returning only null stays a Rivet component (own props, no island options)
export const empty = <Empty client="load" />;
// @ts-expect-error Rivet components keep their own props (no client)
export const rivetClient = <Badge n={1} client="idle" />;
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

test("React components type as islands: props, ReactNode slots, client policies; typos and wrong props error", async () => {
  assert.deepEqual(await diagnostics("page.tsx"), []);
});
