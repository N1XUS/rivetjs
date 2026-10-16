// DOM-target suite (happy-dom): `ChatLoader` (Rivet-authored; feature set inspired by HeroUI Pro's public ChatLoader docs):
// namespace parts, status roles / labels, skeleton lines + avatar toggle, line widths.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { ChatLoader, chatLoaderVariants } = await import("../src/components/chat-loader/index.ts");

test("chat-loader: namespace + variants", () => {
  assert.deepEqual(Object.keys(ChatLoader).sort(), ["Dots", "Pulse", "Skeleton", "SkeletonAvatar", "SkeletonBlock", "SkeletonLine", "Spinner"]);
  assert.equal(chatLoaderVariants().base(), "chat-loader");
});

test("chat-loader: loaders", () => {
  const r = render(() => (
    <div>
      <ChatLoader.Dots aria-label="Thinking" />
      <ChatLoader.Pulse />
      <ChatLoader.Skeleton lines={4} hideAvatar />
      <ChatLoader.SkeletonLine width="30%" />
    </div>
  ));
  const statuses = r.container.querySelectorAll("[role=status]");
  assert.equal(statuses.length, 3);
  assert.equal(statuses[0]!.getAttribute("aria-label"), "Thinking");
  assert.equal(statuses[1]!.getAttribute("aria-label"), "Loading");
  assert.equal(r.container.querySelectorAll("[data-slot=chat-loader] [data-slot=chat-loader-line]").length, 4);
  assert.equal(r.container.querySelector("[data-slot=chat-loader-avatar]"), null);
  const lines = r.container.querySelectorAll("[data-slot=chat-loader-line]");
  assert.equal((lines[lines.length - 1] as HTMLElement).style.width, "30%");
  r.unmount();
});
