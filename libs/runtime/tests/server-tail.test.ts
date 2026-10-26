// Boundaries tail wire format v2 (ZERO S2, 2026-10-25): `server-tail.ts` encoder against the `resume-format.ts` decoders
// (`eachRecord` / `recAt` / `expandTail`). Names table + URL table, stateless consecutive-id runs (period 1–4, absolute or
// relative template parents), records with values / props kept whole.
import { test } from "vitest";
import assert from "node:assert/strict";
import { escapeJSON, expandTail, recAt, type BoundaryRecord, type BoundaryTail, type FlushTail } from "../resume-format.ts";
import { chunkBase, encodeTail, foAttr, shortUrl, tailOf } from "../server-tail.ts";

const copy = (t: FlushTail): FlushTail => ({ ...t, b: t.b.map((r) => [...r] as BoundaryRecord) });
/** Encode (on a copy: the encoder reuses records in place) and decode back. */
const roundTrip = (t: FlushTail): { wire: BoundaryTail; back: FlushTail } => {
  const wire = JSON.parse(encodeTail(copy(t))) as BoundaryTail;
  return { wire, back: expandTail(wire) };
};
const rec = (id: number, parent: number, name: string, signals: unknown[] = [], flags = 0, props?: object): BoundaryRecord =>
  props ? [id, parent, flags, name, signals, props] : [id, parent, flags, name, signals];

test("1000 stateless siblings are one run of period 1 (absolute parent)", () => {
  const b = [rec(1, 0, "App", ["a-0", 1], 1), ...Array.from({ length: 1000 }, (_, i) => rec(i + 2, 1, "Control"))];
  const t: FlushTail = { b, m: { App: "/assets/app-X.js", Control: "/assets/page-Y.js" }, e: { Control: "click" } };
  const { wire, back } = roundTrip(t);
  assert.deepEqual(wire.n, [
    ["App", 0],
    ["Control", 1, "click"],
  ]);
  assert.deepEqual(wire.u, ["/assets/app-X.js", "/assets/page-Y.js"]);
  assert.deepEqual(wire.b, [
    [1, 0, 1, 0, ["a-0", 1]],
    [2, 0, 0, -1, 1000, [[1, 0, 1]]],
  ]);
  assert.deepEqual(back, t);
});

test("interleaved parent / child pairs: period 2 with relative child parents", () => {
  const b: BoundaryRecord[] = [rec(1, 0, "Grid", ["g-0", 0])];
  for (let i = 0; i < 6; i++) b.push(rec(2 + 2 * i, 1, "UiCell"), rec(3 + 2 * i, 2 + 2 * i, "CdkCell", [], 2));
  const t: FlushTail = { b };
  const { wire, back } = roundTrip(t);
  assert.deepEqual(wire.b[1], [
    2,
    0,
    0,
    -1,
    6,
    [
      [1, 0, 1],
      [-1, 2, 2],
    ],
  ]);
  assert.equal(wire.u, undefined);
  assert.deepEqual(back, t);
});

test("runs break on state, props, id gaps and name / flag changes; short repeats stay records", () => {
  const b = [
    rec(1, 0, "A"),
    rec(2, 0, "A"),
    rec(3, 0, "A"),
    rec(4, 0, "A", ["k-0", 1]), // state: own record
    rec(5, 0, "A"),
    rec(6, 0, "A"), // two records only: below the 3-record cover
    rec(8, 0, "A"), // id gap
    rec(9, 0, "A"),
    rec(10, 0, "A", [], 0, { p: 1 }), // props: own record
    rec(11, 0, "B"),
    rec(12, 0, "B", [], 1), // flags differ
  ];
  const t: FlushTail = { b };
  const { wire, back } = roundTrip(t);
  assert.deepEqual(wire.b, [
    [1, 0, 0, -1, 3, [[0, 0, 0]]],
    [4, 0, 0, 0, ["k-0", 1]],
    [5, 0, 0, 0],
    [6, 0, 0, 0],
    [8, 0, 0, 0],
    [9, 0, 0, 0],
    [10, 0, 0, 0, [], { p: 1 }],
    [11, 0, 0, 1],
    [12, 0, 1, 1],
  ]);
  assert.deepEqual(back, t);
});

