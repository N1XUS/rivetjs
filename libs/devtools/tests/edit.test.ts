// Structured edits (agent/edit.ts): typed values, paths through objects, arrays, Map and Set, the
// container operations, fresh copies vs. in-place class instances.
import { test } from "vitest";
import assert from "node:assert/strict";
import { decode, edit } from "../agent/edit.ts";
import type { Seg } from "../protocol.ts";

const handles = new Map<number, unknown>();
const handle = (value: unknown): number => {
  const h = handles.size + 1;
  handles.set(h, value);
  return h;
};
const resolve = (h: number) => ({ found: handles.has(h), value: handles.get(h) });
const o = (key: string): Seg => ({ o: key });

test("typed values decode to page values (numbers, bigint, dates, null, undefined, JSON)", () => {
  assert.deepEqual(decode({ t: "n", v: " 4.5 " }), { ok: true, value: 4.5 });
  assert.equal(decode({ t: "n", v: "abc" }).ok, false);
  assert.equal(decode({ t: "n", v: "" }).ok, false);
  assert.deepEqual(decode({ t: "big", v: "-12" }), { ok: true, value: -12n });
  assert.equal(decode({ t: "big", v: "1.5" }).ok, false);
  const date = decode({ t: "date", v: "2026-01-02T03:04:05.000Z" });
  assert.ok(date.ok && date.value instanceof Date && date.value.getTime() === Date.UTC(2026, 0, 2, 3, 4, 5));
  assert.deepEqual(decode({ t: "date", v: "0" }), { ok: true, value: new Date(0) });
  assert.equal(decode({ t: "date", v: "not a date" }).ok, false);
  assert.deepEqual(decode({ t: "null" }), { ok: true, value: null });
  assert.deepEqual(decode({ t: "u" }), { ok: true, value: undefined });
  assert.deepEqual(decode({ t: "json", v: '{"a":[1]}' }), { ok: true, value: { a: [1] } });
  assert.equal(decode({ t: "json", v: "{" }).ok, false);
  assert.deepEqual(decode({ t: "b", v: false }), { ok: true, value: false });
});

test("leaf set inside Map, Set, Date, nested arrays: a fresh copy along the path", () => {
  const key = { id: 1 };
  const inner = new Map<unknown, unknown>([[key, { n: 1 }], ["s", "x"]]);
  const root = { map: inner, set: new Set(["a", "b"]), when: new Date(0), list: [1, [2, 3]], big: 1n, gone: undefined as unknown };
  const r1 = edit(root, [o("map"), { m: handle(key) }, o("n")], { op: "set", value: { t: "n", v: "2" } }, resolve);
  assert.ok(r1.ok && !r1.inPlace);
  const next = r1.value as typeof root;
  assert.notEqual(next, root);
  assert.notEqual(next.map, inner);
  assert.deepEqual(next.map.get(key), { n: 2 });
  assert.deepEqual(inner.get(key), { n: 1 }, "original untouched");
  assert.equal(next.set, root.set, "untouched siblings are shared");

  const r2 = edit(root, [o("set"), { s: handle("a") }], { op: "set", value: { t: "s", v: "z" } }, resolve);
  assert.ok(r2.ok);
  assert.deepEqual([...(r2.value as typeof root).set], ["z", "b"], "member replaced in place of order");
  const r3 = edit(root, [o("when")], { op: "set", value: { t: "date", v: "1000" } }, resolve);
  assert.ok(r3.ok && (r3.value as typeof root).when.getTime() === 1000);
  const r4 = edit(root, [o("list"), o("1"), o("0")], { op: "set", value: { t: "b", v: true } }, resolve);
  assert.ok(r4.ok);
  assert.deepEqual((r4.value as typeof root).list, [1, [true, 3]]);
  const r5 = edit(root, [o("big")], { op: "set", value: { t: "big", v: "99" } }, resolve);
  assert.ok(r5.ok && (r5.value as typeof root).big === 99n);
  const r6 = edit(root, [o("gone")], { op: "set", value: { t: "s", v: "now" } }, resolve);
  assert.ok(r6.ok && (r6.value as typeof root).gone === "now");
  // Root replace (path []).
  assert.deepEqual(edit(5, [], { op: "set", value: { t: "n", v: "6" } }, resolve), { ok: true, value: 6, inPlace: false });
});

