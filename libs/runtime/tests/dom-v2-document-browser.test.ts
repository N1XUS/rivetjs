import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// DOM v2 `_tpl` clones (V2-FIX R1 / R3): an element given to a ref before insertion is owned by the live
// document (cdk CdkScrollable registers its scroll dispatcher on `ownerDocument`), and custom elements
// upgrade at clone time so property writes reach their setters.
const unit = `
import { mount, _tpl, _tplNs, _ref, _setProp } from "/dom.ts";
const check = (condition, message) => { if (!condition) throw Error(message); };
const host = () => { const node = document.createElement("div"); document.body.append(node); return node; };
export function ownerDocument() {
  // Elements handed out before insertion (\`_ref\`) are owned by the live document — their whole clone is
  // (cdk CdkScrollable reads \`ownerDocument.defaultView\` in its ref); other clones are adopted on insertion.
  const target = host(), seen = [];
  mount(() => {
    const root = _tpl("<section><b></b><i></i></section>")();
    _ref(root.firstChild, (el) => seen.push(el.ownerDocument === document && el.ownerDocument.defaultView === window, root.lastChild.ownerDocument === document));
    const svg = _tpl("<path d=M0></path>", 1)(), math = _tpl("<mi>x</mi>", 2)(), frag = _tpl("<i></i><u></u>", 4)(), ns = _tplNs("<a>a</a>")();
    _ref(svg, (el) => seen.push(el.ownerDocument === document && el.namespaceURI === "http://www.w3.org/2000/svg"));
    _ref(math, (el) => seen.push(el.ownerDocument === document && el.namespaceURI === "http://www.w3.org/1998/Math/MathML"));
    seen.push(frag.ownerDocument === document && frag.firstChild.ownerDocument === document && frag.childNodes.length === 2);
    _ref(ns, (el) => seen.push(el.ownerDocument === document));
    // Every clone is a fresh copy: the cached root is never handed out.
    seen.push(root !== _tpl("<section><b></b><i></i></section>")());
    return root;
  }, target);
  check(target.querySelector("section").ownerDocument === document, "inserted clone adopted");
  check(seen.length === 7 && seen.every(Boolean), "owned by document before insertion: " + seen.join());
  return "passed";
}
export function customElementProps() {
  // \`prop:items\` on a not-yet-inserted clone: the element is already upgraded, so the class setter runs (an own
  // property written before the upgrade would shadow it).
  customElements.define("x-v2-probe", class extends HTMLElement {
    set items(v) { this.textContent = v.join(""); }
  });
  const target = host();
  let before = "";
  mount(() => {
    const el = _tpl("<div><x-v2-probe></x-v2-probe></div>")();
    const probe = el.firstChild;
    _setProp(probe, "items", ["a", "b"]);
    before = probe.textContent + ":" + (probe.constructor !== HTMLElement) + ":" + Object.hasOwn(probe, "items");
    return el;
  }, target);
  check(before === "ab:true:false", "upgraded at clone time: " + before);
  return "passed";
}
`;

for (const scenario of ["ownerDocument", "customElementProps"]) {
  test("dom v2 document: " + scenario, async () => {
    await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
      await page.goto("http://rivet.test/");
      assert.equal(await page.evaluate(async (name) => ((await import("/unit.mjs" as string)) as Record<string, () => string>)[name]!(), scenario), "passed");
    });
  });
}

test("dom v2 document: a template cloned with no document names mount (R2)", async () => {
  assert.equal(typeof (globalThis as { document?: unknown }).document, "undefined");
  const { _tpl } = await import("../dom-v2.ts");
  assert.throws(() => _tpl("<div></div>")(), /^Error: Construct DOM inside mount\(\)/);
});
