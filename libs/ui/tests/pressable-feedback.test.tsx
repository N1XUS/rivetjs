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

test("pressable feedback: standalone ripple follows its parent ui Button (pointer, keyboard, disabled)", async () => {
  const { Button } = await import("../src/components/button/index.ts");
  const W2 = window as unknown as { KeyboardEvent: typeof KeyboardEvent };
  const { container, unmount } = render(() => (
    <div>
      <Button id="on" variant="secondary">
        <PressableFeedback.Ripple minimumPressDuration={0} />
        Ripple
      </Button>
      <Button id="off" isDisabled>
        <PressableFeedback.Ripple />
        Off
      </Button>
    </div>
  ));
  await wait(10);
  const button = container.querySelector("#on")!;
  const ripple = button.querySelector("[data-slot=pressable-feedback-ripple]") as HTMLElement;
  down(button);
  assert.equal(ripple.getAttribute("data-pressed"), "true");
  assert.ok(ripple.style.getPropertyValue("--pressable-feedback-ripple-size"));
  up(button);
  await wait(10);
  assert.equal(ripple.getAttribute("data-released"), "true");
  // Space: centred, released by the key going up.
  (button as HTMLElement).focus();
  button.dispatchEvent(new W2.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  assert.equal(ripple.hasAttribute("data-released"), false);
  assert.equal(ripple.getAttribute("data-pressed"), "true");
  button.dispatchEvent(new W2.KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
  await wait(10);
  assert.equal(ripple.getAttribute("data-released"), "true");
  // A disabled parent gets no ripple.
  const off = container.querySelector("#off")!;
  down(off);
  assert.equal(off.querySelector("[data-slot=pressable-feedback-ripple]")!.hasAttribute("data-pressed"), false);
  unmount();
});

test("pressable feedback: standalone ripple in selectable cards follows the card press and Space on its hidden input", async () => {
  const { CheckboxButtonGroup } = await import("../src/components/checkbox-button-group/index.ts");
  const { RadioButtonGroup } = await import("../src/components/radio-button-group/index.ts");
  const W2 = window as unknown as { KeyboardEvent: typeof KeyboardEvent };
  const key = (el: Element, type: string, k: string) => el.dispatchEvent(new W2.KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
  const { container, unmount } = render(() => (
    <div>
      <CheckboxButtonGroup aria-label="Checks">
        <CheckboxButtonGroup.Item value="a">
          <PressableFeedback.Ripple minimumPressDuration={0} />A
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="off" isDisabled>
          <PressableFeedback.Ripple minimumPressDuration={0} />
          Off
        </CheckboxButtonGroup.Item>
      </CheckboxButtonGroup>
      <RadioButtonGroup aria-label="Radios">
        <RadioButtonGroup.Item value="r">
          <PressableFeedback.Ripple minimumPressDuration={0} />R
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
    </div>
  ));
  await wait(10);
  for (const slot of ["checkbox-button-group-item", "radio-button-group-item"]) {
    const card = container.querySelector(`[data-slot=${slot}]`)!;
    const ripple = card.querySelector("[data-slot=pressable-feedback-ripple]") as HTMLElement;
    assert.equal(ripple.parentElement, card, `${slot}: the ripple sits in the card`);
    down(card);
    assert.equal(ripple.getAttribute("data-pressed"), "true", `${slot}: pointer`);
    up(card);
    await wait(10);
    assert.equal(ripple.getAttribute("data-released"), "true");
    // Keyboard focus sits on the hidden input: Space there ripples the card (centred), the key going up releases it.
    const input = card.querySelector("input")!;
    input.focus();
    key(input, "keydown", "Enter");
    assert.equal(ripple.hasAttribute("data-released"), true, `${slot}: Enter does not press an input`);
    key(input, "keydown", " ");
    assert.equal(ripple.hasAttribute("data-released"), false, `${slot}: Space`);
    assert.equal(ripple.getAttribute("data-pressed"), "true");
    key(input, "keyup", " ");
    await wait(10);
    assert.equal(ripple.getAttribute("data-released"), "true");
  }
  // A disabled card gets none.
  const off = container.querySelectorAll("[data-slot=checkbox-button-group-item]")[1]!;
  down(off);
  key(off.querySelector("input")!, "keydown", " ");
  assert.equal(off.querySelector("[data-slot=pressable-feedback-ripple]")!.hasAttribute("data-pressed"), false);
  unmount();
});

test("pressable feedback: a touch press that turns into a scroll shows no ripple; a touch tap shows one", async () => {
  const { Button } = await import("../src/components/button/index.ts");
  const touch = { ...opts, pointerType: "touch" };
  const tdown = (el: Element) => el.dispatchEvent(new W.PointerEvent("pointerdown", touch));
  const tcancel = (el: Element) => el.dispatchEvent(new W.PointerEvent("pointercancel", touch));
  const tup = (el: Element) => {
    el.dispatchEvent(new W.PointerEvent("pointerup", touch));
    el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
  };
  const { container, unmount } = render(() => (
    <div>
      <PressableFeedback id="root">
        <PressableFeedback.Ripple minimumPressDuration={0} />
        Root
      </PressableFeedback>
      <Button id="standalone" variant="secondary">
        <PressableFeedback.Ripple minimumPressDuration={0} />
        Standalone
      </Button>
    </div>
  ));
  await wait(10);
  for (const id of ["root", "standalone"]) {
    const host = container.querySelector(`#${id}`)!;
    const ripple = host.querySelector("[data-slot=pressable-feedback-ripple]") as HTMLElement;
    let starts = 0;
    const observer = new window.MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "data-pressed" && ripple.hasAttribute("data-pressed")) starts++;
    });
    observer.observe(ripple as never, { attributes: true });
    // The browser takes the touch over for a scroll (pointercancel) right after it went down: no ripple flash.
    tdown(host);
    await wait(10);
    tcancel(host);
    await wait(150);
    await Promise.resolve();
    assert.equal(ripple.hasAttribute("data-pressed"), false, `${id}: a scroll start must not flash a ripple`);
    assert.equal(starts, 0, `${id}: no ripple start for a scroll`);
    // A quick tap (released before the touch delay): one ripple, released afterwards.
    tdown(host);
    await wait(10);
    tup(host);
    await wait(20);
    assert.equal(ripple.getAttribute("data-pressed"), "true", `${id}: a tap ripples`);
    assert.equal(ripple.getAttribute("data-released"), "true", `${id}: and releases`);
    // A held touch ripples once the delay passed, before the release.
    tdown(host);
    await wait(150);
    assert.equal(ripple.hasAttribute("data-released"), false, `${id}: held`);
    tup(host);
    await wait(20);
    assert.equal(ripple.getAttribute("data-released"), "true");
    observer.disconnect();
    await Promise.resolve();
    assert.equal(starts > 0, true);
  }
  unmount();
});

