// DOM-target suite (happy-dom): `ChatMessage` (Rivet-authored; feature set inspired by HeroUI Pro's public ChatMessage
// docs): namespace, roles + actions visibility, avatar fallback / hidden column, parts + caller classes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatMessage, chatMessageVariants } = await import("../src/components/chat-message/index.ts");

test("chat-message: namespace + variants", () => {
  for (const part of ["Assistant", "User", "Avatar", "Body", "Bubble", "Content", "Actions", "Meta"])
    assert.equal(typeof (ChatMessage as Record<string, unknown>)[part], "function", part);
  assert.equal(chatMessageVariants().base(), "chat-message");
});

test("chat-message: assistant + user markup", () => {
  const r = render(() => (
    <div>
      <ChatMessage.Assistant actionsVisibility="hover" class="a">
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <ChatMessage.Content>Answer</ChatMessage.Content>
          <ChatMessage.Meta>gpt</ChatMessage.Meta>
        </ChatMessage.Body>
      </ChatMessage.Assistant>
      <ChatMessage.User>
        <ChatMessage.Bubble class="b">Question</ChatMessage.Bubble>
      </ChatMessage.User>
    </div>
  ));
  const [assistant, user] = r.container.querySelectorAll("[data-slot=chat-message]");
  assert.equal(assistant!.getAttribute("data-role"), "assistant");
  assert.equal(assistant!.getAttribute("data-actions"), "hover");
  assert.match(assistant!.className, /\bchat-message\b.*\ba\b/);
  assert.equal(user!.getAttribute("data-role"), "user");
  assert.equal(user!.getAttribute("data-actions"), "hover");
  assert.match(r.container.querySelector("[data-slot=chat-message-avatar]")!.textContent!, /AI/);
  assert.equal(r.container.querySelector("[data-slot=chat-message-bubble]")!.className, "chat-message__bubble b");
  assert.equal(r.container.querySelector("[data-slot=chat-message-meta]")!.textContent, "gpt");
  r.unmount();
});
