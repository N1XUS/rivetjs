// WebAssembly list-row emitter (server-rows.ts): seeded parity fuzz against escapeText / escapeAttribute + UTF-8,
// chunk / slab-piece boundaries, backpressure, abort, rows it does not take, and the forced fallback (no
// WebAssembly) — the renderer's bytes are identical with and without it.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { NodeStreamWriter } from "../node.ts";
import { escapeAttribute, escapeText } from "../escape.ts";
import { renderToString, renderToWriter, compiledTemplate, _list, _listPlan } from "../server.ts";
import type { ListPlan, ServerValue } from "../server.ts";
import { _listRows, _setListRows } from "../server-rows.ts";

afterEach(() => _setListRows(true));

let seed = 0x5eed;
const rnd = (n: number) => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
  return seed % n;
};
const alphabet = [
  "a",
  "Z",
  "0",
  " ",
  "&",
  "<",
  ">",
  '"',
  "'",
  "é",
  "€",
  "漢",
  "\u{1D11E}",
  "\ud800",
  "\udc00",
  "\udbff",
  "\u007f",
  "\u0080",
  "ÿ",
  "\n",
  "&amp;",
];
function text(max: number): string {
  let s = "";
  const n = rnd(max);
  for (let i = 0; i < n; i++) s += rnd(3) ? String.fromCharCode(97 + rnd(26)) : alphabet[rnd(alphabet.length)];
  return s;
}
const INT32 = [0, -0, 1, -1, 9, 10, 99, 100, 2 ** 31 - 1, -(2 ** 31), 1e9, -1e9, 123456789];
function value(): string | number {
  const pick = rnd(6);
  if (pick === 0) return INT32[rnd(INT32.length)]!;
  if (pick === 1) return rnd(2) ? -rnd(2 ** 31 - 1) - 1 : rnd(2 ** 31 - 1);
  return text(rnd(4) ? 12 : 90);
}

/** A byte writer with the raw-slab protocol; `pause(i)` makes the i-th claim return a wait. */
class Slab {
  bytes = Buffer.alloc(1 << 23);
  offset = 0;
  claims = 0;
  readonly pause: (claim: number) => boolean;
  constructor(pause: (claim: number) => boolean = () => false) {
    this.pause = pause;
  }
  claim(length: number): unknown {
    assert.ok(length <= 32 * 1024, "claims stay within the raw-slab limit");
    assert.ok(this.offset + length <= this.bytes.length);
    return this.pause(this.claims++) ? Promise.resolve() : undefined;
  }
  commit(end: number): unknown {
    this.offset = end;
    return undefined;
  }
  out(): Buffer {
    return this.bytes.subarray(0, this.offset);
  }
}
/** The per-row byte path's output: each value encoded on its own (a lone surrogate → U+FFFD per value). */
function expected(plan: ListPlan, tape: readonly unknown[], rows: number): Buffer {
  const parts: Buffer[] = [];
  const width = plan.attributes.length;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < width; k++) {
      parts.push(Buffer.from(plan.fragments[k]!));
      const slot = plan.attributes[k]!,
        v = tape[r * width + k];
      if (typeof slot === "number") continue;
      if (slot === null) parts.push(Buffer.from(typeof v === "number" ? String(v) : v == null || typeof v === "boolean" ? "" : escapeText(v as string)));
      else parts.push(Buffer.from(slot.raw!.text + (typeof v === "number" ? String(v) : escapeAttribute(v as string)) + '"'));
    }
    parts.push(Buffer.from(plan.fragments[width]!));
  }
  return Buffer.concat(parts);
}
function drive(plan: ListPlan, tape: readonly unknown[], rows: number, slab: Slab): void {
  for (let r = 0; r < rows;) {
    const next = _listRows(plan, tape, r, rows, slab, undefined);
    assert.equal(typeof next, "number", "no wait without backpressure");
    assert.ok((next as number) > r, `row ${r} taken`);
    r = next as number;
  }
}

test("row emitter: seeded fuzz matches the per-row encoding (text / attribute escapes, multibyte, lone surrogates, int32 extremes)", () => {
  for (let t = 0; t < 1500; t++) {
    const width = 1 + rnd(5);
    const fragments = Array.from({ length: width + 1 }, (_, k) => "<f" + k + ">".repeat(rnd(20)) + (rnd(5) ? "" : "é"));
    const entries = Array.from({ length: width }, (_, k) => (rnd(2) ? ([`data-${k}`, "html"] as const) : null));
    const plan = _listPlan(fragments, entries);
    const rows = 1 + rnd(6);
    const tape: unknown[] = [];
    for (let i = 0; i < rows * width; i++) tape.push(value());
    const slab = new Slab();
    drive(plan, tape, rows, slab);
    const want = expected(plan, tape, rows);
    if (!slab.out().equals(want)) assert.fail(`case ${t}: ${JSON.stringify(tape)}\n got  ${slab.out()}\n want ${want}`);
  }
});

