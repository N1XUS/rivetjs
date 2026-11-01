// `_adapters/dom-collection.ts` DOMCollection key lookup (Rivet adapter, no upstream test).
import "./dom.ts";
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { DOMCollection } from "../_adapters/dom-collection.ts";

const root = (html: string) => {
  const el = document.createElement("div");
  el.setAttribute("data-collection", "c");
  el.innerHTML = html;
  return el;
};

describe("DOMCollection.getItem", () => {
  it("matches a key and its number / string twin, but never a non-canonical numeric string", () => {
    const c = new DOMCollection(
      root(
        `<div role="option" data-collection="c" data-key="0" data-key-type="number">Zero</div><div role="option" data-collection="c" data-key="7">Seven</div>`,
      ),
    );
    assert.equal(c.getItem(0)?.textValue, "Zero");
    assert.equal(c.getItem("0")?.textValue, "Zero");
    assert.equal(c.getItem("7")?.textValue, "Seven");
    assert.equal(c.getItem(7)?.textValue, "Seven");
    // `Number("")` / `Number(" ")` / `Number("0x0")` are 0: those string keys are not key 0.
    assert.equal(c.getItem("")?.key, undefined);
    assert.equal(c.getItem(" ")?.key, undefined);
    assert.equal(c.getItem("0x0")?.key, undefined);
    assert.equal(c.getItem("00")?.key, undefined);
  });
});
