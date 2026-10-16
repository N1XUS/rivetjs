import { test } from "vitest";
import assert from "node:assert/strict";
import { Handles, entries, inspect, jsonSafe, preview, setPath } from "../agent/preview.ts";

test("primitives", () => {
  assert.deepEqual(preview(undefined), { k: "u", p: "undefined" });
  assert.deepEqual(preview(null), { k: "u", p: "null" });
  assert.deepEqual(preview(-0), { k: "n", p: "-0" });
  assert.deepEqual(preview(1.5), { k: "n", p: "1.5" });
  assert.deepEqual(preview("a\"b"), { k: "s", p: '"a\\"b"' });
  assert.deepEqual(preview(true), { k: "b", p: "true" });
  assert.deepEqual(preview(10n), { k: "big", p: "10n" });
  assert.deepEqual(preview(Symbol("x")), { k: "sym", p: "Symbol(x)" });
  const long = preview("x".repeat(500));
  assert.equal(long.k, "trunc");
  assert.equal(long.n, 500);
  assert.ok(long.p.length < 130);
});

test("objects: sizes, class names, built-ins and handles", () => {
  const handles = new Handles();
  class Point {
    x = 1;
    y = 2;
  }
  const p = preview(new Point(), { handles });
  assert.equal(p.k, "o");
  assert.equal(p.p, "Point {x, y}");
  assert.equal(handles.get(p.h!) instanceof Point, true);
  assert.equal(preview({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }).p, "{a, b, c, d, e, …}");
  assert.deepEqual(preview([1, 2, 3]), { k: "a", p: "Array(3)", n: 3 });
  assert.equal(preview(new Map([[1, 2]])).p, "Map(1)");
  assert.equal(preview(new Set([1, 2])).p, "Set(2)");
  assert.equal(preview(new Date(0)).p, "1970-01-01T00:00:00.000Z");
  assert.equal(preview(new Date(NaN)).p, "Invalid Date");
  assert.equal(preview(/a+/g).p, "/a+/g");
  assert.equal(preview(Promise.resolve()).k, "prom");
  assert.equal(preview(new TypeError("bad")).p, "TypeError: bad");
  assert.equal(preview(function named() {}).p, "ƒ named()");
  assert.equal(preview(() => {}).p, "ƒ anonymous()");
});

test("signals preview their value through the given reader", () => {
  const fn = () => 1;
  assert.deepEqual(preview(fn, { signal: (f) => (f === fn ? { value: 7 } : undefined) }), { k: "sig", p: "signal(7)" });
});

test("user code never runs: getters, toString, toJSON, throwing proxies", () => {
  let calls = 0;
  const tricky = {
    get boom() {
      calls++;
      throw new Error("getter ran");
    },
    toString() {
      calls++;
      return "x";
    },
    toJSON() {
      calls++;
      return "x";
    },
  };
  assert.equal(preview(tricky).p, "{boom, toString, toJSON}");
  const listed = entries(tricky);
  assert.deepEqual(listed[0], { key: "boom", value: { k: "get", p: "(getter)" } });
  assert.equal(calls, 0);
  // A throwing error message getter and constructor are not read either.
  const error = new Error("m");
  Object.defineProperty(error, "message", { get: () => (calls++, "x") });
  assert.equal(preview(error).p, "Error");
  assert.equal(calls, 0);
  const hostile = new Proxy({}, { ownKeys: () => { throw new Error("trap"); }, getPrototypeOf: () => { throw new Error("trap"); } });
  assert.deepEqual(preview(hostile), { k: "o", p: "(unreadable)" });
  assert.deepEqual(entries(hostile), [{ key: "…", value: { k: "o", p: "(unreadable)" } }]);
});

