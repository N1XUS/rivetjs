import { test } from "vitest";
import assert from "node:assert/strict";
import { createEncoder, createDecoder, escapeJSON, reachableSymbols, _builtinKinds, _decodeWire } from "../resume-format.ts";
import { signal } from "@rivetjs/reactivity";
import type { TableEntry } from "../resume-format.ts";
import type { Signal } from "@rivetjs/reactivity";

type Ref = (value: unknown) => number;
type Special = (value: unknown, ref: Ref) => object | undefined;
interface Hooks {
  signal?: () => Signal<unknown>;
  fn?: (sym: string | number, captures: unknown[]) => unknown;
}

const roundTrip = (value: unknown, special?: Special, hooks?: Hooks): unknown => {
  const encoder = createEncoder({ special });
  const root = encoder.ref(value);
  const table: unknown[] = JSON.parse(JSON.stringify(encoder.table));
  return createDecoder(table, hooks).get(root);
};

test("primitives and special numbers round-trip", () => {
  for (const value of ["", "x", 0, 1.5, -3, true, false, null, undefined, NaN, Infinity, -Infinity, 10n ** 30n])
    assert.ok(Object.is(roundTrip(value), value), String(value));
  assert.ok(Object.is(roundTrip(-0), -0));
});

test("containers round-trip with holes, prototypes and own __proto__ keys", () => {
  const sparse = [1, , 3];
  const out = roundTrip({ a: [sparse, new Date(5), new Map<unknown, unknown>([[1, "a"], ["k", { z: 1 }]]), new Set([1, "1"])] }) as {
    a: [unknown[], Date, Map<unknown, unknown>, Set<unknown>];
  };
  assert.equal(out.a[0].length, 3);
  assert.equal(1 in out.a[0], false);
  assert.equal(out.a[1].getTime(), 5);
  assert.deepEqual([...out.a[2]], [[1, "a"], ["k", { z: 1 }]]);
  assert.deepEqual([...out.a[3]], [1, "1"]);
  const proto: unknown = JSON.parse('{"__proto__": {"polluted": 1}}');
  const decoded = roundTrip(proto) as object;
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyNames(decoded), ["__proto__"]);
  assert.equal(({} as { polluted?: unknown }).polluted, undefined);
  // URLs keep their href; a shared instance stays one reference.
  const at = new URL("https://example.test/a?b=1#c");
  const urls = roundTrip([at, at]) as [URL, URL];
  assert.ok(urls[0] instanceof URL);
  assert.equal(urls[0].href, at.href);
  assert.equal(urls[0], urls[1]);
  // `origin`: same-origin URLs encode relative (no build-time origin in prerendered state) and resolve against the
  // browser's location; other origins stay absolute.
  const encoder = createEncoder({ origin: "http://localhost" });
  const rel = encoder.ref([new URL("http://localhost/docs/a?b=1#c"), new URL("https://cdn.test/x")]);
  const text = JSON.stringify(encoder.table);
  assert.doesNotMatch(text, /localhost/);
  assert.match(text, /"\/docs\/a\?b=1#c"/);
  const location = (globalThis as { location?: unknown }).location;
  (globalThis as { location?: unknown }).location = { href: "https://site.test/blog/" };
  try {
    const [here, there] = createDecoder(JSON.parse(text) as unknown[]).get(rel) as [URL, URL];
    assert.equal(here.href, "https://site.test/docs/a?b=1#c");
    assert.equal(there.href, "https://cdn.test/x");
  } finally {
    (globalThis as { location?: unknown }).location = location;
  }
  const bare = Object.create(null) as { k?: number };
  bare.k = 1;
  assert.equal((roundTrip(bare) as { k: number }).k, 1);
});

test("sharing and cycles keep identity", () => {
  interface Cyclic {
    shared: { v: number };
    self?: Cyclic;
  }
  const shared = { v: 1 }, cyclic: Cyclic = { shared };
  cyclic.self = cyclic;
  const map = new Map<string, unknown>();
  map.set("me", map);
  const out = roundTrip([shared, shared, cyclic, map]) as [object, object, Cyclic, Map<string, unknown>];
  assert.equal(out[0], out[1]);
  assert.equal(out[2].shared, out[0]);
  assert.equal(out[2].self, out[2]);
  assert.equal(out[3].get("me"), out[3]);
});

