// T8: a V8 stack overflow inside wasm (plain RangeError) or a shadow-stack overflow (out-of-bounds
// trap) is fatal for the instance: the loader drops it and the compile reports RV9001; the next call
// runs on a fresh instance. P4: malformed options are RV7001 diagnostics, lone surrogates compile.
import { test } from "vitest";
import assert from "node:assert/strict";
import { check, compile } from "../index.ts";
import { hasInstance } from "../wasm.ts";

const nested = (depth: number) => `export const A = () => ${"<div>".repeat(depth)}x${"</div>".repeat(depth)};`;

test("too-deep nesting is an RV9001 diagnostic and the instance is replaced", () => {
  // 800 nested elements overflowed the 1 MiB shadow stack before rust/.cargo/config.toml raised it.
  assert.deepEqual(compile(nested(800), { target: "dom" }).diagnostics, []);
  const deep = compile(nested(20000), { target: "dom" });
  assert.equal(deep.code, "");
  assert.equal(deep.diagnostics.length, 1);
  assert.equal(deep.diagnostics[0]!.code, "RV9001");
  assert.match(deep.diagnostics[0]!.message, /nests too deeply/);
  assert.equal(hasInstance(), false);
  const after = compile("export const B = () => <p>ok</p>;", { target: "dom" });
  assert.deepEqual(after.diagnostics, []);
  assert.match(after.code, /<p>ok(?:<\/p>)?"/); // v1 spec html / v2 template string
});

test("malformed compiler options are RV7001 diagnostics (P4)", () => {
  const bad: [unknown, RegExp][] = [
    [{ target: 5 }, /Invalid compiler option: invalid type: integer `5`/],
    [{ styles: {} }, /`styles\.scope`/],
    [{ styles: { scope: 1 } }, /`styles\.scope`/],
    [{ styles: { scope: "m", layer: 5 } }, /`styles\.layer`/],
    [{ styles: { scope: "m", names: "long" } }, /`styles\.names`/],
    [{ resume: 1 }, /`resume`/],
    [{ resume: { module: 1 } }, /`resume\.module`/],
  ];
  for (const [options, message] of bad) {
    const result = compile("export const A = () => <p/>;", options as never);
    assert.equal(result.code, "");
    assert.equal(result.diagnostics.length, 1, JSON.stringify(options));
    assert.equal(result.diagnostics[0]!.code, "RV7001");
    assert.match(result.diagnostics[0]!.message, message);
  }
  const checked = check("export const A = () => <p/>;", { targets: ["edge" as never] });
  assert.equal(checked.diagnostics[0]!.code, "RV7001");
  // JS-falsy `resume` leaves resume off.
  for (const resume of [0, "", false, null]) {
    const result = compile("export const A = () => <button onClick={() => 1}/>;", { target: "server", resume: resume as never });
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.boundaries, undefined);
  }
  assert.ok(compile("export const A = () => <button onClick={() => 1}/>;", { target: "server", resume: true as never }).boundaries?.length);
});

test("lone surrogates in the source compile (U+FFFD, same UTF-16 positions)", () => {
  const result = compile("export const A = () => <p>{'\ud800'}x</p>;", { target: "server" });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.code, /�/);
  const checked = check("const s = '\ud800';\nexport const A = () => <p>{s}</p>;");
  assert.deepEqual(checked.diagnostics, []);
});