test("entries: one level of arrays, maps, sets and cycles; huge arrays capped", () => {
  const cyclic: { self?: unknown; n: number } = { n: 1 };
  cyclic.self = cyclic;
  assert.deepEqual(entries(cyclic), [
    { key: "n", value: { k: "n", p: "1" } },
    { key: "self", value: { k: "cyc", p: "[circular]" } },
  ]);
  assert.deepEqual(entries(new Map([["a", 1]])), [{ key: '"a"', value: { k: "n", p: "1" } }]);
  assert.deepEqual(entries(new Set(["v"])), [{ key: "0", value: { k: "s", p: '"v"' } }]);
  assert.equal(entries(new Array(10_000).fill(0)).length, 100);
  assert.deepEqual(entries([5]), [{ key: "0", value: { k: "n", p: "5" } }]);
});

test("handles are capped (least recently used dropped)", () => {
  const handles = new Handles();
  const first = handles.add({});
  for (let i = 0; i < 1000; i++) handles.add({});
  assert.equal(handles.get(first), undefined);
});

test("jsonSafe accepts JSON data only", () => {
  assert.ok(jsonSafe({ a: [1, "x", null, { b: true }] }));
  assert.ok(jsonSafe(3));
  for (const value of [undefined, NaN, new Date(), new Map(), () => 1, { get a() { return 1; } }, 1n]) assert.equal(jsonSafe(value), false);
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.equal(jsonSafe(cyclic), false);
});

test("inspect: pages with totals, Map / Set / array paging", () => {
  const big = Array.from({ length: 250 }, (_, i) => i);
  const first = inspect(big), last = inspect(big, { offset: 200 });
  assert.equal(first.total, 250);
  assert.deepEqual([first.entries.length, first.entries[0]!.key, last.entries.length, last.entries[0]!.key], [100, "0", 50, "200"]);
  const map = new Map(Array.from({ length: 150 }, (_, i): [string, number] => ["k" + i, i]));
  assert.deepEqual([inspect(map).total, inspect(map, { offset: 100 }).entries[0]], [150, { key: '"k100"', value: { k: "n", p: "100" } }]);
  const set = new Set(big);
  assert.deepEqual(inspect(set, { offset: 120 }).entries[0], { key: "120", value: { k: "n", p: "120" } });
  // Holes in sparse arrays.
  assert.deepEqual(inspect([1, , 3]).entries[1], { key: "1", value: { k: "u", p: "<empty>" } });
});

test("inspect: cycles through any ancestor show [circular]", () => {
  const root: { child: { back?: unknown; leaf: number } } = { child: { leaf: 1 } };
  root.child.back = root;
  const handles = new Handles();
  const child = inspect(root, { handles }).entries[0]!;
  assert.equal(child.value.k, "o");
  const grand = inspect(handles.get(child.value.h!) as object, { handles, ancestors: [root] }).entries;
  assert.deepEqual(grand.find((e) => e.key === "back")!.value, { k: "cyc", p: "[circular]" });
  // Without the ancestor path the same object is just an object (shared, not circular).
  assert.equal(inspect(root.child).entries.find((e) => e.key === "back")!.value.k, "o");
});

test("inspect: class instances list own fields, then prototype accessors without invoking them", () => {
  let calls = 0;
  class Base {
    get id() {
      calls++;
      return 1;
    }
  }
  class Cart extends Base {
    items = [1, 2];
    #hidden = 1;
    get total() {
      calls++;
      return this.#hidden;
    }
    set total(_value: number) {}
    add() {}
  }
  const cart = new Cart();
  assert.equal(preview(cart).p, "Cart {items}");
  assert.deepEqual(inspect(cart).entries, [
    { key: "items", value: { k: "a", p: "Array(2)", n: 2 } },
    { key: "total", value: { k: "get", p: "(getter)" }, proto: true },
    { key: "id", value: { k: "get", p: "(getter)" }, proto: true },
  ]);
  assert.equal(calls, 0);
  // Plain objects get no prototype listing.
  assert.deepEqual(inspect({ a: 1 }).entries, [{ key: "a", value: { k: "n", p: "1" } }]);
});

