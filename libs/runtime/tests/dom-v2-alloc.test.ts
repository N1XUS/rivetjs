// MOUNT-01 (allocation): a compiler-ABI function that creates a closure over its parameters on some path makes V8
// allocate a context for them on every call — on the scalar path too (16–28 B per call: a text / attribute binding per
// mounted field; dom-bench mount 1000 rows: 6145 → 5060 B allocated per row). Pinned two ways: the functions' own source
// creates no closure (the closure paths live in helpers), and a scalar call allocates nothing (V8 new-space use).
import { test } from "vitest";
import assert from "node:assert/strict";
import { getHeapSpaceStatistics } from "node:v8";
import { _attrValue, _className, _cp, _insert, _setAttr, _t, _textValue, _tx } from "../dom-v2.ts";
import { _bindingEffect1 } from "@rivetjs/reactivity";

const closure = /=>|\bfunction\b/;
/** A function's body without string literals (`typeof value === "function"`). */
const body = (fn: (...args: never[]) => unknown): string =>
  String(fn)
    .replace(/^[^{]*\{/, "")
    .replace(/"[^"]*"/g, '""');

test("hot DOM ABI functions create no closure in their own body", () => {
  for (const fn of [_setAttr, _attrValue, _className, _textValue, _t, _tx, _insert, _cp])
    assert.doesNotMatch(body(fn as never), closure, `${fn.name} creates a closure: ${String(fn)}`);
});

test("production (default resolution): _bindingEffect1 creates no closure in its own body", () => {
  assert.doesNotMatch(body(_bindingEffect1 as never), closure, String(_bindingEffect1));
});

const newSpace = () => getHeapSpaceStatistics().find((s) => s.space_name === "new_space")!.space_used_size;
/** Bytes allocated per call (min over trials: a trial with a scavenge inside reads low or negative and is skipped). */
function perCall(call: (i: number) => void): number {
  const n = 2000;
  let best = Infinity;
  for (let trial = 0; trial < 8; trial++) {
    const before = newSpace();
    for (let i = 0; i < n; i++) call(i);
    const bytes = newSpace() - before;
    if (bytes >= 0) best = Math.min(best, bytes / n);
  }
  return best;
}

test("scalar attribute / text writes allocate nothing per call", () => {
  const el = { setAttribute() {}, removeAttribute() {}, set className(_: string) {}, set textContent(_: string) {} } as unknown as Element;
  const text = { data: "" } as unknown as Text;
  const strings = ["a", "b"];
  const cases: [string, (i: number) => void][] = [
    ["_setAttr", (i) => _setAttr(el, "data-x", strings[i & 1])],
    ["_className", (i) => _className(el, strings[i & 1])],
    ["_tx", (i) => _tx(text, strings[i & 1])],
  ];
  for (const [name, call] of cases) {
    perCall(call); // warm-up (feedback vectors, ICs)
    const bytes = perCall(call);
    assert.ok(bytes < 4, `${name}: ${bytes.toFixed(1)} B per call`);
  }
});
