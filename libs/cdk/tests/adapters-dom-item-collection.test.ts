// `_adapters/selection-manager.ts`: `domItemCollection(root, item)` is the one-item slice of `domCollection(root)`
// (hover handlers build it instead of the whole collection per item entered).
import "./dom.ts";
import { describe, expect, it } from "vitest";
import { domCollection, domItemCollection } from "../_adapters/selection-manager.ts";

const fixture = () => {
  const root = document.createElement("div");
  root.setAttribute("data-collection", "m");
  root.innerHTML = `
    <div data-key="0" data-key-type="number" data-text="Zero">0</div>
    <div data-section data-key="s" aria-label="S">
      <div data-key="a" aria-disabled="true"> Alpha </div>
      <a data-key="b" href="/b" target="_blank">Beta</a>
    </div>
    <div data-section data-key="h" hidden><div data-key="hidden-child">x</div></div>
    <div data-key="sub"><div data-collection="other"><div data-key="nested">n</div></div></div>`;
  document.body.append(root);
  return root;
};
const shape = (n: { key: unknown; type: string; parentKey: unknown; textValue: string; props: unknown; level: number } | null) =>
  n && { key: n.key, type: n.type, parentKey: n.parentKey, textValue: n.textValue, props: n.props, level: n.level };

describe("domItemCollection", () => {
  it("matches domCollection's node for every element", () => {
    const root = fixture();
    const full = domCollection(root);
    for (const el of root.querySelectorAll("[data-key]:not([data-section])")) {
      const key = el.getAttribute("data-key-type") === "number" ? Number(el.getAttribute("data-key")) : el.getAttribute("data-key")!;
      expect(shape(domItemCollection(root, el).getItem(key) as never), String(key)).toEqual(shape(full.getItem(key) as never));
    }
    expect(domItemCollection(root, root.querySelector('[data-key="nested"]')!).size).toBe(0);
    expect(domItemCollection(root, root.querySelector('[data-key="hidden-child"]')!).size).toBe(0);
    expect(domItemCollection(root, root.querySelector(`[data-key="0"]`)!).getItem(0)?.key).toBe(0);
    root.remove();
  });
});
