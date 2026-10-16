import { test } from "vitest";
import assert from "node:assert/strict";
import { _bindingEffect1, signal, createRoot, getOwner, onCleanup, untrack, batch, type Owner } from "../index.ts";

// Closure-free bindings: `_bindingEffect1(fn, arg)` runs `fn(arg)` with `_bindingEffect` semantics.
interface Linked { first: Linked | null; next: Linked | null }
const children = (owner: Owner | null): number => {
  let n = 0;
  for (let child = (owner as unknown as Linked).first; child; child = child.next) n++;
  return n;
};
const recording = Boolean((globalThis as Record<symbol, unknown>)[Symbol.for("rivet.devtools")]);

const write = (captures: { out: string[]; value: () => number }) => {
  captures.out.push("v" + captures.value());
};

test("runs fn(arg), re-runs on change, stops with its owner", () => {
  const value = signal(1), out: string[] = [];
  const root = createRoot(() => _bindingEffect1(write, { out, value }));
  assert.deepEqual(out, ["v1"]);
  value.set(2);
  batch(() => { value.set(3); value.set(4); });
  assert.deepEqual(out, ["v1", "v2", "v4"]);
  root.dispose();
  value.set(5);
  assert.deepEqual(out, ["v1", "v2", "v4"]);
});

test("one shared fn serves many bindings with their own captures", () => {
  const a = signal(1), b = signal(10), out: string[] = [];
  createRoot(() => {
    _bindingEffect1(write, { out, value: a });
    _bindingEffect1(write, { out, value: b });
  });
  b.set(11);
  a.set(2);
  assert.deepEqual(out, ["v1", "v10", "v11", "v2"]);
});

test("inert bindings are released; bindings with sources or cleanups stay", () => {
  const value = signal(0);
  let owner: Owner | null = null, cleaned = 0;
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect1((v: () => number) => void untrack(v), value);
    assert.equal(children(owner), recording ? 1 : 0);
    _bindingEffect1((v: () => number) => void v(), value);
    _bindingEffect1(() => onCleanup(() => cleaned++), null);
  });
  assert.equal(children(owner), recording ? 3 : 2);
  root.dispose();
  assert.equal(cleaned, 1);
});

test("an initial failure disposes the binding and rethrows; later failures propagate from the flush", () => {
  const value = signal(0);
  let runs = 0;
  createRoot(() => {
    assert.throws(() => _bindingEffect1(() => { throw new Error("init"); }, null), /init/);
    _bindingEffect1((v: () => number) => { runs++; if (v() === 1) throw new Error("later"); }, value);
  });
  assert.throws(() => value.set(1), /later/);
  value.set(2);
  assert.equal(runs, 3);
});

test("passes up to three captures", () => {
  const value = signal(1), out: string[] = [];
  const three = (o: string[], prefix: string, v: () => number) => { o.push(prefix + v()); };
  createRoot(() => _bindingEffect1(three, out, "n=", value));
  value.set(2);
  assert.deepEqual(out, ["n=1", "n=2"]);
});
