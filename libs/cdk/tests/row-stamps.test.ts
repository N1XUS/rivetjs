// Row stamps (ROW-RERENDER): the server baseline of built-collection rows a resumed page re-checks (`collections/row-stamps.ts`).
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { ItemNode, SectionNode } from "../collections/base.ts";
import { STAMP, rowKey, stamp, stampSet } from "../collections/row-stamps.ts";
import { TableColumnNode } from "../table/collection.ts";
import type { Key } from "../collections/types.ts";

const item = (key: Key, fields: Record<string, unknown>) => Object.assign(new ItemNode<unknown>(key), fields);

describe("row stamps", () => {
  it("4 JSON / HTML-safe characters, deterministic", () => {
    const s = stamp(item("a", { textValue: "Apple", value: { id: "a", name: "Apple" } }));
    assert.equal(s.length, STAMP);
    assert.match(s, /^[A-Za-z0-9_-]{4}$/);
    assert.equal(stamp(item("a", { textValue: "Apple", value: { id: "a", name: "Apple" } })), s);
  });

  it("equal data in new objects stamps the same; a changed value, text, key, prop or type does not", () => {
    const base = () => item(2, { textValue: "Kangaroo", value: { id: 2, name: "Kangaroo" }, props: { id: 2, class: "row" } });
    const s = stamp(base());
    assert.equal(stamp(base()), s);
    assert.notEqual(stamp(Object.assign(base(), { value: { id: 2, name: "KANGAROO" } })), s);
    assert.notEqual(stamp(Object.assign(base(), { textValue: "KANGAROO" })), s);
    assert.notEqual(stamp(Object.assign(base(), { props: { id: 2, class: "row selected" } })), s);
    assert.notEqual(
      stamp(Object.assign(new ItemNode<unknown>("2"), { textValue: "Kangaroo", value: { id: 2, name: "Kangaroo" }, props: { id: 2, class: "row" } })),
      s,
      "number vs string key",
    );
    assert.notEqual(
      stamp(Object.assign(new SectionNode<unknown>(2), { textValue: "Kangaroo", value: { id: 2, name: "Kangaroo" }, props: { id: 2, class: "row" } })),
      s,
    );
  });

  it("functions count by kind only (the server and the browser compile them differently)", () => {
    const a = stamp(item("a", { rendered: () => "x", props: { children: (x: number) => x, onAction: () => {} } }));
    assert.equal(stamp(item("a", { rendered: function other() {}, props: { children: () => 0, onAction: () => 1 } })), a);
  });

  it("nested data counts to a depth; class instances by kind", () => {
    class Point {
      x: number;
      constructor(x: number) {
        this.x = x;
      }
    }
    const s = stamp(item("a", { value: { p: new Point(1), tags: ["a", "b"], at: new Date(0) } }));
    assert.equal(stamp(item("a", { value: { p: new Point(2), tags: ["a", "b"], at: new Date(0) } })), s);
    assert.notEqual(stamp(item("a", { value: { p: new Point(1), tags: ["a", "c"], at: new Date(0) } })), s);
    assert.notEqual(stamp(item("a", { value: { p: new Point(1), tags: ["a", "b"], at: new Date(1) } })), s);
  });

  it("liveProps are skipped (a live column width keeps the row)", () => {
    const col = (width: number) => Object.assign(new TableColumnNode("c"), { textValue: "Name", props: { width, isRowHeader: true } });
    assert.equal(stamp(col(100)), stamp(col(200)));
  });

  it("a row stamp covers the nodes it renders (a section's items, a row's cells)", () => {
    const section = Object.assign(new SectionNode<unknown>("veg"), { textValue: "" });
    const s = stamp(section, [item("leek", { textValue: "Leek" }), item("kale", { textValue: "Kale" })]);
    assert.equal(stamp(section, [item("leek", { textValue: "Leek" }), item("kale", { textValue: "Kale" })]), s);
    assert.notEqual(stamp(section, [item("leek", { textValue: "Leek" }), item("kale", { textValue: "KALE" })]), s);
    assert.notEqual(stamp(section, [item("leek", { textValue: "Leek" })]), s);
  });

  it("stampSet splits a baseline; rowKey unboxes a re-created row's key", () => {
    const a = stamp(item("a", {})),
      b = stamp(item("b", {}));
    assert.deepEqual([...stampSet(a + b)], [a, b]);
    assert.equal(rowKey("a"), "a");
    assert.equal(rowKey(0), 0);
    assert.equal(rowKey({ k: 3 }), 3);
  });
});