test("a template slot whose parent is neither constant nor at a constant offset ends the run", () => {
  // Children of 1, 1, 1 then 2, 2: the fourth breaks the absolute parent, and the offset was never constant. The last two
  // stay records (a run covers ≥ 3 records: a 2-record run saves 2 bytes and would cut a longer-period run short).
  const b = [rec(1, 0, "R"), rec(2, 1, "C"), rec(3, 1, "C"), rec(4, 1, "C"), rec(5, 2, "C"), rec(6, 2, "C")];
  const { wire, back } = roundTrip({ b });
  assert.deepEqual(wire.b, [
    [1, 0, 0, 0],
    [2, 0, 0, -1, 3, [[1, 0, 1]]],
    [5, 2, 0, 1],
    [6, 2, 0, 1],
  ]);
  assert.deepEqual(back.b, b);
});

test("recAt finds records and run members (binary search), undefined past the end and in gaps", () => {
  const b = [rec(1, 0, "App", ["a", 1]), ...Array.from({ length: 50 }, (_, i) => rec(i + 2, 1, "X")), rec(60, 1, "Y")];
  const { wire } = roundTrip({ b });
  assert.deepEqual(recAt(wire, 1), [1, 0, 0, 0, ["a", 1]]);
  assert.deepEqual(recAt(wire, 30), [30, 1, 0, 1]);
  assert.deepEqual(recAt(wire, 60), [60, 1, 0, 2]);
  assert.equal(recAt(wire, 55), undefined);
  assert.equal(recAt(wire, 0), undefined);
  assert.equal(recAt(wire, 61), undefined);
});

test("other tail fields pass through; an empty flush is `{v:2,n:[],b:[]}`", () => {
  const t: FlushTail = { b: [rec(1, 0, "A", ["x", 1])], w: { "1.x": [2] }, k: { "1": "Enter" }, a: [[1, 1, 0]] };
  assert.deepEqual(roundTrip(t).back, t);
  assert.equal(encodeTail({ b: [] }), '{"v":2,"n":[],"b":[]}');
});

test("chunk URLs: short form under the runtime directory, whole elsewhere", () => {
  assert.equal(chunkBase("/assets/dom-derived-I.js"), "/assets/");
  assert.equal(chunkBase("/rt.js"), "/");
  assert.equal(chunkBase("rt.js"), undefined);
  assert.equal(chunkBase(undefined), undefined);
  assert.equal(shortUrl("/assets/page-B.js", "/assets/"), "page-B");
  assert.equal(shortUrl("/assets/sub/page-B.js", "/assets/"), "/assets/sub/page-B.js");
  assert.equal(shortUrl("/other/page-B.js", "/assets/"), "/other/page-B.js");
  assert.equal(shortUrl("/assets/page-B.js", undefined), "/assets/page-B.js");
  assert.equal(foAttr(["/assets/a.js", "/x/b.js"], "/assets/"), "a /x/b.js");
  const wire = tailOf({ b: [rec(1, 0, "A")], m: { A: "/assets/a-1.js" } }, "/assets/");
  assert.deepEqual(wire.u, ["a-1"]);
});

test("script-safe: `</script>` in a value is escaped", () => {
  const json = encodeTail({ b: [rec(1, 0, "A", ["s", "</script><!--"])] });
  assert.ok(!json.includes("</script>") && !json.includes("<!--"), json);
  assert.deepEqual(expandTail(JSON.parse(json)).b[0]![4], ["s", "</script><!--"]);
});

test("per-field encoding is byte-identical to one JSON.stringify of the tail (integer-keyed `c` / `k`, every field)", () => {
  const rows = Array.from({ length: 50 }, (_, id) => ({ id, values: [id, id + 1, "a<b "] }));
  const t: FlushTail = {
    b: [rec(1, 0, "App", ["s", 1], 1, { s: { d: [{ lane: "x" }, null, { title: "A < B & C", rows }] } }), rec(2, 1, "Page", [], 2)],
    m: { App: "/assets/app-X.js", Page: "/assets/page-Y.js" },
    e: { Page: "click" },
    w: { "2.$1": [2] },
    i: ["/assets/island.js"],
    k: { "2": "Enter Space" },
    g: [[1, "a[href]"]],
    a: [[1, 1, 0]],
    c: { "2": 8, "10": 1 },
  };
  const once = escapeJSON(JSON.stringify(tailOf(copy(t), "/assets/")));
  assert.equal(encodeTail(copy(t), "/assets/"), once);
});
