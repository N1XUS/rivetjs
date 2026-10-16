// Store write misuse (round-2 review C10): function values and paths through primitives.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createStore, read, write } from "@rivetjs/reactivity/store";

test("a function passed to write is an updater; function values are stored through one", () => {
  const handler = () => "saved";
  const st = createStore<{ onSave: (() => string) | null; n: number }>({ onSave: null, n: 1 });
  // @ts-expect-error raw function values are rejected by the types (they would run as updaters)
  write(st, "onSave", handler);
  // At runtime the function ran as an updater of null and its result was stored.
  assert.equal(read(st, "onSave") as unknown, "saved");
  write(st, "onSave", () => handler);
  assert.equal(read(st, "onSave"), handler);
  write(st, "n", (n) => n + 1);
  assert.equal(read(st, "n"), 2);
});

test("writing below a primitive throws instead of replacing it with an object", () => {
  const st = createStore<{ a: unknown; list: unknown }>({ a: 5, list: "x" });
  assert.throws(() => write(st as never, "a.b" as never, 1 as never), /Store write "a.b": "a" holds a number/);
  assert.throws(() => write(st as never, "list.0" as never, 1 as never), /"list" holds a string/);
  assert.equal(read(st, "a"), 5);
  // Missing (undefined / null) containers are still created.
  write(st as never, "b.c" as never, 1 as never);
  assert.deepEqual(read(st as never, "b" as never), { c: 1 });
});
