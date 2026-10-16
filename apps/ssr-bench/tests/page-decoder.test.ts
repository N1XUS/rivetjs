import { test } from "vitest";
import assert from "node:assert/strict";
import protoLoader from "@grpc/proto-loader";
import { decodePage } from "../services/page-decoder.ts";

const definition = protoLoader.loadSync(new URL("../proto/content.proto", import.meta.url).pathname, { defaults: true, arrays: true });
const method = (definition["rivet.bench.Content"] as protoLoader.ServiceDefinition).GetPage!;
type Loaded = { rows: { id: number; values: unknown[]; textValues: string[] }[] };
/** proto-loader keeps `textValues` separate; the static decoder folds the escaping variant's text values into `values`. */
const expected = (bytes: Buffer) => {
  const page = method.responseDeserialize(bytes) as Loaded;
  return { ...page, rows: page.rows.map(({ id, values, textValues }) => ({ id, values: textValues.length ? textValues : values })) };
};

function page(rows: number, seed: number) {
  let state = seed;
  const next = () => (state = (Math.imul(state, 1103515245) + 12345) | 0);
  return {
    token: "tok<>&\"'😀",
    title: seed % 2 ? "Title 😀 & <b>" : "",
    markdown: seed % 3 ? "# md\n\nü" : "",
    rows: Array.from({ length: rows }, (_, id) => ({ id: id % 7 ? id : -id, values: Array.from({ length: id % 4 ? 10 : 0 }, () => next()) })),
  };
}

test("static Page decoder matches proto-loader output, including defaults, negatives and unicode", () => {
  for (const [rows, seed] of [
    [0, 1],
    [1, 2],
    [3, 3],
    [1000, 4],
    [5000, 6],
  ] as const) {
    const bytes = method.responseSerialize(page(rows, seed));
    assert.deepEqual(decodePage(bytes), expected(bytes));
  }
});

test("static Page decoder accepts unpacked repeated values and skips unknown fields", () => {
  // Row { id: 5 (field 1), values: 7 unpacked (field 2 varint), values: -1 unpacked, unknown field 9 (fixed32), unknown field 10 (fixed64) }
  const row = Buffer.from([
    0x08, 0x05, 0x10, 0x07, 0x10, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x4d, 1, 2, 3, 4, 0x51, 1, 2, 3, 4, 5, 6, 7, 8,
  ]);
  // Page { unknown field 15 (bytes len 2), rows: row, token: "t" }
  const bytes = Buffer.concat([Buffer.from([0x7a, 0x02, 0x61, 0x62, 0x22, row.length]), row, Buffer.from([0x0a, 0x01, 0x74])]);
  assert.deepEqual(decodePage(bytes), expected(bytes));
  assert.deepEqual(decodePage(bytes).rows[0].values, [7, -1]);
});

test("static Page decoder folds the escaping variant's text values into values", () => {
  const texts = ["<b>\"3\"</b> & 'é€漢字𝄞'", "", "42"];
  const bytes = method.responseSerialize({ token: "t", title: "", markdown: "", rows: [{ id: 1, values: [], textValues: texts }] });
  assert.deepEqual(decodePage(bytes).rows[0].values, texts);
  assert.deepEqual(decodePage(bytes), expected(bytes));
});

test("static Page decoder rejects truncated input", () => {
  const bytes = method.responseSerialize(page(3, 3));
  assert.throws(() => decodePage(bytes.subarray(0, bytes.length - 3)), RangeError);
});
