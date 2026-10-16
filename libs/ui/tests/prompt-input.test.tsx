// DOM-target suite (happy-dom): `PromptInput` (Rivet-authored; feature set inspired by HeroUI Pro's public PromptInput
// docs): exports + nested Queue parts, typing writes the value (onValueChange), Send enables with text, Enter submits the
// text and clears an uncontrolled composer, Shift+Enter does not submit, IME Enter ignored, status accessor → stop label
// + onStop, lockInputOnRun disables the textarea while streaming.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { PromptInput, PromptInputRoot } = await import("../src/components/prompt-input/index.ts");
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

const type = (el: HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new W.Event("input", { bubbles: true }));
};
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  const event = new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
};

test("prompt-input: exports", () => {
  assert.equal(PromptInput, PromptInputRoot);
  assert.equal(typeof PromptInput.Queue.Item.Remove, "function");
  assert.equal(typeof PromptInput.Queue.List, "function");
});

test("prompt-input: type, Enter submits, clears", async () => {
  const values: string[] = [];
  const submitted: string[] = [];
  const r = render(() => (
    <PromptInput onValueChange={(v) => values.push(v)} onSubmit={(v) => submitted.push(v)}>
      <PromptInput.Shell>
        <PromptInput.TextArea />
        <PromptInput.Send />
      </PromptInput.Shell>
    </PromptInput>
  ));
  const textarea = r.container.querySelector("textarea")!;
  const send = r.container.querySelector("[data-slot=prompt-input-send]") as HTMLButtonElement;
  assert.equal(send.disabled, true);
  type(textarea, "Hello");
  await flush();
  assert.deepEqual(values, ["Hello"]);
  assert.equal(send.disabled, false);
  assert.equal(key(textarea, "Enter", { shiftKey: true }).defaultPrevented, false);
  assert.equal(key(textarea, "Enter", { isComposing: true }).defaultPrevented, false);
  assert.deepEqual(submitted, []);
  assert.equal(key(textarea, "Enter").defaultPrevented, true);
  await flush();
  assert.deepEqual(submitted, ["Hello"]);
  assert.equal(textarea.value, "");
  assert.equal(send.disabled, true);
  r.unmount();
});

test("prompt-input: run status → stop", async () => {
  const status = signal<"ready" | "streaming">("ready");
  let stopped = 0;
  const submitted: string[] = [];
  const r = render(() => (
    <PromptInput status={() => status()} defaultValue="Go" onSubmit={(v) => submitted.push(v)} onStop={() => stopped++}>
      <PromptInput.TextArea />
      <PromptInput.Send />
    </PromptInput>
  ));
  const textarea = r.container.querySelector("textarea")!;
  const send = r.container.querySelector("[data-slot=prompt-input-send]") as HTMLElement;
  assert.equal(send.getAttribute("aria-label"), "Send message");
  status.set("streaming");
  await flush();
  assert.equal(send.getAttribute("aria-label"), "Stop generating");
  assert.equal(send.getAttribute("data-status"), "streaming");
  assert.equal(textarea.disabled, true);
  press(send);
  assert.equal(stopped, 1);
  assert.deepEqual(submitted, []);
  status.set("ready");
  await flush();
  assert.equal(textarea.disabled, false);
  press(send);
  assert.deepEqual(submitted, ["Go"]);
  r.unmount();
});
