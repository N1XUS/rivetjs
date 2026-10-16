// Collection builders and collections: react-stately (CollectionBuilder / ListCollection /
// TreeCollection / GridCollection / TableCollection) and react-aria-components (BaseCollection,
// CollectionBuilder.test.js ported to buildCollection), plus DOM-as-collection.
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { CollectionBuilder, Item, Section, createCollection } from "../collections/builder.ts";
import { compareNodeOrder, getChildNodes, getFirstItem, getItemCount, getLastItem, getNthItem } from "../collections/nodes.ts";
import { ListCollection } from "../collections/list.ts";
import { TreeCollection } from "../collections/tree.ts";
import { GridCollection } from "../collections/grid.ts";
import { Cell, Column, Row, TableBody, TableCollection, TableHeader, ariaSort, nextSortDescriptor, tableBuilderContext, ROW_HEADER_COLUMN_KEY } from "../collections/table.ts";
import { BaseCollection, ItemNode, buildCollection } from "../collections/base.ts";
import { domCollection, domKey, keyAttrs, getItemElement } from "../collections/dom.ts";
import type { Node } from "../collections/types.ts";

const build = <T extends object>(props: Parameters<CollectionBuilder<T>["build"]>[0], context?: unknown) => new ListCollection<T>(new CollectionBuilder<T>().build(props, context));

describe("CollectionBuilder (react-stately)", () => {
  it("static items: keys, textValue, rendered, index", () => {
    const c = build({ children: [Item({ key: "a", children: "Apple" }), Item({ key: "b", children: "Banana", textValue: "B" })] });
    assert.deepEqual([...c.getKeys()], ["a", "b"]);
    const a = c.getItem("a")!;
    assert.equal(a.type, "item");
    assert.equal(a.textValue, "Apple");
    assert.equal(a.rendered, "Apple");
    assert.equal(c.getItem("b")!.textValue, "B");
    assert.equal(c.getItem("b")!.index, 1);
    assert.equal(c.size, 2);
  });

  it("missing keys fall back to $.index; dynamic items use item.key / item.id", () => {
    const c = build({ children: [Item({ children: "One" }), Item({ children: "Two" })] });
    assert.deepEqual([...c.getKeys()], ["$.0", "$.1"]);
    const d = build({ items: [{ id: 1, name: "x" }, { key: "k", name: "y" }], children: (item: any) => Item({ children: item.name }) });
    assert.deepEqual([...d.getKeys()], [1, "k"]);
    assert.equal(d.getItem(1)!.value!.name, "x");
    assert.throws(() => build({ items: [{ name: "nokey" }], children: (item: any) => Item({ children: item.name }) }), /No key found for item/);
    assert.throws(() => build({ children: ((item: any) => Item({ children: item })) as any }), /props.items is missing/);
  });

  it("sections: section nodes, child items, levels, getItemCount", () => {
    const c = build({
      children: [
        Section({ key: "s1", title: "Fruit", children: [Item({ key: "a", children: "Apple" }), Item({ key: "b", children: "Banana" })] }),
        Section({ key: "s2", title: "Veg", items: [{ id: "c", name: "Carrot" }], children: (item: any) => Item({ children: item.name }) }),
      ],
    });
    assert.deepEqual([...c.getKeys()], ["s1", "a", "b", "s2", "c"]);
    const s1 = c.getItem("s1")!;
    assert.equal(s1.type, "section");
    assert.equal(s1.rendered, "Fruit");
    assert.deepEqual([...getChildNodes(s1, c)].map((n) => n.key), ["a", "b"]);
    assert.equal(c.getItem("a")!.parentKey, "s1");
    assert.equal(c.getItem("a")!.level, 0, "items in sections stay at level 0");
    assert.equal(c.getKeyAfter("b"), "s2");
    assert.equal(c.getKeyBefore("s2"), "b");
    assert.equal(getItemCount(c), 3);
    assert.equal(c.size, 5, "sections count towards size");
  });

  it("nested items (title + child Items / childItems): element keys kept, level + 1", () => {
    const nodes = [...new CollectionBuilder<any>().build({
      children: [Item({ key: "p", title: "Parent", children: [Item({ key: "c1", children: "Child" })] })],
    })];
    const p = nodes[0]!;
    assert.equal(p.hasChildNodes, true);
    const kids = [...p.childNodes];
    assert.equal(kids[0]!.key, "c1");
    assert.equal(kids[0]!.level, 1);
    assert.equal(kids[0]!.parentKey, "p");
    const dyn = [...new CollectionBuilder<any>().build({
      items: [{ id: "x", name: "X", kids: [{ id: "y", name: "Y" }] }],
      children: (item: any) => Item({ key: item.id, title: item.name, childItems: item.kids, children: item.name }),
    })];
    assert.equal(dyn[0]!.hasChildNodes, true);
    assert.equal([...dyn[0]!.childNodes][0]!.key, "y");
  });

  it("caches nodes by value and honours shouldInvalidate", () => {
    const builder = new CollectionBuilder<any>();
    const items = [{ id: 1, name: "a" }];
    const renderer = (item: any) => Item({ children: item.name });
    const first = [...builder.build({ items, children: renderer })][0];
    const second = [...builder.build({ items, children: renderer })][0];
    assert.equal(first, second, "same value → cached node");
  });

  it("type constraints: a section inside an item-only slot throws", () => {
    assert.throws(
      () => [...new CollectionBuilder<any>().build({ children: [Section({ key: "s", children: [Section({ key: "t", children: [] })] })] })].forEach((n) => [...n.childNodes]),
      /Unsupported type <Section> in <Section>/,
    );
  });

  it("createCollection: uses props.collection when given", () => {
    const pre = new ListCollection<any>([]);
    assert.equal(createCollection({ collection: pre }, () => { throw new Error("unused"); }), pre);
    const made = createCollection<any>({ children: [Item({ key: "a", children: "A" })] }, (nodes) => new ListCollection(nodes));
    assert.equal(made.getFirstKey(), "a");
  });
});

