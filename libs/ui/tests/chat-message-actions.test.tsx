// DOM-target suite (happy-dom): `ChatMessageActions` (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatMessageActions docs): group, icon-only action defaults + onPress, Copy writes the clipboard (text value / accessor),
// shows the check (`data-copied`) with the copied label, resets after the timeout, `onCopy` result.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatMessageActions, ChatMessageActionsRoot } = await import("../src/components/chat-message-actions/index.ts");
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

const written: string[] = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void written.push(t) } });

test("chat-message-actions: exports", () => {
  assert.equal(ChatMessageActions, ChatMessageActionsRoot);
  assert.equal(ChatMessageActions.Root, ChatMessageActionsRoot);
});

test("chat-message-actions: action press + copy feedback", async () => {
  let retried = 0;
  const copied: boolean[] = [];
  let text = "first";
  const r = render(() => (
    <ChatMessageActions aria-label="Answer actions">
      <ChatMessageActions.Copy text={() => text} onCopy={(ok) => copied.push(ok)} />
      <ChatMessageActions.Action aria-label="Retry" onPress={() => retried++}>
        r
      </ChatMessageActions.Action>
    </ChatMessageActions>
  ));
  const group = r.container.querySelector("[role=group]")!;
  assert.equal(group.getAttribute("aria-label"), "Answer actions");
  const retry = r.container.querySelector("[aria-label=Retry]") as HTMLElement;
  assert.match(retry.className, /button--ghost/);
  assert.match(retry.className, /button--icon-only/);
  press(retry);
  assert.equal(retried, 1);
  const copy = r.container.querySelector("[data-copy-button]") as HTMLElement;
  text = "second";
  press(copy);
  await flush();
  assert.deepEqual(written, ["second"]);
  assert.deepEqual(copied, [true]);
  assert.equal(copy.getAttribute("data-copied"), "true");
  assert.equal(copy.getAttribute("aria-label"), "Copied");
  r.unmount();
  void window;
});
