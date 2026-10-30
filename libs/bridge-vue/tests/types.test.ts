import { test } from "vitest";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("./types-virtual/", import.meta.url));
const files: Record<string, string> = {
  "components.ts": `
import { defineComponent, h, type FunctionalComponent, type SlotsType, type PropType } from "vue";
export const Counter = defineComponent({ props: { count: { type: Number, required: true }, onIncrement: Function as PropType<(by: number) => void> }, setup(props) { return () => h("b", props.count); } });
export const Functional: FunctionalComponent<{ text: string }> = (props) => h("b", props.text);
export const Named = defineComponent({ slots: Object as SlotsType<{ "section-title": () => unknown }>, setup() { return () => h("div"); } });
export function Direct(props: { title: string }) { return h("i", props.title); }
`,
  "rivet.tsx": `export function Badge(props: { n: number }) { return <b>{props.n}</b>; }`,
  "page.tsx": `
import "@rivetjs/bridge-vue/types";
import { Counter, Direct, Functional, Named } from "./components.ts";
import { Badge } from "./rivet.tsx";
export const counter = <Counter count={1} client="load" onIncrement={(by) => { const typed: number = by; void typed; }} />;
// @ts-expect-error callback parameter types cross the island boundary
export const callback = <Counter count={1} onIncrement={(by: string) => void by} />;
export const functional = <Functional text="ok" client="visible" />;
export const direct = <Direct title="ok" client="idle" />;
export const named = <Named section-title={<Badge n={2} />} client="load" />;
export const children = <Counter count={1}><Badge n={1} /></Counter>;
// @ts-expect-error required Vue props stay required
export const missing = <Counter />;
// @ts-expect-error Vue props stay checked
export const wrong = <Counter count="one" />;
// @ts-expect-error function props stay checked
export const wrongFunctional = <Functional text={1} />;
// @ts-expect-error client policies stay checked
export const typo = <Counter count={1} client="visibel" />;
// @ts-expect-error ordinary Rivet components gain no island options
export const rivet = <Badge n={1} client="load" />;
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

test("Vue constructors and functional components keep typed props and policies, alongside Rivet components", async () => {
  assert.deepEqual(await diagnostics("page.tsx"), []);
});
