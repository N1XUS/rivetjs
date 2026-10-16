import { test } from "vitest";
import assert from "node:assert/strict";
import { byPattern, canonicalName, getAt, idSafe, matchesPattern, parsePath } from "../path.ts";
import { decodeFormData, FormDecodeError, rawValues } from "../decode.ts";

const fd = (pairs: [string, string | File][]) => {
  const data = new FormData();
  for (const [name, value] of pairs) data.append(name, value);
  return data;
};

test("paths: dotted and bracket names, append marker, forbidden segments", () => {
  assert.deepEqual(parsePath("email"), ["email"]);
  assert.deepEqual(parsePath("items.0.qty"), ["items", "0", "qty"]);
  assert.deepEqual(parsePath("items[0][qty]"), ["items", "0", "qty"]);
  assert.deepEqual(parsePath("items[0].qty"), ["items", "0", "qty"]);
  assert.deepEqual(parsePath("tags[]"), ["tags", ""]);
  for (const bad of ["", "a..b", "a.", ".a", "a[0", "__proto__.x", "a.constructor", "a[prototype]", "a[].b"]) assert.equal(parsePath(bad), null, bad);
  assert.equal(canonicalName("items[2][sku]"), "items.2.sku");
  assert.equal(canonicalName("tags[]"), null);
  assert.equal(matchesPattern("items.$.qty", "items.12.qty"), true);
  assert.equal(matchesPattern("items.$.qty", "items.x.qty"), false);
  assert.equal(matchesPattern("items.$.qty", "items.1.sku"), false);
  assert.equal(byPattern({ "items.$.qty": "number", email: "string" }, "items.3.qty"), "number");
  assert.equal(byPattern({ email: "string" }, "name"), undefined);
  assert.equal(getAt({ a: { b: [1, { c: 2 }] } }, "a.b.1.c"), 2);
  assert.equal(getAt({ a: 1 }, "a.__proto__"), undefined);
  assert.equal(idSafe("items.0.qty"), "items-0-qty");
});

test("decode: nesting, arrays, coercion table, empty strings", () => {
  const out = decodeFormData(
    fd([
      ["email", "a@b.c"],
      ["nick", ""],
      ["age", "42"],
      ["height", "tall"],
      ["blank", ""],
      ["agree", "on"],
      ["tags", "x"],
      ["tags", "y"],
      ["address.city", "Kyiv"],
      ["address.zip", "01001"],
      ["items.1.sku", "B"],
      ["items.1.qty", "2"],
      ["items.0.sku", "A"],
      ["items.0.qty", "1"],
      ["born", "2000-01-02"],
      ["meta", '{"a":1}'],
      ["bracket[0][x]", "1"],
      ["list[]", "p"],
      ["list[]", "q"],
      ["_form", "signup"],
      ["_intent", "insert:items"],
      ["_csrf", "t"],
    ]),
    { coerce: { age: "number", height: "number", blank: "number", agree: "boolean", tags: "array", "items.$.qty": "number", born: "date", meta: "json", off: "boolean", none: "array" } },
  );
  assert.deepEqual(out, {
    email: "a@b.c",
    age: 42,
    height: "tall",
    agree: true,
    tags: ["x", "y"],
    address: { city: "Kyiv", zip: "01001" },
    items: [
      { sku: "A", qty: 1 },
      { sku: "B", qty: 2 },
    ],
    born: new Date("2000-01-02"),
    meta: { a: 1 },
    bracket: [{ x: "1" }],
    list: ["p", "q"],
    off: false,
    none: [],
  });
  assert.equal("nick" in out, false);
  assert.deepEqual(decodeFormData(fd([["nick", ""]]), { emptyAs: "string" }), { nick: "" });
  // Single repeated-key field still an array; last scalar wins.
  assert.deepEqual(decodeFormData(fd([["tags", "only"], ["name", "a"], ["name", "b"]]), { coerce: { tags: "array" } }), { tags: ["only"], name: "b" });
  // Sparse indices compact in order.
  assert.deepEqual(decodeFormData(fd([["rows.900.v", "z"], ["rows.3.v", "a"]])), { rows: [{ v: "a" }, { v: "z" }] });
  // Wildcard booleans default inside existing rows only.
  assert.deepEqual(decodeFormData(fd([["items.0.sku", "A"]]), { coerce: { "items.$.done": "boolean" } }), { items: [{ sku: "A", done: false }] });
});

test("decode: files (empty file = absent) and raw values for echo", () => {
  const avatar = new File(["png"], "a.png", { type: "image/png" });
  const empty = new File([], "", { type: "application/octet-stream" });
  const out = decodeFormData(fd([["avatar", avatar], ["cover", empty], ["note", "x"]]), { coerce: { avatar: "file", cover: "file" } });
  assert.equal(out.avatar, avatar);
  assert.equal("cover" in out, false);
  const raw = rawValues(fd([["email", "a"], ["password", "p"], ["tags", "x"], ["tags", "y"], ["avatar", avatar], ["items[0][sku]", "A"], ["_form", "f"]]), (name) => name !== "password");
  assert.deepEqual(raw, { email: "a", tags: ["x", "y"], "items.0.sku": "A" });
});

test("decode hardening: prototype keys, depth, index, field count and key length", () => {
  const rejects = (pairs: [string, string][], pattern: RegExp, limits = {}) => assert.throws(() => decodeFormData(fd(pairs), { limits }), (error: unknown) => error instanceof FormDecodeError && pattern.test(error.message));
  rejects([["__proto__.polluted", "1"]], /Invalid form field name/);
  rejects([["a.constructor.prototype.x", "1"]], /Invalid form field name/);
  rejects([["a.b.c.d.e.f.g.h.i", "1"]], /nested too deep/);
  rejects([["rows.1001", "1"]], /index too large/);
  rejects([["rows.5", "1"]], /index too large/, { index: 4 });
  rejects([["a", "1"], ["b", "2"], ["c", "3"]], /Too many form fields/, { fields: 2 });
  rejects([["x".repeat(300), "1"]], /name too long/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  // Meta fields do not count and never decode.
  assert.deepEqual(decodeFormData(fd([["_form", "f"], ["a", "1"]]), { limits: { fields: 1 } }), { a: "1" });
});
