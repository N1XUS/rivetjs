// DOM-DATA (spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md): the server half without a browser —
// `rowTexts` (which template slots are an element's whole text / a plain attribute, and their paths), the encoder's `D`
// trees (`domTree`: single trees, rows nodes, per-row exceptions, the DOM_MIN floor) and the runtime reader
// (`dom-resume-data.ts`) over a fake DOM. The end-to-end page: `resume-dom-data-browser.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rowTexts } from "../server-resume-paths.ts";
import { createDecoder, createEncoder } from "../resume-format.ts";
import type { DomTree, EntryRecord, TableEntry } from "../resume-format.ts";
import { _domRegistry } from "../server-dom-data.ts";
import type { DomRegistry, DomSlot } from "../server-dom-data.ts";
import { _domData } from "../dom-resume-data.ts";
import { _attributeRecord, compiledTemplate } from "../template.ts";

test("rowTexts: sole-child text slots and attribute slots, with their paths below the template root", () => {
  assert.deepEqual(rowTexts(["<li><b>", "</b><i>Note: ", "</i><span>", "</span></li>"], null), [
    [0, "b:0"],
    [2, "span:2"],
  ]);
  assert.deepEqual(rowTexts(["<li", "><b>", "</b></li>"], null), [
    [0, "li:@"],
    [1, "b:0"],
  ]);
  assert.deepEqual(rowTexts(["<p>", "</p>"], null), [[0, "p:"]]);
  // <pre> drops a leading newline: never listed.
  assert.equal(rowTexts(["<pre>", "</pre>"], null), null);
});