test("primitives are interned once; all-literal arrays and objects stay inline", () => {
  const encoder = createEncoder();
  encoder.ref(["a", "a", 1, 1, "1", true, undefined]);
  assert.deepEqual(encoder.table, [[1, 1, 2, 2, 3, 4, 5], "a", 1, "1", true, { u: 0 }]);
  const inline = createEncoder();
  const shared = { id: 1, label: "x", ok: null };
  inline.ref([shared, shared, [1, "b", false]]);
  assert.deepEqual(inline.table, [[1, 1, 2], { j: { id: 1, label: "x", ok: null } }, { j: [1, "b", false] }]);
  // Without `j` entries (a streamed render's earlier segments): `p` / `l`.
  const table = createEncoder({ json: false });
  table.ref([shared, shared, [1, "b", false]]);
  assert.deepEqual(table.table, [[1, 1, 2], { p: ["id", 1, "label", "x", "ok", null] }, { l: [1, "b", false] }]);
  const out = createDecoder(inline.table).get(0) as unknown[];
  assert.deepEqual(out, [shared, shared, [1, "b", false]]);
  assert.equal(out[0], out[1]);
});

test("mixed objects keep numbers / booleans / null inline, other values (strings: interned) as [ref], in key order", () => {
  const encoder = createEncoder();
  const row = { id: 7, values: [1, 2], label: "x", nested: { deep: undefined } };
  encoder.ref([row, row]);
  assert.deepEqual(encoder.table[1], { p: ["id", 7, "values", [2], "label", [3], "nested", [4]] });
  assert.deepEqual(encoder.table[4], { o: ["deep", 5] });
  const out = createDecoder(JSON.parse(JSON.stringify(encoder.table))).get(0) as (typeof row)[];
  assert.deepEqual(out, [row, row]);
  assert.equal(out[0], out[1]);
  assert.deepEqual(Object.keys(out[0]!), ["id", "values", "label", "nested"]);
  // A `[ref]` goes through the same checks as any reference.
  assert.throws(() => createDecoder([{ p: ["a", ["0"]] }]).get(0), RangeError);
  assert.throws(() => createDecoder([{ p: ["a", [9]] }]).get(0), RangeError);
});

test("plain JSON trees are one `j` entry; objects inside referenced elsewhere become `i` entries, identity kept", () => {
  const rows = [
    { id: 1, values: [10, 11], tags: { a: "x" } },
    { id: 2, values: [20, 21], tags: { a: "y" } },
  ];
  const data = { title: "t", rows };
  const encoder = createEncoder();
  const root = encoder.ref(data);
  const second = encoder.ref(rows[1]);
  const values = encoder.ref(rows[0]!.values);
  assert.deepEqual(encoder.table[root], { j: data });
  assert.deepEqual(encoder.table[second], { i: [encoder.table.findIndex((e) => (e as { i?: unknown[] })?.i?.[1] === "rows"), 1] });
  assert.equal(encoder.ref(rows[1]), second);
  const wire: unknown[] = JSON.parse(JSON.stringify(encoder.table));
  // Decoded from either end: the same objects.
  for (const order of [
    [root, second, values],
    [values, second, root],
  ]) {
    const decoder = createDecoder(wire);
    const out = order.map((ref) => decoder.get(ref));
    const [d, r, v] = [decoder.get(root), decoder.get(second), decoder.get(values)] as [typeof data, object, number[]];
    assert.deepEqual(out.length, 3);
    assert.deepEqual(d, data);
    assert.equal(d.rows[1], r);
    assert.equal(d.rows[0]!.values, v);
  }
  // A decoded tree resolves its `i` entries at once: later mutation of the tree does not move them.
  const decoder = createDecoder(wire);
  const d = decoder.get(root) as typeof data;
  const kept = d.rows[1];
  d.rows.splice(0, 2);
  assert.equal(decoder.get(second), kept);
  // Bad `i` paths fail.
  assert.throws(() => createDecoder([{ j: { a: 1 } }, { i: [0, "constructor"] }]).get(1), TypeError);
  assert.throws(() => createDecoder([{ j: { a: 1 } }, { i: [0, "b"] }]).get(1), TypeError);
});

