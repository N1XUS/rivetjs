// Guard: resume is derived-only (M6), and every derived suite (compiler `derived-*`, runtime `derived-*`, cdk component
// bodies, …) skips itself when `hasDerivedModel()` is false. A stale or older `rivet_compiler.wasm` would then skip the
// core resume coverage with the gates still green: this test fails instead.
import { test } from "vitest";
import assert from "node:assert/strict";
import { hasDerivedModel } from "../wasm.ts";

test("the compiler wasm carries the derived resume model (derived suites must not skip)", () => {
  assert.equal(hasDerivedModel(), true, "libs/compiler/rivet_compiler.wasm lacks the derived model: rebuild it (libs/compiler/rust/build.sh)");
});
