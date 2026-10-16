// X7: `DataOf` (router/index.ts) must agree with the resume encoder (runtime/resume-format.ts): every
// sample in data-of-samples.ts is accepted by the type iff `createEncoder().ref` encodes it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createEncoder } from "@rivetjs/runtime/resume-format";
import { samples, typeVerdicts } from "./data-of-samples.ts";

/** Samples where structural typing cannot match the encoder (documented in data-of-samples.ts). */
const TYPE_GAPS = new Set(["fieldOnlyClass", "errorSubclass"]);

function encodes(value: unknown): boolean {
  try {
    createEncoder().ref(value);
    return true;
  } catch {
    return false;
  }
}

test("DataOf verdicts match the resume encoder", () => {
  const mismatches: string[] = [];
  for (const [name, value] of Object.entries(samples)) {
    const typed = typeVerdicts[name as keyof typeof samples];
    const runtime = encodes(value);
    if (TYPE_GAPS.has(name)) assert.equal(typed === runtime, false, `${name} is listed as a gap but now agrees: drop it from TYPE_GAPS`);
    else if (typed !== runtime) mismatches.push(`${name}: type ${typed ? "accepts" : "rejects"}, encoder ${runtime ? "encodes" : "throws"}`);
  }
  assert.deepEqual(mismatches, []);
});

test("DataOf verdicts typecheck under strict tsc", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./data-of-samples.ts", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
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
