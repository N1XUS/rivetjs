// Rivet test: item-morph per-list live entries do not outlive their list (FIX2-CDK, review cdk-b-2#11).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { createItemMorph, itemMorphKeyDown, itemMorphLiveCount } = await import("../morph/item.tsx");

const row = (id: string) => {
  const el = document.createElement("div");
  el.setAttribute("data-rv-morph", id);
  document.body.append(el);
  return el;
};
const key = (target: Element) => ({ target, key: "a", shiftKey: false }) as unknown as KeyboardEvent;

test("an unmounted list's entry is dropped when another list gets its first event", () => {
  const base = itemMorphLiveCount();
  const lists = Array.from({ length: 5 }, () => createItemMorph());
  for (const m of lists) {
    const el = row(m.id);
    itemMorphKeyDown(m, key(el)); // records the pressed row
    el.remove(); // route change: the list unmounts
  }
  // Each new list pruned the previous (gone) one: one entry left, not five.
  assert.equal(itemMorphLiveCount() - base, 1);
  // A mounted list keeps its entry.
  const live = createItemMorph();
  const el = row(live.id);
  itemMorphKeyDown(live, key(el));
  const other = createItemMorph();
  itemMorphKeyDown(other, key(row(other.id)));
  assert.equal(itemMorphLiveCount() - base, 2, "live + other kept, the last gone one pruned");
});
