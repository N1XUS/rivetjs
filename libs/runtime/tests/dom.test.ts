import { test } from "vitest";
import assert from "node:assert/strict";

test("DOM entrypoint imports without document and automatic JSX execution fails clearly", async () => {
  assert.equal(typeof globalThis.document, "undefined");
  const runtime = await import("../dom.ts");
  assert.throws(() => runtime._tpl("<p></p>")(), /inside mount/);
  const automatic = await import("../jsx-runtime.ts");
  assert.throws(() => automatic.jsx("p", {}), /Rivet JSX must pass through/);
});

test("strict preserve authoring types validate native events, models and required component props", async () => {
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
  };
  const program = ts.createProgram([new URL("./dom/types.tsx", import.meta.url).pathname], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
