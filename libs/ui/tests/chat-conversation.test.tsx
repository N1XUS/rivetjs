// DOM-target suite (happy-dom): `ChatConversation` (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatConversation docs): exports, scroll handler syncs `data-at-bottom`, scroll button scrolls the viewport to the end.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatConversation, ChatConversationRoot } = await import("../src/components/chat-conversation/index.ts");
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

test("chat-conversation: exports", () => {
  assert.equal(ChatConversation, ChatConversationRoot);
});

test("chat-conversation: at-bottom sync + scroll button", () => {
  const r = render(() => (
    <ChatConversation scrollButton>
      <ChatConversation.Content>m</ChatConversation.Content>
      <ChatConversation.ScrollButton behavior="auto" />
    </ChatConversation>
  ));
  const viewport = r.container.querySelector("[data-chat-viewport]") as HTMLElement;
  assert.equal(viewport.getAttribute("data-at-bottom"), "true");
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
  viewport.scrollTop = 0;
  viewport.dispatchEvent(new W.Event("scroll"));
  assert.equal(viewport.getAttribute("data-at-bottom"), null);
  let target: ScrollToOptions | undefined;
  viewport.scrollTo = ((options: ScrollToOptions) => (target = options)) as never;
  press(r.container.querySelector("[data-slot=chat-conversation-scroll-button]")!);
  assert.deepEqual(target, { top: 1000, behavior: "auto" });
  r.unmount();
});

test("chat-conversation: without scrollButton the root has no scroll handler", () => {
  const r = render(() => (
    <ChatConversation>
      <ChatConversation.Content>m</ChatConversation.Content>
    </ChatConversation>
  ));
  const viewport = r.container.querySelector("[data-chat-viewport]") as HTMLElement;
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
  viewport.scrollTop = 0;
  viewport.dispatchEvent(new W.Event("scroll"));
  assert.equal(viewport.getAttribute("data-at-bottom"), "true");
  r.unmount();
});
