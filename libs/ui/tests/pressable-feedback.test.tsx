// DOM-target suite: PressableFeedback (Rivet addition): a press drives the layers — ripple `data-pressed` + position variables,
// hold confirm `data-holding` then `data-complete` + `onComplete` after `duration` (and reset on release), a short hold snaps back
// without completing, progress feedback `data-progressing` → `data-complete` → reset (`onComplete` / `onReset`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { PressableFeedback } = await import("../src/components/pressable-feedback/index.ts");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
const opts = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true, clientX: 5, clientY: 5 };
const down = (el: Element) => el.dispatchEvent(new W.PointerEvent("pointerdown", opts));
const up = (el: Element) => {
  el.dispatchEvent(new W.PointerEvent("pointerup", opts));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
};

test("pressable feedback: ripple and hold confirm", async () => {
  let completed = 0;
  const { container, unmount } = render(() => (
    <PressableFeedback>
      <PressableFeedback.Ripple minimumPressDuration={0} />
      <PressableFeedback.HoldConfirm duration={60} onComplete={() => completed++} />
      Hold
    </PressableFeedback>
  ));
  await wait(10);
  const root = container.querySelector("button")!;
  const ripple = container.querySelector(".pressable-feedback__ripple") as HTMLElement;
  const hold = container.querySelector(".pressable-feedback__hold-confirm")!;
  down(root);
  assert.equal(ripple.getAttribute("data-pressed"), "true");
  assert.ok(ripple.style.getPropertyValue("--pressable-feedback-ripple-size"));
  assert.equal(hold.getAttribute("data-holding"), "true");
  await wait(100);
  assert.equal(completed, 1);
  assert.equal(hold.getAttribute("data-complete"), "true");
  up(root);
  await wait(10);
  assert.equal(hold.hasAttribute("data-complete"), false);
  assert.equal(ripple.getAttribute("data-released"), "true");
  // A short hold snaps back.
  down(root);
  await wait(10);
  up(root);
  await wait(80);
  assert.equal(completed, 1);
  assert.equal(hold.hasAttribute("data-holding"), false);
  unmount();
});

test("pressable feedback: progress feedback completes and resets", async () => {
  const log: string[] = [];
  const { container, unmount } = render(() => (
    <PressableFeedback>
      <PressableFeedback.ProgressFeedback duration={40} resetDelay={40} onComplete={() => log.push("complete")} onReset={() => log.push("reset")} />
      Send
    </PressableFeedback>
  ));
  await wait(10);
  const root = container.querySelector("button")!;
  const layer = container.querySelector(".pressable-feedback__progress-feedback")!;
  down(root);
  up(root);
  assert.equal(layer.getAttribute("data-progressing"), "true");
  await wait(60);
  assert.equal(layer.getAttribute("data-complete"), "true");
  assert.deepEqual(log, ["complete"]);
  await wait(60);
  assert.equal(layer.hasAttribute("data-complete"), false);
  assert.deepEqual(log, ["complete", "reset"]);
  unmount();
});