describe("getChildNodes helpers", () => {
  it("getFirstItem / getLastItem / getNthItem / compareNodeOrder", () => {
    assert.equal(getFirstItem([1, 2, 3]), 1);
    assert.equal(getLastItem([1, 2, 3]), 3);
    assert.equal(getNthItem([1, 2, 3], 1), 2);
    assert.equal(getNthItem([1, 2, 3], -1), undefined);
    const c = build({ children: [Section({ key: "s1", children: [Item({ key: "a", children: "A" })] }), Section({ key: "s2", children: [Item({ key: "b", children: "B" })] })] });
    const a = c.getItem("a")!, b = c.getItem("b")!, s1 = c.getItem("s1")!;
    assert.ok(compareNodeOrder(c, a, b) < 0);
    assert.ok(compareNodeOrder(c, b, a) > 0);
    assert.ok(compareNodeOrder(c, a, s1) > 0, "descendant after ancestor");
    assert.ok(compareNodeOrder(c, s1, a) < 0);
  });
});

describe("ListCollection", () => {
  it("links keys across sections, at(), getChildren, first/last", () => {
    const c = build({ children: [Item({ key: "x", children: "X" }), Section({ key: "s", children: [Item({ key: "y", children: "Y" })] })] });
    assert.equal(c.getFirstKey(), "x");
    assert.equal(c.getLastKey(), "y");
    assert.equal(c.at(1)!.key, "s");
    assert.equal(c.getKeyAfter("y"), null);
    assert.equal(c.getKeyBefore("x"), null);
    assert.deepEqual([...c.getChildren("s")].map((n) => n.key), ["y"]);
    assert.deepEqual([...c.getChildren("missing")], []);
    assert.equal(c.getItem("y")!.index, 1, "item index counts items only");
  });
});

describe("TreeCollection", () => {
  const tree = () =>
    new CollectionBuilder<any>().build({
      items: [
        { id: "animals", name: "Animals", children: [{ id: "aardvark", name: "Aardvark" }, { id: "bear", name: "Bear", children: [{ id: "black", name: "Black Bear" }] }] },
        { id: "plants", name: "Plants", children: [] },
      ],
      children: (item: any) => Item({ key: item.id, title: item.name, childItems: item.children, hasChildItems: !!item.children?.length, children: item.name }),
    });

  it("only expanded items contribute children (useTreeState keyboard story order)", () => {
    let c = new TreeCollection(tree(), { expandedKeys: new Set() });
    assert.deepEqual([...c.getKeys()], ["animals", "plants"]);
    c = new TreeCollection(tree(), { expandedKeys: new Set(["animals"]) });
    assert.deepEqual([...c.getKeys()], ["animals", "aardvark", "bear", "plants"]);
    c = new TreeCollection(tree(), { expandedKeys: new Set(["animals", "bear"]) });
    assert.deepEqual([...c.getKeys()], ["animals", "aardvark", "bear", "black", "plants"]);
    assert.equal(c.getKeyAfter("bear"), "black");
    assert.equal(c.getItem("black")!.level, 2);
    assert.equal(c.size, 5);
    assert.equal(c.at(3)!.key, "black");
  });
});