test("container operations: keys, Map entries, Set members, array items", () => {
  const root = { obj: { a: 1 }, map: new Map([["k", 1]]), set: new Set([1]), list: ["x", "y", "z"] };
  const added = edit(root, [o("obj")], { op: "add", key: { t: "s", v: "b" }, value: { t: "n", v: "2" } }, resolve);
  assert.ok(added.ok);
  assert.deepEqual((added.value as typeof root).obj, { a: 1, b: 2 });
  assert.equal(edit(root, [o("obj")], { op: "add", key: { t: "s", v: "a" }, value: { t: "n", v: "2" } }, resolve).ok, false, "existing key");
  const removed = edit(root, [o("obj"), o("a")], { op: "delete" }, resolve);
  assert.ok(removed.ok);
  assert.deepEqual((removed.value as typeof root).obj, {});

  const entry = edit(root, [o("map")], { op: "add", key: { t: "n", v: "7" }, value: { t: "s", v: "seven" } }, resolve);
  assert.ok(entry.ok);
  assert.deepEqual([...(entry.value as typeof root).map], [["k", 1], [7, "seven"]]);
  const dropped = edit(root, [o("map"), { m: handle("k") }], { op: "delete" }, resolve);
  assert.ok(dropped.ok);
  assert.equal((dropped.value as typeof root).map.size, 0);
  assert.equal(root.map.size, 1);

  const member = edit(root, [o("set")], { op: "add", value: { t: "n", v: "2" } }, resolve);
  assert.ok(member.ok);
  assert.deepEqual([...(member.value as typeof root).set], [1, 2]);
  const gone = edit(root, [o("set"), { s: handle(1) }], { op: "delete" }, resolve);
  assert.ok(gone.ok && (gone.value as typeof root).set.size === 0);

  const pushed = edit(root, [o("list")], { op: "add", value: { t: "s", v: "w" } }, resolve);
  assert.ok(pushed.ok);
  assert.deepEqual((pushed.value as typeof root).list, ["x", "y", "z", "w"]);
  const spliced = edit(root, [o("list"), o("1")], { op: "delete" }, resolve);
  assert.ok(spliced.ok);
  assert.deepEqual((spliced.value as typeof root).list, ["x", "z"]);
  assert.equal(edit(root, [o("map"), { m: 999 }], { op: "delete" }, resolve).ok, false, "expired handle");
});

test("class instances are edited in place; frozen plain objects stay frozen; accessors are refused", () => {
  class Cart {
    items = [1, 2];
    owner = "me";
    get total() {
      throw new Error("never invoked");
    }
  }
  const cart = new Cart();
  const leaf = edit(cart, [o("owner")], { op: "set", value: { t: "s", v: "you" } }, resolve);
  assert.deepEqual(leaf, { ok: true, value: cart, inPlace: true });
  assert.equal(cart.owner, "you");
  const nested = edit(cart, [o("items"), o("0")], { op: "set", value: { t: "n", v: "9" } }, resolve);
  assert.ok(nested.ok && nested.inPlace);
  assert.deepEqual(cart.items, [9, 2]);
  // An instance below a plain root: the root is copied (a normal write), the instance edited in place.
  const root = { cart };
  const below = edit(root, [o("cart"), o("owner")], { op: "set", value: { t: "s", v: "them" } }, resolve);
  assert.ok(below.ok && !below.inPlace && below.value !== root && (below.value as typeof root).cart === cart);
  assert.equal(edit(cart, [o("total")], { op: "set", value: { t: "n", v: "1" } }, resolve).ok, false);

  const frozen = Object.freeze({ a: 1, b: Object.freeze({ c: 2 }) });
  const out = edit(frozen, [o("b"), o("c")], { op: "set", value: { t: "n", v: "3" } }, resolve);
  assert.ok(out.ok);
  assert.deepEqual(out.value, { a: 1, b: { c: 3 } });
  assert.ok(Object.isFrozen(out.value) && Object.isFrozen((out.value as typeof frozen).b));
  const typed = edit(new Uint8Array([1, 2]), [o("1")], { op: "set", value: { t: "n", v: "7" } }, resolve);
  assert.ok(typed.ok && (typed.value as Uint8Array)[1] === 7);
});

test("containers from another realm (iframe apps) are copied like this realm's, not edited as instances", async () => {
  const { runInNewContext } = await import("node:vm");
  const root = runInNewContext(`({ map: new Map([["k", 1]]), plain: { a: 1 } })`) as { map: Map<string, number>; plain: { a: number } };
  const r1 = edit(root, [o("plain"), o("a")], { op: "set", value: { t: "n", v: "2" } }, resolve);
  assert.ok(r1.ok && !r1.inPlace, "plain object of another realm: copied");
  assert.equal((r1.value as typeof root).plain.a, 2);
  assert.equal(root.plain.a, 1);
  const r2 = edit(root, [o("map"), { m: handle("k") }], { op: "set", value: { t: "n", v: "5" } }, resolve);
  assert.ok(r2.ok && !r2.inPlace);
  assert.equal((r2.value as typeof root).map.get("k"), 5);
  assert.equal(root.map.get("k"), 1);
});
