import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { StreamingText } = await import("../src/components/streaming-text/index.ts");
const { Markdown } = await import("../src/components/markdown/index.ts");

afterEach(() => vi.unstubAllGlobals());

function frames() {
  let now = 0;
  let id = 0;
  const queue = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("performance", { now: () => now });
  // Layout growth is covered in production browser tests, not happy-dom's layout-free DOM.
  vi.stubGlobal("MutationObserver", undefined);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => (queue.set(++id, fn), id));
  vi.stubGlobal("cancelAnimationFrame", (key: number) => queue.delete(key));
  return async (ms: number) => {
    now += ms;
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((fn) => fn(now));
    await flush();
  };
}

test("streaming text: append reveals inside a word, keeps existing nodes and finishes after input ends", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <StreamingText content={text} isStreaming={running} speed={20} />);
  await flush();
  const root = r.container.querySelector("[data-slot=streaming-text]")!;
  text.set("Hello");
  await flush();
  assert.equal(root.textContent, "");
  await step(50);
  assert.equal(root.textContent, "H");
  const first = root.querySelector(".streaming-text__character");
  running.set(false);
  await step(240);
  assert.equal(root.textContent, "Hello");
  assert.equal(root.querySelector(".streaming-text__character") === first, true);
  assert.equal(root.hasAttribute("data-revealing"), false);
  assert.equal(root.hasAttribute("aria-live"), false);
  r.unmount();
});

test("markdown: the display queue drains with formatting after isStreaming becomes false", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <Markdown content={text} isStreaming={running} streamingSpeed={20} />);
  await flush();
  const root = r.container.querySelector("[data-slot=markdown]")!;
  text.set("**Hello**");
  await flush();
  assert.equal(root.textContent, "");
  await step(80);
  assert.notEqual(root.textContent, "Hello");
  running.set(false);
  await flush();
  assert.equal(root.getAttribute("data-streaming"), "true");
  await step(240);
  assert.equal(root.textContent, "Hello");
  assert.equal(root.querySelector("strong")?.textContent, "Hello");
  assert.equal(root.querySelector(".markdown__caret"), null);
  r.unmount();
});

test("streaming text: resetting initial text gives new letters their entrance without replaying old text", async () => {
  const step = frames();
  const text = signal("Existing");
  const r = render(() => <StreamingText content={text} isStreaming speed={20} />);
  await flush();
  const root = r.container.querySelector("[data-slot=streaming-text]")!;
  assert.equal(root.querySelectorAll("[data-new]").length, 0);
  text.set("");
  await flush();
  text.set("Hi");
  await flush();
  await step(50);
  assert.equal(root.textContent, "H");
  assert.equal(root.querySelectorAll("[data-new]").length, 1);
  r.unmount();
});

test("markdown: live scalar props use the same pacing as accessors", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <Markdown content={text()} isStreaming={running()} streamingSpeed={20} />);
  await flush();
  const root = r.container.querySelector("[data-slot=markdown]")!;
  text.set("Hello");
  await flush();
  assert.equal(root.textContent, "");
  await step(50);
  assert.equal(root.textContent, "H");
  r.unmount();
});