// A registry as the recorder fills it (by reference): one template of DOM-DATA slots `paths` (a leading `#`: a number's
// path), per row its anchor, its item and its slot values (undefined: the row wrote nothing worth a reference there).
const registry = (paths: string[], rows: [anchor: number, item: object, values: unknown[]][]): DomRegistry => {
  const dom = _domRegistry(),
    slots = paths.map((path, i): DomSlot => [i, path.replace(/^#/, ""), "#" + path.replace(/^#/, ""), 0, "", true]);
  for (const [anchor, item, values] of rows) dom.row(anchor, values, 0, slots, item);
  return dom;
};
// A fake element tree: `[tag, text | attrs, children]`.
interface Fake {
  localName: string;
  textContent: string;
  children: Fake[];
  getAttribute(name: string): string | null;
}
const el = (localName: string, text: string, children: Fake[] = [], attrs: Record<string, string> = {}): Fake => ({
  localName,
  textContent: text + children.map((c) => c.textContent).join(""),
  children,
  getAttribute: (name) => attrs[name] ?? null,
});
const roundTrip = (value: unknown, dom: DomRegistry, elements: Record<number, Fake>) => {
  const encoder = createEncoder({ dom });
  const root = encoder.ref(value);
  const table = encoder.table.slice() as TableEntry[];
  dom.runs(table, encoder.table);
  table.splice(0, table.length, ...(JSON.parse(JSON.stringify(table)) as TableEntry[]));
  const reader = _domData({ element: (id) => elements[id] as unknown as Element, row: () => null });
  const decoder = createDecoder(table);
  const entry = table[root] as EntryRecord;
  return { table, entry, value: entry.D ? reader.dom(entry.D as DomTree, decoder.get) : decoder.get(root) };
};

const people = [0, 1, 2].map((k) => ({ id: 10 + k, name: "Customer <" + k + "> Holdings", mail: "customer." + k + "@example.com", n: k }));
const rowElements = (list: typeof people, anchor = (k: number) => 5 + 3 * k) => {
  const elements: Record<number, Fake> = {};
  list.forEach((p, k) => (elements[anchor(k)] = el("li", "", [el("b", p.name), el("span", p.mail)], { "data-id": String(p.id) })));
  return elements;
};
const rowRegistry = (list: typeof people, skip = -1) =>
  registry(
    ["#li:@data-id", "b:0", "span:1"],
    list.map((p, k) => [5 + 3 * k, p, [p.id, p.name, k === skip ? undefined : p.mail]]),
  );

test("an array of rows: one D tree with a rows node (anchors 5, 8, 11); the strings leave the table", () => {
  const { table, entry, value } = roundTrip(people, rowRegistry(people), rowElements(people));
  assert.ok(entry.D);
  assert.equal(entry.D![1], null, "the array's own leaves: none");
  assert.deepEqual(entry.D!.slice(2, 6), [5, 3, 3, 0], "first anchor, stride, count, no exceptions");
  assert.ok(!JSON.stringify(table).includes("Holdings"));
  assert.ok(!JSON.stringify(table).includes("@example.com"));
  assert.deepEqual(value, people);
});

test("a row value the parser would change (CR): a per-row exception, the other rows stay DOM-backed", () => {
  const list = people.map((p, k) => (k === 1 ? { ...p, mail: "line\r\nbreak@example.com" } : p));
  const { table, entry, value } = roundTrip(list, rowRegistry(list), rowElements(list));
  assert.equal(entry.D![5], 1, "one exception");
  assert.ok(JSON.stringify(table).includes("line\\r\\nbreak@example.com"));
  assert.ok(!JSON.stringify(table).includes("customer.2@example.com"));
  assert.deepEqual(value, list);
});

test("a tree holding a rows node keeps its own literals; identity of shared shapes", () => {
  const page = { title: "x", rows: people };
  const { entry, value } = roundTrip(page, rowRegistry(people), rowElements(people));
  assert.ok(entry.D);
  assert.deepEqual(value, page);
});

test("a single tree under one anchor; below DOM_MIN saved characters it stays a j tree", () => {
  const user = { id: 7, name: "Grace Brewster Murray Hopper", bio: "Rear admiral, computer pioneer" };
  const dom = registry(["h1:0", "p:1"], [[3, user, [user.name, user.bio]]]);
  const elements = { 3: el("section", "", [el("h1", user.name), el("p", user.bio)]) };
  const { table, entry, value } = roundTrip(user, dom, elements);
  assert.equal(entry.D![1], 3);
  assert.ok(!JSON.stringify(table).includes("Hopper"));
  assert.deepEqual(value, user);
  const small = { id: 1, name: "Ada Love" };
  const out = roundTrip(small, registry(["b:0"], [[3, small, [small.name]]]), { 3: el("div", "", [el("b", small.name)]) });
  assert.ok(out.entry.j !== undefined, "8 characters: not worth a D tree");
  assert.deepEqual(out.value, small);
});

test("the reader checks tags: changed markup throws (no silent wrong data)", () => {
  const { table, entry } = roundTrip(people, rowRegistry(people), rowElements(people));
  const elements = rowElements(people);
  elements[8] = el("div", "", [el("i", "?")]);
  const reader = _domData({ element: (id) => elements[id] as unknown as Element, row: () => null });
  assert.throws(() => reader.dom(entry.D as DomTree, createDecoder(table).get), /DOM/);
});

test("a row with no registration for a column (its element missing): a per-row exception", () => {
  const { table, entry, value } = roundTrip(people, rowRegistry(people, 2), rowElements(people));
  assert.equal(entry.D![5], 1);
  assert.ok(JSON.stringify(table).includes("customer.2@example.com"));
  assert.deepEqual(value, people);
});

test("an odd first row (its value too short for a reference): the column stays DOM-backed, row 0 is the exception", () => {
  const list = people.map((p, k) => (k === 0 ? { ...p, mail: "a@b.co" } : p));
  const dom = registry(
    ["#li:@data-id", "b:0", "span:1"],
    list.map((p, k) => [5 + 3 * k, p, [p.id, p.name, p.mail]]),
  );
  const { table, entry, value } = roundTrip(list, dom, rowElements(list));
  assert.equal(entry.D![5], 1, "one exception: row 0's mail");
  assert.ok(!JSON.stringify(table).includes("customer.2@example.com"));
  assert.deepEqual(value, list);
});

test("registry by reference: row item trees one entry each share the first one's shape (one walk each), then a Dr run", () => {
  const list = [0, 1, 2, 3].map((k) => ({ id: 10 + k, name: "Customer <" + k + "> Holdings", mail: "customer." + k + "@example.com", n: k }));
  const dom = rowRegistry(list);
  const elements = rowElements(list);
  const encoder = createEncoder({ dom });
  const refs = list.map((p) => encoder.ref(p));
  const shapes = refs.map((r) => (encoder.table[r] as EntryRecord).D![0]);
  assert.equal(new Set(shapes).size, 1, "one shape");
  assert.deepEqual((encoder.table[refs[1]!] as EntryRecord).D, [shapes[0], 8, 1], "anchor + the one literal (n)");
  const t = encoder.table.slice() as TableEntry[];
  dom.runs(t, encoder.table);
  // Row 0's entry, then its shape entry, then rows 1–3: one run.
  assert.deepEqual(t[refs[1]!], { Dr: [shapes[0], 8, 3, 3, 1, 2, 3] });
  const wire = JSON.parse(JSON.stringify(t)) as TableEntry[];
  const reader = _domData({ element: (id) => elements[id] as unknown as Element, row: () => null });
  reader.expand(wire);
  // (The decoder's `D` case is a DOM_DATA build's: the reader directly.)
  const decoder = createDecoder(wire);
  assert.deepEqual(
    refs.map((r) => reader.dom((wire[r] as EntryRecord).D!, decoder.get)),
    list,
  );
  // A row whose tree differs from the shape (a key more): its own skeleton, its own shape.
  const odd = { ...list[3]!, extra: "x" };
  const dom2 = rowRegistry([...list.slice(0, 3), odd]);
  const encoder2 = createEncoder({ dom: dom2 });
  const refs2 = [...list.slice(0, 3), odd].map((p) => encoder2.ref(p));
  assert.notEqual((encoder2.table[refs2[3]!] as EntryRecord).D![0], (encoder2.table[refs2[0]!] as EntryRecord).D![0]);
});

test("a row whose value is not the one its template wrote: no DOM leaf for it (fast walk falls back, the value stays literal)", () => {
  const list = people.slice(0, 2);
  const dom = registry(
    ["#li:@data-id", "b:0", "span:1"],
    list.map((p, k) => [5 + 3 * k, p, [p.id, p.name, k === 1 ? "something.else@example.com" : p.mail]]),
  );
  const encoder = createEncoder({ dom });
  encoder.ref(list[0]);
  const ref = encoder.ref(list[1]);
  assert.ok(JSON.stringify(encoder.table[ref]).includes("customer.1@example.com"));
});

test("recorded rows (cdk collection rows): anchored at the root's data-r id; start-tag objects allowed, a nested content template refused", () => {
  // A cdk ListBoxItem's row: a spread's attribute list and the `_rId` record in the root start tag, the name as its whole text.
  const list = [0, 1, 2].map((k) => ({ id: 10 + k, name: "Customer " + k + " Holdings & Co" }));
  const fragments = ["<div", "", ">", "</div>"];
  const dom = _domRegistry();
  list.forEach((item, k) =>
    dom.recordedRow(
      compiledTemplate(fragments, [[_attributeRecord("role", "option", "html")], _attributeRecord("data-r", 3 + 2 * k, "html"), item.name]),
      item,
    ),
  );
  // No data-r in the root start tag: not registered. A content slot holding a template: not registered.
  const loose = { id: 1, name: "Loose row value here" };
  dom.recordedRow(compiledTemplate(["<div>", "</div>"], [loose.name]), loose);
  const nested = { id: 2, name: "Nested row value here" };
  dom.recordedRow(
    compiledTemplate(["<div", "><span>", "</span>", "</div>"], [_attributeRecord("data-r", 40, "html"), nested.name, compiledTemplate(["<i>x</i>"])]),
    nested,
  );
  assert.deepEqual([...dom.items.keys()], list);
  assert.deepEqual(
    list.map((item) => dom.info[dom.items.get(item)!]),
    [3, 5, 7],
  );
  const encoder = createEncoder({ dom });
  const ref = encoder.ref(list);
  const wire = JSON.stringify(encoder.table);
  assert.ok((encoder.table[ref] as EntryRecord).D, "a D tree");
  for (const item of list) assert.ok(!wire.includes(JSON.stringify(item.name)), item.name);
  // Read back from the rows (fake elements by data-r id).
  const elements: Record<number, Fake> = {};
  list.forEach((item, k) => (elements[3 + 2 * k] = el("div", item.name)));
  const reader = _domData({ element: (id) => elements[id] as unknown as Element, row: () => null });
  const table = JSON.parse(wire) as TableEntry[];
  reader.expand(table);
  assert.deepEqual(reader.dom((table[ref] as EntryRecord).D!, createDecoder(table).get), list);
});
