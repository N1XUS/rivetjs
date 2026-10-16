// P3: the type contract in signal-types.ts compiles under strict tsc (every @ts-expect-error is an error).
import { test } from "vitest";
import assert from "node:assert/strict";

test("signal / computed / effect types: invariance, signal<T>(), signal([]), async rejection", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./signal-types.ts", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    types: [],
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => `${d.file ? ts.getLineAndCharacterOfPosition(d.file, d.start!).line + 1 : "?"}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`),
    [],
  );
});
