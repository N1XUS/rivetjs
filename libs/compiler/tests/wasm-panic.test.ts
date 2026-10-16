// D10: a compiler panic (`panic = "abort"` traps with `unreachable`) surfaces its message as an RV9001
// error and the loader replaces the instance (registered tables replayed), so a long-lived dev server
// keeps compiling.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, registerTable, CompilerPanic } from "../index.ts";
import { call } from "../wasm.ts";

const staticCalls = [{ id: "panic-test", module: "@rivetjs/i18n", export: "t" }];
const source = `import { t } from "@rivetjs/i18n";\nexport const A = () => <p>{t("hello")}</p>;`;
const options = { target: "dom" as const, staticCalls, variants: ["en"], variant: 0 };

test("a panic throws CompilerPanic (RV9001) with the Rust message and location", () => {
  assert.throws(
    () => call({ op: "panic", message: "boom" }),
    (error: unknown) =>
      error instanceof CompilerPanic && error.code === "RV9001" && /^Internal error: compiler panicked: boom \(at src\/lib\.rs:\d+:\d+\)$/.test(error.message),
  );
});

test("the next call runs on a fresh instance with tables re-registered", () => {
  registerTable("panic-test", { hello: [[{ t: "Hello" }]] } as never);
  const before = compile(source, options);
  assert.deepEqual(before.diagnostics, []);
  assert.throws(() => call({ op: "panic", message: "again" }), CompilerPanic);
  const after = compile(source, options);
  assert.deepEqual(after.diagnostics, []);
  assert.equal(after.code, before.code);
  assert.match(after.code, /Hello/);
});