describe("GridCollection", () => {
  it("rows, cells, colSpan / colIndex, prev/next links", () => {
    const cell = (key: string, index: number, colSpan?: number): Node<unknown> => ({
      type: "cell", key, value: null, level: 1, hasChildNodes: false, childNodes: [], rendered: key, textValue: key, index, props: colSpan ? { colSpan } : {},
    });
    const g = new GridCollection<unknown>({
      columnCount: 3,
      items: [
        { type: "item", key: "r1", childNodes: [cell("a", 0, 2), cell("b", 1)] },
        { type: "item", key: "r2", childNodes: [cell("c", 0), cell("d", 1), cell("e", 2)] },
      ],
    });
    assert.equal(g.size, 2);
    assert.equal(g.getFirstKey(), "r1");
    assert.equal(g.getLastKey(), "r2");
    assert.equal(g.getKeyAfter("r1"), "r2");
    assert.equal(g.getItem("b")!.colIndex, 2, "after a colSpan 2 cell");
    assert.equal(g.getItem("a")!.colSpan, 2);
    assert.equal(g.getItem("b")!.parentKey, "r1");
    assert.equal(g.getKeyAfter("a"), "b");
    assert.equal(g.getItem("d")!.colIndex, undefined, "rows without colSpan keep colIndex unset");
    assert.deepEqual([...g.getChildren("r2")].map((n) => n.key), ["c", "d", "e"]);
  });
});

describe("TableCollection", () => {
  const columns = [
    { name: "Name", key: "name", isRowHeader: true },
    { name: "Type", key: "type" },
  ];
  const rows = [
    { id: 1, name: "Charizard", type: "Fire" },
    { id: 2, name: "Blastoise", type: "Water" },
  ];
  const table = (opts: { showSelectionCheckboxes?: boolean; selectionMode?: "none" | "single" | "multiple" } = {}) => {
    const context = tableBuilderContext<any>(opts);
    const nodes = new CollectionBuilder<any>().build(
      {
        children: [
          TableHeader({ columns, children: (column: any) => Column({ key: column.key, isRowHeader: column.isRowHeader, children: column.name }) }),
          TableBody({ items: rows, children: (item: any) => Row({ key: item.id, children: (columnKey) => Cell({ children: item[columnKey] }) }) }),
        ],
      },
      context,
    );
    return new TableCollection<any>(nodes as Iterable<any>, null, context);
  };

  it("columns, header rows, body rows, cells keyed by row + (row + column) as react-stately does, row header text", () => {
    const t = table();
    assert.deepEqual(t.columns.map((c) => c.key), ["name", "type"]);
    assert.equal(t.headerRows.length, 1);
    assert.equal(t.columnCount, 2);
    assert.equal(t.size, 2);
    assert.equal(t.getFirstKey(), 1);
    assert.equal(t.getLastKey(), 2);
    assert.deepEqual([...t.rowHeaderColumnKeys], ["name"]);
    const cells = [...t.getChildren(1)];
    assert.deepEqual(cells.map((c) => c.key), ["11name", "11type"]);
    assert.equal(cells[0]!.column!.key, "name");
    assert.equal(t.getTextValue(1), "Charizard");
    assert.deepEqual([...t].map((r) => r.key), [1, 2]);
    assert.equal(t.getItem(t.body.key), t.body);
  });

  it("selection checkbox column + cell; default row header skips it", () => {
    const t = table({ showSelectionCheckboxes: true, selectionMode: "multiple" });
    assert.equal(t.columns[0]!.key, ROW_HEADER_COLUMN_KEY);
    assert.equal(t.columns[0]!.props.isSelectionCell, true);
    assert.deepEqual([...t.getChildren(1)].map((c) => c.key), ["1header", "11name", "11type"]);
    assert.deepEqual([...t.rowHeaderColumnKeys], ["name"]);
  });

  it("nested columns build tiered header rows with colSpans and placeholders", () => {
    const context = tableBuilderContext<any>();
    const nodes = new CollectionBuilder<any>().build(
      {
        children: [
          TableHeader({
            children: [
              Column({ key: "name", isRowHeader: true, children: "Name" }),
              Column({ key: "info", title: "Info", children: [Column({ key: "type", children: "Type" }), Column({ key: "level", children: "Level" })] }),
            ],
          }),
          TableBody({ children: [Row({ key: "r", children: [Cell({ children: "A" }), Cell({ children: "B" }), Cell({ children: "C" })] })] }),
        ],
      },
      context,
    );
    const t = new TableCollection<any>(nodes as Iterable<any>, null, context);
    assert.equal(t.headerRows.length, 2);
    const top = [...t.headerRows[0]!.childNodes] as any[];
    assert.deepEqual(top.map((n) => n.type), ["placeholder", "column"]);
    assert.equal(top[1].colSpan, 2);
    const bottom = [...t.headerRows[1]!.childNodes] as any[];
    assert.deepEqual(bottom.map((n) => n.key), ["name", "type", "level"]);
    assert.equal(bottom[1].parentKey, "info");
    assert.throws(
      () =>
        new TableCollection<any>(
          new CollectionBuilder<any>().build(
            { children: [TableHeader({ children: [Column({ key: "a", children: "A" })] }), TableBody({ children: [Row({ key: "r", children: [Cell({ children: "1" }), Cell({ children: "2" })] })] })] },
            tableBuilderContext<any>(),
          ) as Iterable<any>,
        ),
      /Cell count must match column count/,
    );
  });

  it("sort descriptors (useTableState.sort) and aria-sort", () => {
    assert.deepEqual(nextSortDescriptor(null, "name"), { column: "name", direction: "ascending" });
    assert.deepEqual(nextSortDescriptor({ column: "name", direction: "ascending" }, "name"), { column: "name", direction: "descending" });
    assert.deepEqual(nextSortDescriptor({ column: "name", direction: "descending" }, "name"), { column: "name", direction: "ascending" });
    assert.deepEqual(nextSortDescriptor({ column: "name", direction: "descending" }, "type"), { column: "type", direction: "ascending" });
    assert.deepEqual(nextSortDescriptor(null, "type", "descending"), { column: "type", direction: "descending" });
    assert.equal(ariaSort({ column: "name", direction: "descending" }, "name"), "descending");
    assert.equal(ariaSort({ column: "name", direction: "descending" }, "type"), "none");
    assert.equal(ariaSort(null, "type", false), undefined);
  });
});

