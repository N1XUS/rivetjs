// `_for` passes that keep every row (FILTER2 2026-11-05: a filter's later keys returning the same rows): the rows signal
// is not republished, so the list insertion neither re-collects the rows' nodes nor reconciles them. A first pass over
// adopted rows (`_adoption.rows`) whose items equal `each` still publishes its rows. Removal-only reconciles (the new
// nodes a subsequence of the current ones) take a merge walk: order, identity and nodes already gone stay right; a pass
// that also moves rows takes the general path.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

const unit = `
import { mount } from "/dom.ts";
import { _adoption, _for, _insert } from "/dom-v2.ts";
import { signal } from "/reactivity.mjs";
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const ids = (ul) => Array.from(ul.children).map((n) => n.textContent).join(" ");
// A list whose \`each\` and rows' node reads are counted (a ranged row: an accessor between its own anchors).
function list(items, ranged) {
  const counts = { each: 0, nodes: 0 };
  const target = host();
  mount(() => {
    const ul = document.createElement("ul");
    _insert(ul, _for({ each: () => (counts.each++, items()), by: (x) => x, children: (item) => {
      const li = document.createElement("li");
      li.textContent = String(item());
      return ranged ? () => (counts.nodes++, li) : li;
    } }));
    return ul;
  }, target);
  return { ul: target.firstChild, counts };
}
export function unchanged() {
  const out = [];
  const items = signal([1, 2, 3, 4]);
  const { ul } = list(items, false);
  const before = Array.from(ul.childNodes);
  let records = 0;
  const observer = new MutationObserver((r) => (records += r.length));
  observer.observe(ul, { childList: true, subtree: true });
  items.set([1, 2, 3, 4]); // a fresh array of the same items
  records += observer.takeRecords().length;
  out.push(ids(ul), records, Array.from(ul.childNodes).every((n, i) => n === before[i]));
  items.set([1, 3, 4]);
  out.push(ids(ul), Array.from(ul.childNodes)[1] === before[2]);
  items.set([1, 3, 4]);
  items.set([4, 1, 3]);
  out.push(ids(ul));
  observer.disconnect();
  return JSON.stringify(out);
}
export function adoptedFirstPass() {
  // Server rows already in the list element, adopted by the first pass with the same items.
  const target = host();
  const ul = document.createElement("ul");
  target.append(ul);
  const server = [1, 2, 3].map((x) => { const li = document.createElement("li"); li.textContent = "s" + x; ul.append(li); return li; });
  const items = signal([1, 2, 3]);
  const rows = server.map((li, i) => ({ value: i + 1, key: i + 1, sig: null, index: null, nodes: li, start: null, end: null, owner: null, pass: 0, ad: -1 }));
  const outer = _adoption.rows;
  _adoption.rows = () => ((_adoption.rows = outer), { items: [1, 2, 3], rows, changed: null, host: null });
  try {
    mount(() => {
      _insert(ul, _for({ each: () => items(), by: (x) => x, children: (item) => { const li = document.createElement("li"); li.textContent = "c" + item(); return li; } }));
      return document.createTextNode("");
    }, target);
  } finally {
    _adoption.rows = outer;
  }
  const out = [ids(ul), Array.from(ul.children).every((n, i) => n === server[i])];
  items.set([1, 2, 3]);
  out.push(ids(ul));
  items.set([2, 3, 4]);
  out.push(ids(ul), ul.children[0] === server[1]);
  return JSON.stringify(out);
}
export function rangedUnchanged() {
  const items = signal([1, 2, 3]);
  const { ul, counts } = list(items, true);
  const each = counts.each, nodes = Array.from(ul.childNodes);
  items.set([1, 2, 3]);
  items.set([1, 3]);
  return JSON.stringify([ids(ul), counts.each - each, Array.from(ul.childNodes).every((n) => nodes.includes(n))]);
}
export function removals() {
  const out = [];
  const items = signal(Array.from({ length: 10 }, (_, i) => i + 1));
  const { ul } = list(items, false);
  const before = Array.from(ul.childNodes);
  items.set([2, 4, 6, 7, 10]);
  out.push(ids(ul), [1, 3, 5, 6, 9].every((at, i) => ul.childNodes[i] === before[at]));
  items.set([7]);
  out.push(ids(ul));
  items.set([7, 1, 2]);
  items.set([2, 1]); // removal + move: general path
  out.push(ids(ul));
  return JSON.stringify(out);
}
`;

const run = async (name: string): Promise<unknown> =>
  withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    return JSON.parse(await page.evaluate(async (n) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[n]!(), name));
  });

test("dom v2 For: a pass keeping every row changes nothing; later changes still apply", async () => {
  assert.deepEqual(await run("unchanged"), ["1 2 3 4", 0, true, "1 3 4", true, "4 1 3"]);
});

test("dom v2 For: a first pass over adopted rows equal to its items publishes them", async () => {
  assert.deepEqual(await run("adoptedFirstPass"), ["s1 s2 s3", true, "s1 s2 s3", "s2 s3 c4", true]);
});

test("dom v2 For: ranged rows after an unchanged pass", async () => {
  // `each` runs once per change; the removal after the unchanged pass reconciles against the rows' live nodes.
  assert.deepEqual(await run("rangedUnchanged"), ["1 3", 2, true]);
});

test("dom v2 For: removal-only reconciles keep order and identity", async () => {
  assert.deepEqual(await run("removals"), ["2 4 6 7 10", true, "7", "2 1"]);
});
