import { test } from "vitest";
import assert from "node:assert/strict";

test("slot types: Slot / Content / Slots props, r:slot and <slot r:name r:args> check in strict tsc", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./slots-types.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
