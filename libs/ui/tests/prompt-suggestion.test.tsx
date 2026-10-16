// DOM-target suite (happy-dom): `PromptSuggestion` (Rivet-authored; feature set inspired by HeroUI Pro's public
// PromptSuggestion docs): exports, variants via context (pill / card), item press.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { PromptSuggestion, PromptSuggestionRoot } = await import("../src/components/prompt-suggestion/index.ts");
const W = window as unknown as {
  PointerEvent: typeof PointerEvent;
  MouseEvent: typeof MouseEvent;
  KeyboardEvent: typeof KeyboardEvent;
  Event: typeof Event;
  InputEvent: typeof InputEvent;
};
const press = (el: Element) => {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
};
const flush = () => new Promise((r) => setTimeout(r, 20));

test("prompt-suggestion: exports", () => {
  assert.equal(PromptSuggestion, PromptSuggestionRoot);
  assert.equal(PromptSuggestion.Root, PromptSuggestionRoot);
});

test("prompt-suggestion: card variant + press", () => {
  const picked: string[] = [];
  const r = render(() => (
    <PromptSuggestion variant="card">
      <PromptSuggestion.Items>
        <PromptSuggestion.Item onPress={() => picked.push("plan")}>
          <PromptSuggestion.ItemTitle>Plan</PromptSuggestion.ItemTitle>
          <PromptSuggestion.ItemMeta>2 min</PromptSuggestion.ItemMeta>
        </PromptSuggestion.Item>
      </PromptSuggestion.Items>
    </PromptSuggestion>
  ));
  const root = r.container.querySelector("[data-slot=prompt-suggestion]")!;
  assert.equal(root.getAttribute("data-variant"), "card");
  const item = r.container.querySelector("button")!;
  assert.match(item.className, /prompt-suggestion__item/);
  press(item);
  assert.deepEqual(picked, ["plan"]);
  assert.match(r.container.querySelector("[data-slot=prompt-suggestion-item-meta]")!.className, /prompt-suggestion__item-meta/);
  r.unmount();
});
