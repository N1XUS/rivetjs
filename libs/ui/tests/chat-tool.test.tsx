// DOM-target suite (happy-dom): `ChatTool` / `ChatToolGroup` (Rivet-authored; feature set inspired by HeroUI Pro's public
// ChatTool docs): exports, approval buttons call onApprove / onReject, argsText wins over input, composable parts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatTool, ChatToolRoot, ChatToolGroup, ChatToolGroupRoot } = await import("../src/components/chat-tool/index.ts");
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

test("chat-tool: exports", () => {
  assert.equal(ChatTool, ChatToolRoot);
  assert.equal(ChatToolGroup, ChatToolGroupRoot);
});

test("chat-tool: approval", () => {
  const calls: string[] = [];
  const r = render(() => (
    <ChatTool
      toolName="deploy"
      state="requires-action"
      argsText='{"env": "prod"'
      onApprove={() => calls.push("approve")}
      onReject={() => calls.push("reject")}
    />
  ));
  assert.match(r.container.querySelector(".chat-tool__args code")!.textContent!, /"env": "prod"/);
  const buttons = [...r.container.querySelectorAll(".chat-tool__approval-actions button")];
  press(buttons[0]!);
  press(buttons[1]!);
  assert.deepEqual(calls, ["reject", "approve"]);
  r.unmount();
});

test("chat-tool: composable", () => {
  const r = render(() => (
    <ChatTool state="output-error" toolName="x" defaultExpanded>
      <ChatTool.Trigger>
        <ChatTool.StatusIcon />
        Custom
      </ChatTool.Trigger>
      <ChatTool.Content>
        <ChatTool.Error>Nope</ChatTool.Error>
      </ChatTool.Content>
    </ChatTool>
  ));
  assert.equal(r.container.querySelector("[data-slot=chat-tool-status-icon]")!.getAttribute("aria-label"), "Failed");
  assert.equal(r.container.querySelector("[role=alert]")!.textContent, "Nope");
  r.unmount();
});
