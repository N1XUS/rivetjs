// DOM-target suite (happy-dom): `ChainOfThought` (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChainOfThought docs): exports, trigger toggles the panel, `isStreaming` accessor → `data-streaming`, step statuses.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ChainOfThought, ChainOfThoughtRoot, chainOfThoughtVariants } = await import("../src/components/chain-of-thought/index.ts");
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

test("chain-of-thought: exports + variants", () => {
  assert.equal(ChainOfThought, ChainOfThoughtRoot);
  assert.equal(chainOfThoughtVariants().base(), "chain-of-thought");
});

test("chain-of-thought: toggle + streaming", async () => {
  const streaming = signal(true);
  const r = render(() => (
    <ChainOfThought isStreaming={() => streaming()}>
      <ChainOfThought.Trigger>Thinking</ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          <ChainOfThought.Step label="Search" status="error" />
        </ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
  ));
  const root = r.container.querySelector("[data-chain-of-thought]")!;
  assert.equal(root.getAttribute("data-streaming"), "true");
  const trigger = r.container.querySelector("[data-slot=chain-of-thought-trigger]") as HTMLElement;
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  press(trigger);
  await flush();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  streaming.set(false);
  await flush();
  assert.equal(root.getAttribute("data-streaming"), null);
  assert.equal(r.container.querySelector("[role=listitem]")!.getAttribute("data-status"), "error");
  r.unmount();
});
