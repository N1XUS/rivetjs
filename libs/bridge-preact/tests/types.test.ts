// T8 types: `import "@rivetjs/bridge-preact/types"` makes Preact components (functions returning vnodes, classes) Rivet
// JSX tags with Preact's props + `client` / `preload` / `fallback`; `ComponentChildren` props accept Rivet content; a
// `client` typo, wrong / missing Preact props error; `FunctionComponent` / `FC` / compat `memo` / `forwardRef` / `lazy`
// (return type exactly `ComponentChildren`) are islands too; Rivet components keep their own props. With React's types too
// (one app, both bridges), each framework's components keep their own props. Virtual fixtures (a compiler host
// overlay) so the augmentation never leaks into the package project.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./types-virtual/", import.meta.url));
const files: Record<string, string> = {
  "preact-components.ts": `
import { Component, h, type ComponentChildren, type VNode } from "preact";
export function Counter(props: { count: number; onIncrement?: (by: number) => void; children?: ComponentChildren }): VNode {
  return h("b", null, props.count, props.children);
}
export class Clock extends Component<{ tz: string }> {
  render() { return h("time", null, this.props.tz); }
}
/** Not a component: returns no vnode. */
export function helper(props: { n: number }): number { return props.n; }
export function Empty(): null { return null; }
`,
  "preact-typed.ts": `
import { h, type FunctionComponent, type FunctionalComponent } from "preact";
import { forwardRef, lazy, memo, type FC } from "preact/compat";
export const Card: FunctionComponent<{ title: string }> = (props) => h("h2", null, props.title);
export const Short: FC<{ n: number }> = (props) => h("b", null, props.n);
export const Memo = memo((props: { label: string }) => h("i", null, props.label));
export const Forward = forwardRef<HTMLInputElement, { value: string }>((props, ref) => h("input", { ref, value: props.value }));
export const Lazy = lazy(() => Promise.resolve({ default: Card }));
export const Functional: FunctionalComponent<{ k: string }> = (props) => h("u", null, props.k);
`,
  "react-components.ts": `
import { createElement, type ReactElement } from "react";
export function Note(props: { text: string }): ReactElement { return createElement("i", null, props.text); }
`,
  "rivet.tsx": `
export function Badge(props: { n: number }) {
  return <b>{props.n}</b>;
}
`,
  "page.tsx": `
import "@rivetjs/bridge-preact/types";
import { signal } from "@rivetjs/reactivity";
import { Clock, Counter, Empty, helper } from "./preact-components.ts";
import { Card, Forward, Functional, Lazy, Memo, Short } from "./preact-typed.ts";
import { Badge } from "./rivet.tsx";
const n = signal(1);
export const fc = <Card title="a" client="load" />;
export const short = <Short n={1} client="idle" />;
export const memo = <Memo label="m" client="visible" />;
export const forward = <Forward value="v" client="load" />;
export const lazy = <Lazy title="l" client="visible" />;
export const functional = <Functional k="x" client="load" />;
// @ts-expect-error FunctionComponent props stay checked
export const fcWrong = <Card title={1} />;
// @ts-expect-error memo props stay checked
export const memoWrong = <Memo label={1} />;
export const counter = <Counter count={n()} client="visible" onIncrement={(by) => n.set(n() + by)} />;
export const slotted = <Counter count={1} client="load"><Badge n={2} /></Counter>;
export const policyObject = <Counter count={1} client={{ on: "visible", rootMargin: "200px" }} />;
export const fallback = <Counter count={1} client="only" fallback={<p>wait</p>} />;
export const klass = <Clock tz="UTC" client="idle" />;
export const rivet = <Badge n={1} />;
// @ts-expect-error client typo
export const typo = <Counter count={1} client="visibel" />;
// @ts-expect-error Preact props are checked
export const wrongProp = <Counter count="1" />;
// @ts-expect-error required Preact props
export const missing = <Clock />;
// @ts-expect-error callback parameter types flow from Preact props
export const callback = <Counter count={1} onIncrement={(by: string) => void by} />;
// @ts-expect-error a function returning no vnode is no island
export const notComponent = <helper n={1} />;
// @ts-expect-error a function returning only null stays a Rivet component (own props, no island options)
export const empty = <Empty client="load" />;
// @ts-expect-error Rivet components keep their own props (no client)
export const rivetClient = <Badge n={1} client="idle" />;
`,
  "both.tsx": `
import "@rivetjs/bridge-preact/types";
import "@rivetjs/bridge-react/types";
import { Clock, Counter } from "./preact-components.ts";
import { Card, Memo } from "./preact-typed.ts";
import { Note } from "./react-components.ts";
export const fc = <Card title="a" client="load" />;
export const memo = <Memo label="m" client="idle" />;
export const preact = <Counter count={1} client="load" />;
export const klass = <Clock tz="UTC" client="idle" />;
export const react = <Note text="a" client="visible" />;
// @ts-expect-error Preact props stay checked next to React's types
export const preactWrong = <Counter count="1" />;
// @ts-expect-error React props stay checked next to Preact's types
export const reactWrong = <Note text={1} />;
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

test("Preact components type as islands: props, ComponentChildren slots, client policies; typos and wrong props error", async () => {
  assert.deepEqual(await diagnostics("page.tsx"), []);
});

test("Preact and React types in one program: each framework's components keep their own props", async () => {
  assert.deepEqual(await diagnostics("both.tsx"), []);
});
