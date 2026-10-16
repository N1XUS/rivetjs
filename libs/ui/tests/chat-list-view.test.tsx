// DOM-target suite (happy-dom): `ChatListView` (Rivet-authored; feature set inspired by HeroUI Pro's public ChatListView
// docs): exports, link / button items, reactive `isCurrent` (accessor) → `data-current` + `aria-current`, press.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ChatListView, ChatListViewRoot } = await import("../src/components/chat-list-view/index.ts");
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

test("chat-list-view: exports", () => {
  assert.equal(ChatListView, ChatListViewRoot);
});

test("chat-list-view: current item follows a signal", async () => {
  const current = signal("a");
  const r = render(() => (
    <ChatListView aria-label="History">
      <ChatListView.Item isCurrent={() => current() === "a"} onPress={() => current.set("a")}>
        <ChatListView.Title>A</ChatListView.Title>
      </ChatListView.Item>
      <ChatListView.Item isCurrent={() => current() === "b"} onPress={() => current.set("b")}>
        <ChatListView.Title>B</ChatListView.Title>
      </ChatListView.Item>
    </ChatListView>
  ));
  const [a, b] = r.container.querySelectorAll("button");
  assert.equal(a!.getAttribute("data-current"), "true");
  assert.equal(a!.getAttribute("aria-current"), "true");
  assert.equal(b!.getAttribute("data-current"), null);
  press(b!);
  await flush();
  assert.equal(b!.getAttribute("data-current"), "true");
  assert.equal(a!.getAttribute("data-current"), null);
  r.unmount();
});