test("pressable feedback: timers and standalone listeners stop when the layer unmounts", async () => {
  const log: string[] = [];
  const { container, unmount } = render(() => (
    <PressableFeedback>
      <PressableFeedback.HoldConfirm duration={40} onComplete={() => log.push("hold")} />
      <PressableFeedback.ProgressFeedback duration={40} resetDelay={10} onComplete={() => log.push("progress")} onReset={() => log.push("reset")} />
      Go
    </PressableFeedback>
  ));
  await wait(10);
  const root = container.querySelector("button")!;
  down(root);
  up(root);
  down(root);
  unmount();
  await wait(100);
  assert.deepEqual(log, [], "no callback after unmount");

  const { Button } = await import("../src/components/button/index.ts");
  const doc = window.document as unknown as Document;
  const signals: AbortSignal[] = [];
  const add = doc.addEventListener.bind(doc);
  doc.addEventListener = ((type: string, fn: EventListener, o?: { signal?: AbortSignal }) => {
    if (o?.signal) signals.push(o.signal);
    return add(type, fn, o as never);
  }) as never;
  const view = render(() => (
    <Button>
      <PressableFeedback.Ripple />
      Ripple
    </Button>
  ));
  await wait(10);
  doc.addEventListener = add as never;
  assert.ok(signals.length > 0, "the standalone ripple listens on the document");
  view.unmount();
  assert.ok(
    signals.every((signal) => signal.aborted),
    "its document listeners are removed on unmount, not on the next event",
  );
});