describe("BaseCollection / buildCollection (react-aria CollectionBuilder.test.js)", () => {
  it("should be frozen even in case of empty initial collection", () => {
    const c = buildCollection([]);
    assert.equal(c.isFrozen, true);
    assert.equal(c.getFirstKey(), null);
    assert.equal(c.getLastKey(), null);
  });

  it("should throw when two items share a key", () => {
    assert.throws(() => buildCollection([{ id: "a" }, { id: "a" }, { id: "b" }]), {
      message: 'Duplicate key "a" found in collection. Every item in a collection must have a unique key.',
    });
    assert.throws(() => buildCollection([{ id: "a" }, { id: "x" }, { id: "a" }]), /Duplicate key "a" found in collection\./);
  });

  it("should allow a new item to reuse the key of an item removed (rebuild)", () => {
    assert.deepEqual([...buildCollection([{ id: "a" }, { id: "b" }]).getKeys()], ["a", "b"]);
    assert.deepEqual([...buildCollection([{ id: "a" }, { id: "c" }, { id: "b" }]).getKeys()], ["a", "c", "b"]);
    assert.deepEqual([...buildCollection([{ id: "a" }]).getKeys()], ["a"]);
  });

  it("should still support using strings for the collection node class", () => {
    const c = buildCollection([{ type: "section", children: [{ type: "item" }] }]) as any;
    assert.equal(c.isFrozen, true);
    assert.equal(c.getFirstKey(), "rivet-2");
    assert.equal(c.keyMap.get("rivet-2").type, "section");
    assert.equal(c.keyMap.get("rivet-2").firstChildKey, "rivet-1");
    assert.equal(c.keyMap.get("rivet-1").type, "item");
    assert.ok(c.keyMap.get("rivet-1") instanceof ItemNode);
  });

  it("sections: getKeyAfter descends, getKeyBefore ascends, getLastKey is the deepest last child", () => {
    const c = buildCollection([
      { id: "s1", type: "section", children: [{ id: "h", type: "header", textValue: "Fruit" }, { id: "a", textValue: "Apple" }] },
      { id: "s2", type: "section", children: [{ id: "b", textValue: "Banana" }, { id: "c", textValue: "Cherry", hidden: true }] },
    ]);
    assert.equal(c.size, 2, "size counts items");
    assert.equal(c.getKeyAfter("s1"), "h");
    assert.equal(c.getKeyAfter("a"), "s2");
    assert.equal(c.getKeyBefore("s2"), "a");
    assert.equal(c.getKeyBefore("h"), "s1");
    assert.equal(c.getLastKey(), "b", "hidden nodes are left out");
    assert.equal(c.getItem("a")!.index, 1);
    assert.equal(c.getItem("a")!.parentKey, "s1");
    assert.deepEqual([...c].map((n) => n.key), ["s1", "s2"]);
    assert.deepEqual([...c.getChildren("s2")].map((n) => n.key), ["b"]);
  });

  it("filter: items by text, sections without items and trailing separators dropped", () => {
    const c = buildCollection([
      { id: "s1", type: "section", children: [{ id: "h1", type: "header" }, { id: "apple", textValue: "Apple" }, { id: "avocado", textValue: "Avocado" }] },
      { id: "sep", type: "separator" },
      { id: "s2", type: "section", children: [{ id: "h2", type: "header" }, { id: "banana", textValue: "Banana" }] },
    ]);
    const f = c.filter((text) => text.toLowerCase().startsWith("a"));
    assert.deepEqual([...f].map((n) => n.key), ["s1"], "s2 has only its header left; the then-trailing separator is dropped");
    assert.deepEqual([...f.getChildren("s1")].map((n) => n.key), ["h1", "apple", "avocado"]);
    assert.equal(f.getLastKey(), "avocado");
    assert.equal(f.size, 2);
    assert.ok(f instanceof BaseCollection);
  });

  it("nested items: level increments under items, colIndex follows colSpan", () => {
    const c = buildCollection([{ id: "row", children: [{ id: "c1", type: "cell", props: { colSpan: 2 } }, { id: "c2", type: "cell" }] }]);
    assert.equal(c.getItem("c1")!.level, 1);
    assert.equal((c.getItem("c2") as any).colIndex, 2);
  });
});

