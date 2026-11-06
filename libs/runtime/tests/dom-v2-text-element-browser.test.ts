// `_te` (compiler ABI, GC-01): a sole dynamic text child of a placeholder-free element (`<strong></strong>`). The
// binding starts with the element: the first scalar write sets `textContent` (no placeholder Text, no Text wrapper during
// the mount); the first later write takes that Text node and the `_fx1` binding keeps it in place of the element
// (`_rebind1`), so updates write the same Text node's data. A node / array / accessor switches the element to
// insertion semantics for good.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

const unit = `
import { mount, _tpl, _te, _fx1, _fx } from "/dom.ts";
import { signal } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const strong = _tpl("<strong></strong>");
const write = (el, value) => { try { _te(el, value()); } catch (error) { _te(el, null); throw error; } };
function bound(value, closure = false) {
  const target = host();
  mount(() => { const el = strong(); closure ? _fx(() => write(el, value)) : _fx1(write, el, value); return el; }, target);
  return target.firstChild;
}
export function scalars() {
  const v = signal("a");
  const el = bound(v);
  check(el.childNodes.length === 1 && el.firstChild.nodeType === 3 && el.textContent === "a", "first write: " + el.innerHTML);
  const text = el.firstChild;
  v.set(7);
  check(el.firstChild === text && text.data === "7", "number keeps the Text node: " + el.innerHTML);
  v.set(null);
  check(el.firstChild === text && text.data === "", "null empties the Text node: " + el.childNodes.length);
  v.set(false);
  check(text.data === "", "false");
  v.set(0);
  check(text.data === "0", "zero: " + text.data);
  v.set(10n);
  check(text.data === "10" && el.childNodes.length === 1, "bigint");
  check(!("$$t" in el) && !("$$s" in el) && !("$$s" in text), "no expando on the scalar path");
  return "passed";
}
export function emptyFirst() {
  const v = signal("");
  const el = bound(v);
  check(el.childNodes.length === 0, "an empty first value creates no Text node: " + el.childNodes.length);
  v.set(0);
  check(el.textContent === "0" && el.childNodes.length === 1, "zero after empty: " + el.innerHTML);
  const text = el.firstChild;
  v.set("b");
  check(el.firstChild === text && text.data === "b", "later writes keep that Text node");
  return "passed";
}
export function closureBinding() {
  // An \`_fx\` closure binding (captures past _fx1's limit) has nothing to rebind: each write finds the Text again.
  const v = signal("a");
  const el = bound(v, true);
  const text = el.firstChild;
  v.set("b");
  v.set("c");
  check(el.firstChild === text && text.data === "c" && el.childNodes.length === 1, "closure binding: " + el.innerHTML);
  return "passed";
}
export function rebinds() {
  const v = signal("a");
  const el = bound(v);
  v.set("b");
  const text = el.firstChild;
  // The binding holds the Text node after its first update (no firstChild read per update): an untracked imperative
  // edit of the element's children is not seen.
  el.replaceChildren(document.createTextNode("x"));
  v.set("c");
  check(text.data === "c" && el.textContent === "x", "update writes the bound Text node: " + text.data + " / " + el.textContent);
  return "passed";
}
export function switchesToInsertion() {
  const v = signal("a");
  const el = bound(v);
  const em = document.createElement("em");
  v.set(em);
  check(el.childNodes.length === 1 && el.firstChild === em, "node replaces the text: " + el.innerHTML);
  v.set([document.createElement("i"), "x"]);
  check(el.innerHTML === "<i></i>x", "array: " + el.innerHTML);
  v.set("back");
  check(el.textContent === "back" && el.childNodes.length === 1, "scalar after the switch: " + el.innerHTML);
  v.set(null);
  check(el.childNodes.length === 0, "null clears the slot");
  const inner = signal("p");
  v.set(() => inner());
  check(el.textContent === "p", "accessor: " + el.textContent);
  inner.set("q");
  check(el.textContent === "q", "accessor updates in its own binding: " + el.textContent);
  return "passed";
}
export function nodeFirst() {
  const v = signal(document.createElement("b"));
  const el = bound(v);
  check(el.innerHTML === "<b></b>", "first value a node: " + el.innerHTML);
  v.set("t");
  check(el.textContent === "t" && el.childNodes.length === 1, "then text: " + el.innerHTML);
  return "passed";
}
export function throwingRead() {
  const bad = signal(false);
  const n = signal(0);
  const el = bound(() => { n(); if (bad()) throw Error("boom"); return "ok"; });
  n.set(1);
  const text = el.firstChild;
  let thrown = null;
  try { bad.set(true); } catch (error) { thrown = error; }
  check(thrown && thrown.message === "boom", "rethrown");
  check(el.firstChild === text && text.data === "", "emptied: " + el.innerHTML);
  return "passed";
}
`;

const scenarios = ["scalars", "emptyFirst", "closureBinding", "switchesToInsertion", "nodeFirst", "throwingRead"];
for (const scenario of scenarios) {
  test("dom v2 _te: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}
// Development's `_bindingEffect1` is a closure effect (graph inspection): nothing to rebind there.
test("production (default resolution): dom v2 _te: the _fx1 binding keeps the Text node after its first update", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    assert.equal(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as Record<string, () => string>).rebinds!()), "passed");
  });
});