test("row emitter: values ending / starting with surrogate halves stay separate (U+FFFD each), empty and child-only slots", () => {
  const plan = _listPlan(["<i>", "|", "</i>"], [null, null]);
  const tape = ["a\ud800", "\udc00b", "\ud83d", "\ude00", "", "", "\u{1F600}", "x", null, true, false, undefined];
  const slab = new Slab();
  drive(plan, tape, 6, slab);
  assert.deepEqual(slab.out(), expected(plan, tape, 6));
  assert.ok(slab.out().includes(Buffer.from("a�|�b")));
});

test("row emitter: large lists cross chunk and slab-piece boundaries; long strings and flattened component bounds", () => {
  const inner = _listPlan(["<b", ">", "</b>"], [["title", "html"], null]);
  const plan = _listPlan(["<tr><td>", "</td>", "<td>", "</td></tr>"], [null, inner, null]);
  const width = plan.attributes.length;
  const rows = 6000;
  const tape: unknown[] = [];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < width; k++) {
      const slot = plan.attributes[k];
      tape.push(typeof slot === "number" ? undefined : r % 997 === 0 ? "&<\"'>".repeat(400) : r % 3 ? `row ${r} <${k}> & "é€"` : r * (k + 1));
    }
  }
  const slab = new Slab();
  drive(plan, tape, rows, slab);
  assert.deepEqual(slab.out(), expected(plan, tape, rows));
});

test("row emitter: more value slots than one chunk's length table holds (tiny rows)", () => {
  const plan = _listPlan(["<i>", "</i>"], [null]);
  const tape = Array.from({ length: 40000 }, (_, i) => (i % 3 ? i % 10 : ""));
  const slab = new Slab();
  drive(plan, tape, tape.length, slab);
  assert.deepEqual(slab.out(), expected(plan, tape, tape.length));
});

test("row emitter: backpressure returns the wait with the next row; continuing yields the same bytes", () => {
  const plan = _listPlan(["<li", ">", "</li>"], [["data-id", "html"], null]);
  const rows = 4000;
  const tape: unknown[] = [];
  for (let r = 0; r < rows; r++) tape.push(r, `item ${r} & <more> text`.repeat(3));
  const slab = new Slab((claim) => claim % 3 === 1);
  let waits = 0;
  for (let r = 0; r < rows;) {
    const next = _listRows(plan, tape, r, rows, slab, undefined);
    if (typeof next === "number") r = next;
    else {
      waits++;
      assert.ok(next.wait instanceof Promise && next.row > r);
      r = next.row;
    }
  }
  assert.ok(waits > 2);
  assert.deepEqual(slab.out(), expected(plan, tape, rows));
});

test("row emitter: rows it does not take are left to the caller; plans with boolean attributes are never taken", () => {
  const plan = _listPlan(["<a", " x", ">", "</a>"], [["href", "html"], ["data-n", "html"], null]);
  const tape: unknown[] = [1, 2, "ok", "x/url", 3, "url string attribute", 4, null, "null attribute", 5, 6, 2 ** 40, 7, 8, { o: 1 }, 9, 1.5, "f"];
  const slab = new Slab();
  assert.equal(_listRows(plan, tape, 0, 6, slab, undefined), 1, "URL attribute string that needs the scheme check: caller");
  assert.equal(_listRows(plan, tape, 1, 6, slab, undefined), 1);
  assert.equal(_listRows(plan, tape, 2, 6, slab, undefined), 2, "null attribute: caller");
  assert.equal(_listRows(plan, tape, 3, 6, slab, undefined), 3, "non-int32 number: caller");
  assert.equal(_listRows(plan, tape, 4, 6, slab, undefined), 4, "object child: caller");
  assert.equal(_listRows(plan, tape, 5, 6, slab, undefined), 5, "non-integer attribute: caller");
  assert.equal(_listRows(_listPlan(["<input", ">"], [["disabled", "html"]]), [1], 0, 1, slab, undefined), -1);
  const controller = new AbortController();
  controller.abort(new Error("stop"));
  assert.throws(() => _listRows(plan, [1, 2, "x"], 0, 1, slab, controller.signal), /stop/);
});

