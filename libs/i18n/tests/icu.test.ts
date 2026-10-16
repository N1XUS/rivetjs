import { test } from "vitest";
import assert from "node:assert/strict";
import { parseMessage, paramsOf, I18nError } from "../icu.ts";

test("plain text stays a string", () => {
  assert.equal(parseMessage("Hello world", "en:a"), "Hello world");
});
test("argument interpolation", () => {
  assert.deepEqual(parseMessage("Hi {name}!", "en:a"), [{ t: "Hi " }, { a: "name" }, { t: "!" }]);
});
test("plural with # and exact match", () => {
  assert.deepEqual(parseMessage("{n, plural, =0 {none} one {# item} other {# items}}", "en:a"), [
    {
      p: "n",
      cases: { "=0": [{ t: "none" }], one: [{ n: "n" }, { t: " item" }], other: [{ n: "n" }, { t: " items" }] },
    },
  ]);
});
test("selectordinal marks ord", () => {
  const v = parseMessage("{n, selectordinal, one {#st} other {#th}}", "en:a") as { p: string; ord?: true }[];
  assert.equal(v[0]!.ord, true);
});
test("select, number, date, tags", () => {
  assert.deepEqual(parseMessage("{g, select, f {she} other {they}}", "en:a"), [
    { s: "g", cases: { f: [{ t: "she" }], other: [{ t: "they" }] } },
  ]);
  assert.deepEqual(parseMessage("{x, number, percent}", "en:a"), [{ n: "x", f: { style: "percent" } }]);
  assert.deepEqual(parseMessage("{d, date, short}", "en:a"), [{ d: "d", f: { dateStyle: "short" } }]);
  assert.deepEqual(parseMessage("{d, time, short}", "en:a"), [{ d: "d", f: { timeStyle: "short" } }]);
  assert.deepEqual(parseMessage("Read <b>this</b>", "en:a"), [{ t: "Read " }, { tag: "b", c: [{ t: "this" }] }]);
});
test("number skeleton", () => {
  assert.deepEqual(parseMessage("{x, number, ::currency/EUR}", "en:a"), [
    { n: "x", f: { style: "currency", currency: "EUR" } },
  ]);
});
test("plural without other is an error naming the location", () => {
  assert.throws(
    () => parseMessage("{n, plural, one {x}}", "de:cart.count"),
    (e: unknown) => e instanceof I18nError && /de:cart\.count/.test((e as Error).message),
  );
});
test("syntax error names the location", () => {
  assert.throws(
    () => parseMessage("{n, plural,", "de:x"),
    (e: unknown) => e instanceof I18nError && /de:x/.test(String(e)),
  );
});
test("paramsOf collects kinds", () => {
  const kinds = paramsOf(parseMessage("{n, plural, other {# by {name}}} <b>x</b> {d, date}", "en:a"));
  assert.deepEqual([...kinds].sort(), [
    ["b", "tag"],
    ["d", "date"],
    ["n", "number"],
    ["name", "string"],
  ]);
});