test("built-ins: typed arrays, buffers, functions, classes, empty containers", () => {
  const handles = new Handles();
  const bytes = preview(new Uint8Array([1, 2, 3]), { handles });
  assert.deepEqual([bytes.k, bytes.p, bytes.n], ["a", "Uint8Array(3)", 3]);
  assert.deepEqual(inspect(handles.get(bytes.h!) as object).entries.map((e) => e.value.p), ["1", "2", "3"]);
  assert.equal(preview(new ArrayBuffer(8)).p, "ArrayBuffer(8)");
  assert.equal(preview(new DataView(new ArrayBuffer(4))).p, "DataView(4)");
  assert.equal(preview(class Thing {}).p, "class Thing");
  // Nothing to expand: no handle.
  for (const empty of [[], new Map(), new Set(), {}]) assert.equal(preview(empty, { handles }).h, undefined);
  assert.notEqual(preview({ a: 1 }, { handles }).h, undefined);
});

test("long strings keep a handle to their full text", () => {
  const handles = new Handles();
  const long = "y".repeat(1000);
  const p = preview(long, { handles });
  assert.equal(p.k, "trunc");
  assert.equal(handles.get(p.h!), long);
});

test("setPath replaces an existing leaf in a fresh copy", () => {
  const value = { list: [1, { deep: "a" }], n: 1 };
  const result = setPath(value, ["list", "1", "deep"], "b");
  assert.deepEqual(result, { ok: true, value: { list: [1, { deep: "b" }], n: 1 } });
  assert.equal(value.list[1]!.constructor, Object);
  assert.deepEqual(value, { list: [1, { deep: "a" }], n: 1 }, "original untouched");
  assert.equal(setPath(value, ["missing"], 1).ok, false);
  assert.equal(setPath(value, ["n", "x"], 1).ok, false);
  assert.equal(setPath(new Map(), ["a"], 1).ok, false);
  assert.deepEqual(setPath(5, [], 6), { ok: true, value: 6 });
});

test("cross-realm values preview by brand, not instanceof (iframe apps)", async () => {
  const { runInNewContext } = await import("node:vm");
  const other = runInNewContext(`({
    map: new Map([[1, 2]]), set: new Set([1]), date: new Date(0), re: /a+/gi, promise: Promise.resolve(),
    error: new TypeError("bad"), buffer: new ArrayBuffer(4), view: new DataView(new ArrayBuffer(2)), plain: { a: 1 }, list: [1, 2],
  })`) as Record<string, object>;
  assert.equal(other.map instanceof Map, false);
  assert.deepEqual(preview(other.map), { k: "map", p: "Map(1)", n: 1 });
  assert.equal(preview(other.set).p, "Set(1)");
  assert.equal(preview(other.date).p, "1970-01-01T00:00:00.000Z");
  assert.equal(preview(other.re).p, "/a+/gi");
  assert.equal(preview(other.promise).k, "prom");
  assert.equal(preview(other.error).p, "TypeError: bad");
  assert.equal(preview(other.buffer).p, "ArrayBuffer(4)");
  assert.equal(preview(other.view).p, "DataView(2)");
  // A plain object of another realm is plain (no prototype accessors listed, JSON-editable).
  assert.deepEqual(preview(other.plain), { k: "o", p: "{a}", n: 1, c: "plain" });
  assert.ok(jsonSafe(other.plain) && jsonSafe(other.list));
  assert.deepEqual(inspect(other.map).entries, [{ key: "1", value: { k: "n", p: "2" } }]);
  // Brand checks never accept look-alikes or the prototypes themselves.
  assert.equal(preview(Object.create(Map.prototype)).k, "o");
  assert.equal(preview(RegExp.prototype).k, "o");
  assert.equal(preview({ [Symbol.toStringTag]: "Map", size: 3 }).k, "o");
});

test("jsonSafe rejects sparse arrays (a JSON round trip turns holes into null)", () => {
  assert.equal(jsonSafe([1, , 3]), false);
  assert.equal(jsonSafe({ a: [, 1] }), false);
  assert.equal(jsonSafe([1, undefined].slice(0, 1)), true);
  assert.equal(setPath({ a: [1, , 3], b: 1 }, ["b"], 2).ok, false);
});
