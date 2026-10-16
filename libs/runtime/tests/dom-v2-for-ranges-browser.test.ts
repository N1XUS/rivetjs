// `_for` rows rendering a range (accessor / array content between a row's own start / end anchors): the row's inner
// insertion changes its nodes after the list's last read, so the list insertion must reconcile against the rows'
// live nodes, not the node list it returned then. A stale snapshot moved (removed + re-inserted) the row's later
// nodes when a sibling row was added (CSS animations restarted) and left them behind as duplicates when the row was
// removed (Chromium; happy-dom does not reproduce the duplicate). Also: duplicate keys keep throwing `Duplicate For key`
// on every path (middle, kept prefix / suffix, fresh list, after a failed pass).
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

const unit = `
import { mount, _tpl, _for, _insert } from "/dom.ts";
import { signal, createRoot } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const el = (tag, text) => { const node = _tpl("<" + tag + "></" + tag + ">")(); if (text !== undefined) node.textContent = text; return node; };
// A list of ranged rows: each row is an accessor that shows its <li> and, while \`extra(id)\` is set, an <em> after it.
function list(items, extra) {
  const target = host();
  mount(() => {
    const root = el("ul");
    _insert(root, _for({ each: items, by: (x) => x, children: (item) => {
      const li = el("li", String(item())), em = el("em", String(item()));
      return () => (extra()[item()] ? [li, em] : [li]);
    } }));
    return root;
  }, target);
  return target.firstChild;
}
const text = (ul) => Array.from(ul.childNodes).filter((n) => n.nodeType === 1).map((n) => n.localName + n.textContent).join(" ");
function removals(ul, run) {
  const observer = new MutationObserver(() => {});
  observer.observe(ul, { childList: true });
  run();
  const removed = [];
  for (const record of observer.takeRecords()) for (const node of record.removedNodes) if (node.nodeType === 1) removed.push(node.localName + node.textContent);
  observer.disconnect();
  return removed;
}
export function grownRowKeepsNodes() {
  const items = signal([1]), extra = signal({});
  const ul = list(items, extra);
  extra.set({ 1: true });
  check(text(ul) === "li1 em1", "grown: " + text(ul));
  const removed = removals(ul, () => items.set([1, 2]));
  check(text(ul) === "li1 em1 li2", "sibling added: " + text(ul));
  check(removed.length === 0, "row 1 nodes moved: " + removed.join(","));
  return "passed";
}
export function grownRowRemoved() {
  const items = signal([1, 2]), extra = signal({});
  const ul = list(items, extra);
  extra.set({ 1: true });
  items.set([2]);
  check(text(ul) === "li2", "removed row left nodes behind: " + text(ul));
  items.set([2, 3]);
  extra.set({ 2: true, 3: true });
  items.set([3]);
  check(text(ul) === "li3 em3", "second removal: " + text(ul));
  return "passed";
}
export function shrunkRowReordered() {
  const items = signal([1, 2, 3]), extra = signal({ 1: true, 2: true, 3: true });
  const ul = list(items, extra);
  extra.set({ 2: true });
  check(text(ul) === "li1 li2 em2 li3", "shrunk: " + text(ul));
  items.set([3, 2, 1]);
  check(text(ul) === "li3 li2 em2 li1", "reversed: " + text(ul));
  extra.set({ 1: true, 3: true });
  items.set([1, 3]);
  check(text(ul) === "li1 em1 li3 em3", "reordered: " + text(ul));
  items.set([]);
  check(ul.childNodes.length === 0, "cleared: " + ul.childNodes.length);
  return "passed";
}
export function duplicateKeys() {
  const results = [];
  const attempt = (...passes) => {
    const items = signal(passes[0]), ul = document.createElement("ul"), errors = [];
    const root = createRoot((dispose) => {
      _insert(ul, _for({ each: items, by: (r) => r.id, children: (item) => el("li", item().id) }));
      return dispose;
    });
    for (const pass of passes.slice(1)) {
      try { items.set(pass); errors.push(null); } catch (e) { errors.push(e.message); }
    }
    results.push([errors, ul.textContent]);
    root.value();
  };
  const a = { id: "a" }, b = { id: "b" }, c = { id: "c" }, x = { id: "x" };
  attempt([a, b], [a, { id: "a" }, b]); // new middle key = kept prefix key
  attempt([a, b], [a, b, { id: "b" }]); // appended key = kept row key
  attempt([], [a, { id: "a" }]); // fresh list
  attempt([a, b, c], [c, b, { id: "c" }]); // middle duplicate of a moved row
  attempt([a, b], [a, { id: "a" }, b], [a, c, b], [a, c, b, { id: "c" }]); // a failed pass leaves keys consistent
  attempt([a, b, c], [c, a], [x, c, a, b]); // removed keys are free again
  return JSON.stringify(results);
}
`;

for (const scenario of ["grownRowKeepsNodes", "grownRowRemoved", "shrunkRowReordered"]) {
  test("dom v2 For ranged rows: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}

test("dom v2 For: duplicate keys throw on every path", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    const out = JSON.parse(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as { duplicateKeys(): string }).duplicateKeys()));
    assert.deepEqual(out, [
      [["Duplicate For key"], "ab"],
      [["Duplicate For key"], "ab"],
      [["Duplicate For key"], ""],
      [["Duplicate For key"], "abc"],
      [["Duplicate For key", null, "Duplicate For key"], "acb"],
      [[null, null], "xcab"],
    ]);
  });
});
