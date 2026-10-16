// Assembles the server list-row emitter (WebAssembly + SIMD) that `libs/runtime/server-rows.ts` runs, and
// writes its bytes (base64) plus the shared memory layout into libs/runtime/server-rows-wasm.ts (checked in).
// No toolchain: the module is assembled here, opcode by opcode, from the structured body below.
// Usage: node scripts/gen-row-wasm.mjs [--check]   (--check: fail if the output is stale)
//
// export emit(rows, width, input, lens, out, table) -> end offset of the written bytes in `out`.
// Memory (imported "e" "mem", one per process, LAYOUT below):
//   table  (width + 1) × [fragment offset, fragment length, kind] (i32): fragment k precedes value slot k; the last
//          one closes the row. kind 1 = attribute escape (& < > " '), 0 = text escape (& < >).
//   lens   one i32 per value slot per row: UTF-16 length of the slot's string, 0 = writes nothing, -1 = an int32 in
//          nums (lens + NUMS - LENS, same index) written as decimal digits.
//   input  the slots' strings, UTF-8, back to back (lone surrogates already U+FFFD, three bytes = one unit).
// Output equals escapeText / escapeAttribute + UTF-8 (tests/server-rows.test.ts). The SIMD fast path copies 16
// bytes at a time while none is special or non-ASCII (a masked tail for the last < 16 units); fragments are copied
// in 16-byte blocks (over-copy is overwritten by the next write; inputs over-read stay inside the memory).
import { readFileSync, writeFileSync } from "node:fs";

export const LAYOUT = {
  pages: 16, // 1 MiB, fixed (never grown: a growth would detach views held by the driver)
  table: 0, // ≤ 85 slots
  fragments: 1024, // encoded fragments of the loaded plan, < 64 KiB
  lens: 65536, // 16384 i32
  nums: 131072, // 16384 i32 (lens + 65536: hard-coded below)
  input: 196608, // 384 KiB of UTF-8 input
  out: 589824, // 448 KiB of output
  end: 1048576,
};

const uleb = (n) => {
  const b = [];
  do {
    let x = n & 0x7f;
    n >>>= 7;
    if (n) x |= 0x80;
    b.push(x);
  } while (n);
  return b;
};
const sleb = (n) => {
  const b = [];
  for (;;) {
    const x = n & 0x7f;
    n >>= 7;
    if ((n === 0 && !(x & 0x40)) || (n === -1 && x & 0x40)) return (b.push(x), b);
    b.push(x | 0x80);
  }
};