describe("DOM as collection", () => {
  const window = new Window();
  const document = window.document;

  it("domCollection: keys (typed), types by role, text, disabled, href, sections, hidden", () => {
    document.body.innerHTML = `
      <div id="list" role="listbox">
        <div role="group" data-key="g1">
          <div role="presentation" data-key="h1">Fruit</div>
          <div role="option" data-key="1" data-key-type="number">Apple</div>
          <div role="option" data-key="b" aria-disabled="true" data-text-value="Banana!">Banana</div>
        </div>
        <a role="option" data-key="c" href="/c">Cherry</a>
        <div role="option" data-key="d" hidden>Hidden</div>
      </div>`;
    const root = document.getElementById("list") as unknown as Element;
    const c = domCollection(root);
    assert.deepEqual([...c.getKeys()], ["g1", "h1", 1, "b", "c"]);
    assert.equal(c.getFirstKey(), "g1");
    assert.equal(c.getKeyAfter("g1"), "h1");
    assert.equal(c.getKeyAfter(1), "b");
    assert.equal(c.getKeyAfter("b"), "c");
    assert.equal(c.getItem("g1")!.type, "section");
    assert.equal(c.getItem("h1")!.type, "header");
    assert.equal(c.getItem(1)!.textValue, "Apple");
    assert.equal(c.getItem("b")!.textValue, "Banana!");
    assert.equal(c.getItem("b")!.props.isDisabled, true);
    assert.equal(c.getItem("c")!.props.href, "/c");
    assert.equal(c.getItem("d"), null);
    assert.equal(c.size, 3);
  });

  it("keyAttrs / domKey round-trip numbers and strings; getItemElement", () => {
    assert.deepEqual(keyAttrs(3), { "data-key": "3", "data-key-type": "number" });
    assert.deepEqual(keyAttrs("x"), { "data-key": "x" });
    document.body.innerHTML = `<ul id="l" data-collection="c1"><li data-collection="c1" data-key="3" data-key-type="number">x</li><li data-key='q"' >y</li></ul>`;
    const root = document.getElementById("l") as unknown as Element;
    const li = root.querySelector("li")!;
    assert.equal(domKey(li as unknown as Element), 3);
    assert.equal(getItemElement(root, 3), li);
  });
});
