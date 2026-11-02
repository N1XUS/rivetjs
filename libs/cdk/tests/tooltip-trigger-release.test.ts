// Rivet tests (FIX2-CDK): a tooltip trigger removed while focused releases its document listeners on the next press
// (review cdk-b-2#12); touch tracking installs once per document, not once per process (review r3-leaks#10).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { tooltipTriggerFocus, tooltipTriggerPointerEnter } = await import("../tooltip/behaviour.tsx");
const { createTooltipTriggerState } = await import("../state/tooltip.ts");

function spy(doc: Document) {
  const added: string[] = [];
  const removed: string[] = [];
  const add = doc.addEventListener.bind(doc);
  const remove = doc.removeEventListener.bind(doc);
  doc.addEventListener = ((type: string, ...rest: unknown[]) => (added.push(type), (add as (...a: unknown[]) => void)(type, ...rest))) as never;
  doc.removeEventListener = ((type: string, ...rest: unknown[]) => (removed.push(type), (remove as (...a: unknown[]) => void)(type, ...rest))) as never;
  return { added, removed, restore: () => ((doc.addEventListener = add), (doc.removeEventListener = remove)) };
}

test("a focused trigger removed from the DOM drops its capture listeners on the next keydown", () => {
  const state = createTooltipTriggerState();
  const wrapper = document.createElement("span");
  document.body.append(wrapper);
  const s = spy(document);
  try {
    tooltipTriggerFocus({ currentTarget: wrapper, relatedTarget: null, target: wrapper } as unknown as FocusEvent, {}, state);
    assert.ok(s.added.includes("pointerdown") && s.added.includes("keydown"));
    assert.deepEqual(s.removed, []);
    wrapper.remove(); // no blur fires for a removed element
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    assert.deepEqual(
      s.removed.filter((t) => t === "pointerdown" || t === "keydown"),
      ["pointerdown", "keydown"],
    );
  } finally {
    s.restore();
  }
});

test("touch tracking listens on every document a trigger lives in", () => {
  const state = createTooltipTriggerState();
  const other = document.implementation.createHTMLDocument("frame");
  const a = document.createElement("span");
  document.body.append(a);
  const b = other.createElement("span");
  other.body.append(b);
  const main = spy(document);
  const frame = spy(other);
  try {
    const enter = (el: Element) => ({ currentTarget: el, target: el, relatedTarget: null, pointerType: "mouse" }) as unknown as PointerEvent;
    tooltipTriggerPointerEnter(enter(a), {}, state);
    tooltipTriggerPointerEnter(enter(b), {}, createTooltipTriggerState());
    assert.ok(frame.added.includes("pointerup"), "the second document gets its own pointerup listener");
  } finally {
    main.restore();
    frame.restore();
    a.remove();
  }
});
