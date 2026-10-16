// `_tx` (compiler ABI, IMPL-DOM F2): a sole dynamic text child bound to its template's placeholder Text node. Scalars
// write the Text node's data (no element expando); the first node / array / accessor switches the binding to
// insertion semantics for good, the emptied placeholder as its marker; later scalars insert text before it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

const unit = `
import { mount, _tpl, _tx, _fx1, _fx } from "/dom.ts";
import { signal } from "/reactivity.mjs";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
const strong = _tpl("<strong> </strong>");
const write = (text, value) => { try { _tx(text, value()); } catch (error) { _tx(text, null); throw error; } };
function bound(value) {
  const target = host();
  let text = null;
  mount(() => { const el = strong(); text = el.firstChild; _fx1(write, text, value); return el; }, target);
  return { el: target.firstChild, text };
}
export function scalars() {
  const v = signal("a");
  const { el, text } = bound(v);
  check(el.childNodes.length === 1 && el.firstChild === text && text.data === "a", "first write: " + el.innerHTML);
  v.set(7);
  check(text.data === "7" && el.firstChild === text, "number: " + el.innerHTML);
  v.set(null);
  check(text.data === "" && el.firstChild === text, "null keeps an empty placeholder: " + el.childNodes.length);
  v.set(false);
  check(text.data === "", "false");
  v.set(0);
  check(text.data === "0", "zero: " + text.data);
  v.set(10n);
  check(text.data === "10", "bigint");
  check(!("$$t" in el) && !("$$s" in text), "no expando on the scalar path");
  return "passed";
}
export function switchesToInsertion() {
  const v = signal("a");
  const { el, text } = bound(v);
  const em = document.createElement("em");
  v.set(em);
  check(el.firstChild === em && el.lastChild === text && text.data === "", "node inserted before the emptied placeholder: " + el.innerHTML);
  v.set([document.createElement("i"), "x"]);
  check(el.innerHTML === "<i></i>x" && el.lastChild === text, "array: " + el.innerHTML);
  v.set("back");
  check(el.textContent === "back" && el.childNodes.length === 2 && el.lastChild === text, "scalar after the switch inserts text: " + el.childNodes.length);
  v.set(null);
  check(el.childNodes.length === 1 && el.firstChild === text, "null clears the slot");
  const inner = signal("p");
  v.set(() => inner());
  check(el.textContent === "p", "accessor: " + el.textContent);
  inner.set("q");
  check(el.textContent === "q" && el.lastChild === text, "accessor updates in its own binding: " + el.textContent);
  return "passed";
}
export function throwingRead() {
  const bad = signal(false);
  const { el, text } = bound(() => { if (bad()) throw Error("boom"); return "ok"; });
  let thrown = null;
  try { bad.set(true); } catch (error) { thrown = error; }
  check(thrown && thrown.message === "boom", "rethrown");
  check(el.firstChild === text && text.data === "", "emptied: " + el.innerHTML);
  return "passed";
}
`;

for (const scenario of ["scalars", "switchesToInsertion", "throwingRead"]) {
  test("dom v2 _tx: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}