test("`j` only for plain trees: shared, cyclic, non-literal, digit-keyed or opaque objects use the table", () => {
  const shared = { a: 1 };
  const cases: [unknown, boolean][] = [
    [{ a: [1, "x", true, null], b: { c: 2 } }, true],
    [{ x: shared, y: shared }, false],
    [{ a: undefined }, false],
    [[1, , 2], false],
    [{ n: NaN }, false],
    [{ z: -0 }, false],
    [{ d: new Date(0) }, false],
    [{ "1": "a" }, false],
    [{ f: () => 1 }, false],
    [{ big: 1n }, false],
    [Object.assign(Object.create(null), { a: 1 }), true],
    [[], false],
    [{}, false],
  ];
  for (const [value, json] of cases) {
    const encoder = createEncoder();
    let root: number;
    try {
      root = encoder.ref(value);
    } catch {
      assert.equal(json, false);
      continue;
    }
    assert.equal("j" in Object(encoder.table[root]), json, JSON.stringify(encoder.table));
    // A failed check leaves nothing registered: the objects get ordinary entries.
    assert.ok(encoder.table.every((e) => !(e && typeof e === "object" && "i" in e)));
    // (A null-prototype object decodes as a plain one, as through the table.)
    if ((value as { f?: unknown }).f === undefined)
      assert.deepEqual(roundTrip(value), Object.getPrototypeOf(value) === null ? { ...(value as object) } : value);
  }
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  const out = roundTrip(cyclic) as typeof cyclic;
  assert.equal(out.self, out);
  // An object encoded before (or opaque to the special hook) inside a tree: table, sharing kept.
  const encoder = createEncoder({ opaque: (value) => value === shared });
  encoder.ref({ s: shared });
  assert.ok(!("j" in Object(encoder.table[0])));
});

test("built-in entries decode only once @rivetjs/runtime/resume-builtins loads (zero cost: not in the core decoder)", async () => {
  const encoder = createEncoder();
  const root = encoder.ref({ re: /x/g, params: new URLSearchParams("a=1") });
  assert.equal(_builtinKinds(encoder.table), true);
  assert.equal(_builtinKinds(createEncoder().table), false);
  assert.throws(() => createDecoder(JSON.parse(JSON.stringify(encoder.table))).get(root), /resume table entry/i);
  // Wire data names their chunk (`x`); `_decodeWire` loads it as a module script first (a stand-in `document` here).
  const x = new URL("../resume-builtins.ts", import.meta.url).href;
  const scripts: string[] = [];
  const doc = {
    createElement: () => ({}),
    head: { append: (s: { src: string; onload: () => void }) => (scripts.push(s.src), void import(s.src).then(s.onload)) },
  };
  const g = globalThis as { document?: unknown };
  g.document = doc;
  let out: { re: RegExp; params: URLSearchParams };
  try {
    out = (await _decodeWire(JSON.stringify({ t: encoder.table, r: root, x }))) as typeof out;
  } finally {
    delete g.document;
  }
  assert.deepEqual(scripts, [x]);
  assert.ok(out.re instanceof RegExp && out.re.flags === "g");
  assert.equal(out.params.get("a"), "1");
});

test("built-ins round-trip: RegExp (lastIndex), URLSearchParams, binary views, errors with own data (Function Bridge C1)", async () => {
  await import("../resume-builtins.ts");
  const re = /a+/gi;
  re.lastIndex = 2;
  const buffer = new Uint8Array([9, 1, 2, 3, 250]).buffer;
  const cause = { why: "x" };
  const tagged = Object.assign(new TypeError("bad", { cause }), { code: 7 });
  const out = roundTrip({
    re,
    plain: /b/,
    params: new URLSearchParams("q=1&q=2&x=%20"),
    bytes: new Uint8Array([1, 2, 255]),
    view: new Int16Array(buffer.slice(0, 4)),
    sub: new Uint8Array(buffer, 1, 3),
    floats: new Float64Array([1.5, -0, NaN]),
    big: new BigInt64Array([-1n, 2n ** 62n]),
    dv: new DataView(new Uint8Array([4, 5]).buffer),
    buffer,
    error: tagged,
    agg: new AggregateError([new Error("inner")], "many"),
    shared: [cause],
  }) as Record<string, any>;
  assert.ok(out.re instanceof RegExp);
  assert.equal(out.re.source, "a+");
  assert.equal(out.re.flags, "gi");
  assert.equal(out.re.lastIndex, 2);
  assert.equal(out.plain.lastIndex, 0);
  assert.deepEqual(out.params.getAll("q"), ["1", "2"]);
  assert.equal(out.params.get("x"), " ");
  assert.ok(out.bytes instanceof Uint8Array);
  assert.deepEqual([...out.bytes], [1, 2, 255]);
  assert.ok(out.view instanceof Int16Array);
  assert.deepEqual([...out.view], [...new Int16Array(new Uint8Array([9, 1, 2, 3]).buffer)]);
  assert.deepEqual([...out.sub], [1, 2, 3]);
  assert.ok(Object.is(out.floats[1], -0) && Number.isNaN(out.floats[2]));
  assert.deepEqual([...out.big], [-1n, 2n ** 62n]);
  assert.ok(out.dv instanceof DataView);
  assert.equal(out.dv.getUint8(1), 5);
  assert.ok(out.buffer instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(out.buffer)], [9, 1, 2, 3, 250]);
  assert.ok(out.error instanceof TypeError);
  assert.equal(out.error.message, "bad");
  assert.equal((out.error as { code?: number }).code, 7);
  assert.equal(out.error.cause, out.shared[0]); // identity through the table
  assert.equal(Object.keys(out.error).includes("cause"), false);
  assert.ok(out.agg instanceof AggregateError);
  assert.equal(out.agg.errors[0].message, "inner");
});

