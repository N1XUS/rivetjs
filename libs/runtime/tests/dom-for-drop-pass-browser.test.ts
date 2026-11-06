// The removal-only reconcile pass (FILTER3 2026-11-06): a derived build's ranged adopted rows (server markers carrying
// `$rw`) dropped by a filter leave their markers in place (inert: the opener's row marked done) and each dropped element
// costs one plain `removeChild`; the hover rule (`drop`: a deferred first click's flush, a route commit it postponed)
// is read once per pass and still keeps a hovered dropped element (hidden) until the next frame.
import { test } from "vitest";
import assert from "node:assert/strict";
import { DERIVED_BUILD, withPage } from "./resume/harness.ts";

const unit = `
import { mount } from "/dom.ts";
import { _adoption, _for, _insert, _hoverRule } from "/dom-v2.ts";
import { signal } from "/reactivity.mjs";
// Server rows as a derived page has them: <!--r[--><li><!--]--> per key, the markers carrying their row ($rw).
export function setup(keys, kept) {
  const target = document.createElement("div");
  document.body.append(target);
  const ul = document.createElement("ul");
  target.append(ul);
  const rows = keys.map((x) => {
    const open = document.createComment("r["), li = document.createElement("li"), close = document.createComment("]");
    li.textContent = "s" + x;
    li.style.height = "20px";
    ul.append(open, li, close);
    const row = { value: x, key: x, sig: null, index: null, nodes: null, start: open, end: close, owner: null, pass: 0, ad: -1, done: false };
    open.$rw = row;
    close.$rw = true;
    return row;
  });
  const server = Array.from(ul.childNodes);
  const outer = _adoption.rows, same = _adoption.same, inert = _adoption.inert;
  _adoption.rows = () => ((_adoption.rows = outer), { items: keys.slice(), rows, changed: null, host: null });
  _adoption.same = (a, b) => a === b;
  // As dom-derived.ts installs it.
  _adoption.inert = (n) => { const mark = n.$rw; if (mark === undefined) return false; if (mark !== true) mark.done = true; return true; };
  const items = signal(keys);
  try {
    mount(() => {
      _insert(ul, _for({ each: () => items(), by: (x) => x, children: (item) => { const li = document.createElement("li"); li.textContent = "c" + item(); return li; } }));
      return document.createTextNode("");
    }, target);
  } finally {
    _adoption.rows = outer;
    _adoption.same = same;
  }
  window.__drop = { ul, rows, server, items, kept, inert };
}
export function filter(hover) {
  const { ul, rows, server, items, kept } = window.__drop;
  const hovered = Array.from(ul.children).filter((li) => li.matches(":hover")).map((li) => li.textContent).join(" ");
  const remove = Node.prototype.removeChild;
  let calls = 0;
  Node.prototype.removeChild = function (n) { calls++; return remove.call(this, n); };
  _hoverRule.on = hover;
  try {
    items.set(kept);
  } finally {
    _hoverRule.on = false;
    Node.prototype.removeChild = remove;
  }
  const lis = Array.from(ul.children);
  return JSON.stringify({
    calls,
    hovered,
    shown: lis.filter((li) => !li.hidden).map((li) => li.textContent).join(" "),
    hidden: lis.filter((li) => li.hidden).map((li) => li.textContent).join(" "),
    comments: Array.from(ul.childNodes).filter((n) => n.nodeType === 8).length,
    sameNodes: Array.from(ul.childNodes).every((n) => server.includes(n)),
    done: rows.filter((r) => r.done).map((r) => r.key).join(" "),
  });
}
export function afterFrame() {
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(Array.from(window.__drop.ul.children).map((li) => li.textContent).join(" ")))));
}
`;

const files = { ...DERIVED_BUILD, "/": "<!doctype html><body style='margin:0'></body>", "/unit.mjs": unit };
const call = (page: import("playwright").Page, name: string, ...args: unknown[]): Promise<string> =>
  page.evaluate(async ([n, a]) => ((await import("/unit.mjs" as string)) as Record<string, (...x: unknown[]) => string>)[n as string]!(...(a as unknown[])), [
    name,
    args,
  ] as const);

test("dom v2 For drop pass: dropped server rows leave inert markers, one removeChild per dropped element", async () => {
  const out = await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await call(page, "setup", [1, 2, 3, 4, 5, 6], [2, 5]);
    return JSON.parse(await call(page, "filter", false));
  });
  assert.deepEqual(out, { calls: 4, hovered: "", shown: "s2 s5", hidden: "", comments: 12, sameNodes: true, done: "1 3 4 6" });
});

test("dom v2 For drop pass: the hover rule keeps a hovered dropped element until the next frame", async () => {
  const out = await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await call(page, "setup", [1, 2, 3, 4], [1, 4]);
    // Row 2's li under the pointer (hover state settles in a frame).
    const box = (await page.locator("li").nth(1).boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const first = JSON.parse(await call(page, "filter", true));
    return [first, await call(page, "afterFrame")];
  });
  assert.deepEqual(out, [{ calls: 1, hovered: "s2", shown: "s1 s4", hidden: "s2", comments: 8, sameNodes: true, done: "2 3" }, "s1 s4"]);
});
