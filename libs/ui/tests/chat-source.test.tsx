// DOM-target suite (happy-dom): `ChatSource` / `ChatSources` (Rivet-authored; feature set inspired by HeroUI Pro's
// public ChatSource docs): exports, link pill (new tab, noopener), composable parts, grouped disclosure toggle.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatSource, ChatSourceRoot, ChatSources, ChatSourcesRoot } = await import("../src/components/chat-source/index.ts");
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

test("chat-source: exports", () => {
  assert.equal(ChatSource, ChatSourceRoot);
  assert.equal(ChatSources, ChatSourcesRoot);
});

test("chat-source: preset + composable", () => {
  const r = render(() => (
    <div>
      <ChatSource href="https://docs.rivet.dev/x" description="Docs" />
      <ChatSource href="https://a.dev">
        <ChatSource.Trigger>
          <ChatSource.Icon>
            <b>i</b>
          </ChatSource.Icon>
          <ChatSource.Title>Custom</ChatSource.Title>
        </ChatSource.Trigger>
      </ChatSource>
    </div>
  ));
  const [first, second] = r.container.querySelectorAll("a");
  assert.equal(first!.getAttribute("target"), "_blank");
  assert.equal(first!.getAttribute("rel"), "noopener noreferrer");
  assert.equal(first!.querySelector(".chat-source__title")!.textContent, "docs.rivet.dev");
  assert.equal(second!.querySelector(".chat-source__title")!.textContent, "Custom");
  assert.equal(second!.querySelector(".chat-source__icon b")!.textContent, "i");
  r.unmount();
});

test("chat-sources: toggle", async () => {
  const r = render(() => (
    <ChatSources>
      <ChatSources.Trigger>1 source</ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          <ChatSource href="https://a.dev" />
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
  ));
  const trigger = r.container.querySelector("[data-slot=chat-sources-trigger]") as HTMLElement;
  press(trigger);
  await flush();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  r.unmount();
});

test("chat-source: two sources in one paragraph each preview their own source (URL source without description too)", async () => {
  const r = render(() => (
    <p>
      Popovers <ChatSource href="https://developer.mozilla.org/docs/Web/API/Popover_API" title="Popover API" description="Top layer content." /> and anchoring{" "}
      <ChatSource href="https://www.w3.org/TR/css-anchor-position-1/" />.
    </p>
  ));
  const [first, second] = r.container.querySelectorAll<HTMLElement>("a.chat-source__trigger, .chat-source__trigger a, a");
  const previewText = () => [...document.querySelectorAll("[data-slot=chat-source-preview]")].map((el) => el.textContent ?? "");
  const show = async (el: HTMLElement) => {
    document.dispatchEvent(new W.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    el.focus();
    await new Promise((res) => setTimeout(res, 50));
  };
  await show(first!);
  assert.deepEqual(
    previewText().filter((t) => t.includes("Popover API")),
    previewText(),
  );
  assert.match(previewText().join(), /Top layer content\./);
  first!.blur();
  await flush();
  await show(second!);
  const texts = previewText();
  assert.equal(texts.length, 1);
  assert.match(texts[0]!, /www\.w3\.org/);
  assert.match(texts[0]!, /css-anchor-position-1/);
  r.unmount();
});