function assemble() {
  const code = [];
  const labels = [];
  const E = (...bytes) => {
    for (const x of bytes) Array.isArray(x) ? code.push(...x) : code.push(x);
  };
  // Locals: params 0–5, then i32 6–14, v128 15, i32 16–18.
  const L = { n: 0, w: 1, inp: 2, lens: 3, out: 4, ftab: 5, p: 6, o: 7, li: 8, r: 9, k: 10, fe: 11, units: 12, c: 13, kind: 14, v: 15, t: 16, d: 17, q: 18 };
  const get = (x) => E(0x20, uleb(L[x]));
  const set = (x) => E(0x21, uleb(L[x]));
  const tee = (x) => E(0x22, uleb(L[x]));
  const i32 = (n) => E(0x41, sleb(n));
  const add = (x, n) => (get(x), i32(n), E(0x6a), set(x));
  const sub = (x, n) => (get(x), i32(n), E(0x6b), set(x));
  const block = (name) => (E(0x02, 0x40), labels.push(name));
  const loop = (name) => (E(0x03, 0x40), labels.push(name));
  const iff = () => (E(0x04, 0x40), labels.push(""));
  const els = () => E(0x05);
  const end = () => (E(0x0b), labels.pop());
  const depth = (name) => {
    const i = labels.lastIndexOf(name);
    if (i < 0) throw new Error("no label " + name);
    return labels.length - 1 - i;
  };
  const br = (name) => E(0x0c, uleb(depth(name)));
  const brIf = (name) => E(0x0d, uleb(depth(name)));
  const load = (offset = 0) => E(0x28, 0, uleb(offset));
  const load8 = (offset = 0) => E(0x2d, 0, uleb(offset));
  const load16 = (offset = 0) => E(0x2f, 0, uleb(offset));
  const store = (offset = 0) => E(0x36, 0, uleb(offset));
  const store8 = (offset = 0) => E(0x3a, 0, uleb(offset));
  const store16 = (offset = 0) => E(0x3b, 0, uleb(offset));
  const v128Load = () => E(0xfd, 0x00, 0, 0);
  const v128Store = () => E(0xfd, 0x0b, 0, 0);
  const splat = (byte) => E(0xfd, 0x0c, Array(16).fill(byte)); // v128.const
  const eq8 = () => E(0xfd, 0x23); // i8x16.eq
  const or = () => E(0xfd, 0x50); // v128.or
  const bitmask = () => E(0xfd, 0x64); // i8x16.bitmask
  // entity: 4 bytes as one i32 store + a 1- or 2-byte tail
  const entity = (head, tail, tailBytes, length) => {
    (get("o"), i32(head), store(0));
    (get("o"), i32(tail), tailBytes === 2 ? store16(4) : store8(4));
    add("o", length);
  };
  const literal = (word) => (get("o"), i32(word), store(0), add("o", 4)); // &lt; / &gt;
  const byte = () => (get("o"), get("c"), store8(0), add("o", 1));

  (get("out"), set("o"), get("inp"), set("p"), get("lens"), set("li"), i32(0), set("r"));
  (block("done"), loop("rows"));
  (get("r"), get("n"), E(0x4f), brIf("done")); // r >= n
  (i32(0), set("k"), get("ftab"), set("fe"));
  (block("slotsDone"), loop("slots"));
  // fragment k, 16-byte blocks
  (get("fe"), load(0), set("q"), get("fe"), load(4), set("d"), get("o"), set("t"));
  (block("copied"), loop("copy"));
  (get("d"), i32(0), E(0x4c), brIf("copied")); // d <= 0
  (get("t"), get("q"), v128Load(), v128Store());
  (add("t", 16), add("q", 16), sub("d", 16), br("copy"));
  (end(), end());
  (get("o"), get("fe"), load(4), E(0x6a), set("o"));
  (get("k"), get("w"), E(0x4f), brIf("slotsDone")); // the closing fragment
  (get("fe"), load(8), set("kind"));
  (get("li"), load(0), set("units"), add("li", 4));
  block("value");
  // int32 slot: decimal digits
  (get("units"), i32(-1), E(0x46), iff());
  (get("li"), load(LAYOUT.nums - LAYOUT.lens - 4), set("t"));
  (get("t"), i32(0), E(0x48), iff()); // t < 0: '-' then the magnitude (unsigned: INT_MIN stays exact)
  (get("o"), i32(45), store8(0), add("o", 1), i32(0), get("t"), E(0x6b), set("t"));
  end();
  (get("t"), set("q"), i32(1), set("d"));
  (block("counted"), loop("count"));
  (get("q"), i32(10), E(0x49), brIf("counted")); // q <u 10
  (get("q"), i32(10), E(0x6e), set("q"), add("d", 1), br("count"));
  (end(), end());
  (get("o"), get("d"), E(0x6a), tee("o"), set("q"));
  loop("digits");
  sub("q", 1);
  (get("q"), get("t"), i32(10), E(0x70), i32(48), E(0x6a), store8(0)); // rem_u + '0'
  (get("t"), i32(10), E(0x6e), tee("t"), brIf("digits")); // div_u
  end();
  br("value");
  end();
  loop("units");
  (get("units"), i32(0), E(0x4c), brIf("value")); // units <= 0
  // c = bitmask(special | high bit) of the next 16 bytes
  (get("p"), v128Load(), tee("v"));
  (splat(38), eq8());
  for (const special of [60, 62, 34, 39]) (get("v"), splat(special), eq8(), or());
  (get("v"), or(), bitmask(), set("c"));
  (get("units"), i32(16), E(0x4e), iff()); // units >= 16
  (get("c"), E(0x45), iff());
  (get("o"), get("v"), v128Store(), add("p", 16), add("o", 16), sub("units", 16), br("units"));
  end();
  els();
  // tail: (c & ((1 << units) - 1)) == 0 → the last units bytes are plain ASCII
  (get("c"), i32(1), get("units"), E(0x74), i32(1), E(0x6b), E(0x71), E(0x45), iff());
  (get("o"), get("v"), v128Store());
  (get("p"), get("units"), E(0x6a), set("p"), get("o"), get("units"), E(0x6a), set("o"), i32(0), set("units"));
  br("value");
  end();
  end();
  // one character
  (get("p"), load8(0), set("c"));
  (get("c"), i32(0x80), E(0x49), iff()); // ASCII
  (add("p", 1), sub("units", 1));
  (get("c"), i32(38), E(0x46), iff(), entity(0x706d6126, 0x3b, 1, 5)); // &amp;
  (els(), get("c"), i32(60), E(0x46), iff(), literal(0x3b746c26)); // &lt;
  (els(), get("c"), i32(62), E(0x46), iff(), literal(0x3b746726)); // &gt;
  (els(), get("kind"), iff());
  (get("c"), i32(34), E(0x46), iff(), entity(0x6f757126, 0x3b74, 2, 6)); // &quot;
  (els(), get("c"), i32(39), E(0x46), iff(), entity(0x39332326, 0x3b, 1, 5)); // &#39;
  (els(), byte(), end(), end());
  (els(), byte());
  end();
  (end(), end(), end());
  els();
  // multi-byte UTF-8 sequence: 4 bytes = 2 UTF-16 units, else 1
  (get("c"), i32(0xf0), E(0x4f), iff());
  (get("o"), get("p"), load(0), store(0), add("p", 4), add("o", 4), sub("units", 2));
  (els(), get("c"), i32(0xe0), E(0x4f), iff());
  (get("o"), get("p"), load16(0), store16(0), get("o"), get("p"), load8(2), store8(2), add("p", 3), add("o", 3), sub("units", 1));
  els();
  (get("o"), get("p"), load16(0), store16(0), add("p", 2), add("o", 2), sub("units", 1));
  end();
  end();
  end();
  br("units");
  end();
  end(); // value
  (add("k", 1), add("fe", 12), br("slots"));
  (end(), end());
  (add("r", 1), br("rows"));
  (end(), end());
  (get("o"), E(0x0b));
  if (labels.length) throw new Error("unbalanced blocks");

  const body = [0x03, 9, 0x7f, 1, 0x7b, 3, 0x7f, ...code];
  const section = (id, bytes) => [id, ...uleb(bytes.length), ...bytes];
  const name = (text) => [...uleb(text.length), ...Buffer.from(text)];
  return new Uint8Array([
    ...[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    ...section(1, [1, 0x60, 6, ...Array(6).fill(0x7f), 1, 0x7f]), // (i32 × 6) → i32
    ...section(2, [1, ...name("e"), ...name("mem"), 0x02, 0x00, LAYOUT.pages]), // import memory, min pages
    ...section(3, [1, 0]),
    ...section(7, [1, ...name("emit"), 0x00, 0]),
    ...section(10, [1, ...uleb(body.length), ...body]),
  ]);
}

const bytes = assemble();
const out = new URL("../libs/runtime/server-rows-wasm.ts", import.meta.url);
const text = `// Generated by scripts/gen-row-wasm.mjs. Do not edit.
/** The list-row emitter module (${bytes.length} bytes, WebAssembly + SIMD), base64. */
export const ROWS_WASM =
  "${Buffer.from(bytes).toString("base64")}";
/** Memory layout shared with the module (byte offsets; \`pages\` × 64 KiB, fixed). */
export const ROWS_LAYOUT = ${JSON.stringify(LAYOUT)
  .replace(/"(\w+)":/g, "$1: ")
  .replace(/,/g, ", ")
  .replace("{", "{ ")
  .replace("}", " }")};
`;
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {}
  if (current !== text) {
    console.error("libs/runtime/server-rows-wasm.ts is stale: run node scripts/gen-row-wasm.mjs");
    process.exit(1);
  }
  console.log("row wasm: up to date");
} else {
  writeFileSync(out, text);
  console.log(`wrote libs/runtime/server-rows-wasm.ts (${bytes.length} bytes)`);
}
