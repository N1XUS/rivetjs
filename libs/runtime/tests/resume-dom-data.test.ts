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
import type { DomRegistry } from "../server-dom-data.ts";
import { _domData } from "../dom-resume-data.ts";

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

// A registry as the recorder fills it: per row `anchor, n, n × (value, path)`, the row items mapped to their headers.
const registry = (rows: [anchor: number, path: string, value: string | number][], items: [object, number][]): DomRegistry => {
  const dom = _domRegistry(),
    heads = new Map<number, number>();
  for (const [anchor, path, value] of rows) {
    let head = heads.get(anchor);
    if (head === undefined) heads.set(anchor, (head = dom.regs.push(anchor, 0) - 2));
    dom.regs.push(value, path);
    (dom.regs[head + 1] as number)++;
  }
  for (const [item, anchor] of items) dom.items.set(item, heads.get(anchor)!);
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
    list.flatMap((p, k): [number, string, string | number][] => [
      [5 + 3 * k, "#li:@data-id", p.id],
      [5 + 3 * k, "b:0", p.name],
      ...(k === skip ? [] : ([[5 + 3 * k, "span:1", p.mail]] as [number, string, string][])),
    ]),
    list.map((p, k) => [p, 5 + 3 * k]),
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
  const dom = registry(
    [
      [3, "h1:0", user.name],
      [3, "p:1", user.bio],
    ],
    [[user, 3]],
  );
  const elements = { 3: el("section", "", [el("h1", user.name), el("p", user.bio)]) };
  const { table, entry, value } = roundTrip(user, dom, elements);
  assert.equal(entry.D![1], 3);
  assert.ok(!JSON.stringify(table).includes("Hopper"));
  assert.deepEqual(value, user);
  const small = { id: 1, name: "Ada Love" };
  const out = roundTrip(small, registry([[3, "b:0", small.name]], [[small, 3]]), { 3: el("div", "", [el("b", small.name)]) });
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