test("row emitter: URL attribute values starting with / # ? . are taken (no scheme), byte-identical", () => {
  const plan = _listPlan(["<a", ">", "</a>"], [["href", "html"], null]);
  const urls = ["/item/1", "#x", "?q=<&>", "./a b", "/'\"", "/é€"];
  const tape = urls.flatMap((url, i) => [url, "row " + i]);
  const slab = new Slab();
  assert.equal(_listRows(plan, tape, 0, urls.length, slab, undefined), urls.length);
  assert.deepEqual(slab.out(), expected(plan, tape, urls.length));
  const list = _listPlan(["<img", ">"], [["srcset", "html"]]);
  assert.equal(_listRows(list, ["/a.png 1x"], 0, 1, new Slab(), undefined), 0, "URL lists: caller");
});

test("row emitter: row-region marker ids go through the renderer's mark callback once per taken row", () => {
  const plan = _listPlan(["<!--r", "[--><b>", "</b><!--]-->"], [null, null]);
  const tape = [10, "a", 14, "b", 18, "c", 22, { o: 1 }, 26, "e"];
  const seen: number[] = [];
  const mark = (id: number) => (seen.push(id), id === 10 || id === 14 ? id : -1);
  const slab = new Slab();
  assert.equal(_listRows(plan, tape, 0, 5, slab, undefined, mark, 1), 3, "object child: caller");
  assert.deepEqual(seen, [10, 14, 18], "no mark for the refused row");
  assert.equal(slab.out().toString(), "<!--r10[--><b>a</b><!--]--><!--r14[--><b>b</b><!--]--><!--r[--><b>c</b><!--]-->");
});

function collect() {
  const parts: Buffer[] = [];
  const sink = new Writable({
    highWaterMark: 1 << 20,
    write(chunk: Buffer, _encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  return { sink, bytes: () => Buffer.concat(parts) };
}
async function viaWriter(page: () => ServerValue, threshold: number): Promise<Buffer> {
  const { sink, bytes } = collect();
  const writer = new NodeStreamWriter(sink, { threshold });
  await renderToWriter(page(), writer);
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  return bytes();
}

test("renderer: list pages are byte-identical with the emitter, with it forced off, and to renderToString", async () => {
  const fragments = ["<tr", "><td>", "</td><td", ">", "</td><td>", "</td></tr>"];
  const plan = _listPlan(fragments, [["data-id", "html"], null, ["title", "html"], null, null]);
  const em = Object.freeze(["<em>", "</em>"]);
  const items = Array.from({ length: 3000 }, (_, i) => [
    i,
    i % 11 ? `name ${i} <&> é𝄞` : compiledTemplate(em, [i] as never),
    i % 7 ? `t"${i}'` : null,
    i % 13 ? -i * 7919 : 2 ** 33,
    i % 17 ? "x".repeat(i % 90) : true,
  ]);
  const page = () =>
    compiledTemplate(Object.freeze(["<table>", "</table>"]), [
      _list(items, (() => null) as never, plan, (tape, base, item) => {
        for (let k = 0; k < 5; k++) tape[base + k] = (item as unknown[])[k];
      }),
    ] as never);
  const html = Buffer.from((await renderToString(page())) as string);
  for (const threshold of [64, 48 * 1024]) {
    _setListRows(true);
    const on = await viaWriter(page, threshold);
    _setListRows(false);
    const off = await viaWriter(page, threshold);
    assert.deepEqual(on, off, `threshold ${threshold}`);
    assert.deepEqual(on, html, `threshold ${threshold}`);
  }
});

test("fallback: without WebAssembly (or when compiling from bytes throws) the emitter takes no row, for good", () => {
  const plan = _listPlan(["<i>", "</i>"], [null]);
  const saved = globalThis.WebAssembly;
  for (const stub of [
    undefined,
    {
      ...saved,
      Module: class {
        constructor() {
          throw new Error("Wasm code generation disallowed by embedder");
        }
      },
    },
  ]) {
    Object.defineProperty(globalThis, "WebAssembly", { value: stub, configurable: true, writable: true });
    try {
      _setListRows(true);
      assert.equal(_listRows(plan, ["x"], 0, 1, new Slab(), undefined), -1);
      Object.defineProperty(globalThis, "WebAssembly", { value: saved, configurable: true, writable: true });
      assert.equal(_listRows(plan, ["x"], 0, 1, new Slab(), undefined), -1, "stays off for the process");
    } finally {
      Object.defineProperty(globalThis, "WebAssembly", { value: saved, configurable: true, writable: true });
    }
  }
  _setListRows(true);
  assert.equal(_listRows(plan, ["x"], 0, 1, new Slab(), undefined), 1);
});