test("built-in entries refuse subclasses and unknown kinds", async () => {
  await import("../resume-builtins.ts");
  class MyBytes extends Uint8Array {}
  class MyError extends Error {}
  assert.throws(() => createEncoder().ref(new MyBytes(2)), /MyBytes instance is not serializable/);
  assert.throws(() => createEncoder().ref(new MyError("x")), /MyError instance is not serializable/);
  assert.throws(() => createEncoder().ref(new SharedArrayBuffer(2)), /SharedArrayBuffer instance is not serializable/);
  assert.throws(() => createDecoder([{ b: ["Function", ""] }]).get(0), /Invalid resume table entry/);
  assert.throws(() => createDecoder([{ E: ["Function", "x"] }]).get(0), /Invalid resume table entry/);
});

test("reachableSymbols walks an error's own data", () => {
  const fn = () => 1;
  const encoder = createEncoder({ special: (value) => (value === fn ? { f: "m#Page$abc123", a: [] } : undefined) });
  const root = encoder.ref(Object.assign(new Error("x"), { retry: fn }));
  assert.deepEqual([...reachableSymbols(encoder.table, [root])], ["m#Page$abc123"]);
});

test("unsupported values throw a typed error", () => {
  class Point {}
  const cases: [unknown, RegExp][] = [
    [new Point(), /Point instance is not serializable/],
    [() => 1, /function is not serializable/],
    [Symbol("s"), /symbol is not serializable/],
    [new WeakMap(), /WeakMap instance/],
    [Promise.resolve(), /Promise instance/],
  ];
  for (const [value, pattern] of cases)
    assert.throws(() => createEncoder().ref({ value }), (error: unknown) => error instanceof TypeError && pattern.test(error.message));
});

test("special hook encodes reactive and symbol entries; decoder revives them", () => {
  const count = signal(2);
  const handler = () => {};
  const special: Special = (value, ref) =>
    value === count ? { s: ref(count()) } : value === handler ? { f: "m#App$0", a: [ref(count)] } : undefined;
  const out = roundTrip({ count, handler, again: count }, special, {
    signal: () => signal<unknown>(undefined),
    fn: (sym, captures) => ({ sym, captures }),
  }) as { count: Signal<number>; again: unknown; handler: { sym: string; captures: unknown[] } };
  assert.equal(out.count(), 2);
  assert.equal(out.again, out.count);
  assert.equal(out.handler.sym, "m#App$0");
  assert.equal(out.handler.captures[0], out.count);
});

test("signal values may refer back to the signal", () => {
  const box: { s: Signal<unknown> | null } = { s: null };
  const s = signal<unknown>(box);
  box.s = s;
  const out = roundTrip(s, (value, ref) => (value === s ? { s: ref(s()) } : undefined), { signal: () => signal<unknown>(undefined) }) as Signal<{ s: unknown }>;
  assert.equal(out().s, out);
});

test("missing hooks and bad references fail clearly", () => {
  assert.throws(() => createDecoder([{ s: 0 }]).get(0), /requires a signal hook/);
  assert.throws(() => createDecoder([1]).get(4), RangeError);
});

test("reachableSymbols walks captures", () => {
  const table = [{ o: ["h", 1] }, { f: "m#A$0", a: [2] }, { c: "m#A$1", a: [3] }, 1];
  assert.deepEqual([...reachableSymbols(table, [0])], ["m#A$0", "m#A$1"]);
  const mixed: TableEntry[] = [{ p: ["n", 1, "h", [2]] }, 5, { f: "m#B$0", a: [] }];
  assert.deepEqual([...reachableSymbols(mixed, [0])], ["m#B$0"]);
});

test("escapeJSON neutralizes script terminators", () => {
  const json = escapeJSON(JSON.stringify({ x: "</script><!--\u2028" }));
  assert.equal(/<|\u2028/.test(json), false);
  assert.deepEqual(JSON.parse(json), { x: "</script><!--\u2028" });
});
