// `@rivetjs/cdk/chat` (Rivet-authored chat behaviour; feature set inspired by HeroUI Pro's public AI docs): composer keys,
// stick-to-bottom measurements (normal + column-reverse), accept filters, streamed text into a signal, simulated stream
// (fixed + jittered cadence), followHeight (pin, follow content height, release).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { signal } = await import("@rivetjs/reactivity");
const chat = await import("../chat/index.tsx");

const key = (init: Partial<KeyboardEvent>) => ({ key: "Enter", isComposing: false, keyCode: 13, altKey: false, shiftKey: false, ...init }) as KeyboardEvent;

test("chat: isSubmitKey", () => {
  assert.equal(chat.isSubmitKey(key({})), true);
  assert.equal(chat.isSubmitKey(key({ shiftKey: true })), false);
  assert.equal(chat.isSubmitKey(key({ shiftKey: true }), false), true);
  assert.equal(chat.isSubmitKey(key({ isComposing: true })), false);
  assert.equal(chat.isSubmitKey(key({ keyCode: 229 })), false);
  assert.equal(chat.isSubmitKey(key({ altKey: true })), false);
  assert.equal(chat.isSubmitKey(key({ key: "a" })), false);
});

test("chat: distanceFromBottom / syncAtBottom", () => {
  const el = document.createElement("div");
  document.body.append(el);
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 200 });
  el.scrollTop = 790;
  assert.equal(chat.distanceFromBottom(el), 10);
  assert.equal(chat.syncAtBottom(el), true);
  assert.equal(el.getAttribute("data-at-bottom"), "true");
  el.scrollTop = 100;
  assert.equal(chat.syncAtBottom(el), false);
  assert.equal(el.hasAttribute("data-at-bottom"), false);
  el.style.display = "flex";
  el.style.flexDirection = "column-reverse";
  el.scrollTop = -300;
  assert.equal(chat.distanceFromBottom(el), 300);
  let target: ScrollToOptions | undefined;
  el.scrollTo = ((o: ScrollToOptions) => (target = o)) as never;
  chat.scrollToBottom(el, "auto");
  assert.deepEqual(target, { top: 0, behavior: "auto" });
  el.setAttribute("data-chat-viewport", "");
  const child = document.createElement("span");
  el.append(child);
  assert.equal(chat.conversationViewportOf(child), el);
  el.remove();
});

test("chat: accept filters", () => {
  assert.equal(chat.acceptsFile({ name: "a.PNG", type: "image/png" }, "image/*"), true);
  assert.equal(chat.acceptsFile({ name: "a.pdf", type: "application/pdf" }, ".pdf,text/plain"), true);
  assert.equal(chat.acceptsFile({ name: "a.txt", type: "text/plain" }, ".pdf,text/plain"), true);
  assert.equal(chat.acceptsFile({ name: "a.zip", type: "application/zip" }, ".pdf,image/*"), false);
  assert.equal(chat.acceptsFile({ name: "a.zip", type: "" }, undefined), true);
  const files = [
    { name: "a.png", type: "image/png" },
    { name: "b.png", type: "image/png" },
  ] as unknown as File[];
  assert.equal(chat.selectedFiles(files, "image/*", false).length, 1);
  assert.equal(chat.selectedFiles(files, "image/*").length, 2);
  assert.deepEqual(chat.selectedFiles(null), []);
});

test("chat: simulateStream + streamText", async () => {
  const text = "Hello streaming world.\n\nDone";
  const chunks: string[] = [];
  for await (const chunk of chat.simulateStream(text, { interval: 0, wordsPerChunk: 2 })) chunks.push(chunk);
  assert.equal(chunks.join(""), text);
  assert.ok(chunks.length > 1);
  const target = signal("");
  const seen: string[] = [];
  const full = await chat.streamText(target, chat.simulateStream(text, { interval: 0 }), { onChunk: (t) => seen.push(t) });
  assert.equal(full, text);
  assert.equal(target(), text);
  assert.equal(seen[seen.length - 1], text);
  const bytes = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("ab"));
      c.enqueue(new TextEncoder().encode("c"));
      c.close();
    },
  });
  const t2 = signal("");
  assert.equal(await chat.streamText(t2, bytes), "abc");
  const abort = new AbortController();
  abort.abort();
  const chunks2: string[] = [];
  for await (const c of chat.simulateStream("a b c", { interval: 0, signal: abort.signal })) chunks2.push(c);
  assert.deepEqual(chunks2, []);
});

test("chat: simulateStream jitter varies chunk sizes, keeps the text", async () => {
  const text = "One two three four five. Six seven eight nine ten eleven twelve.";
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const chunks: string[] = [];
  for await (const chunk of chat.simulateStream(text, { interval: 0, wordsPerChunk: 2, jitter: 1, random })) chunks.push(chunk);
  assert.equal(chunks.join(""), text);
  const sizes = new Set(chunks.map((c) => c.trim().split(/\s+/).length));
  assert.ok(sizes.size > 1, `sizes ${[...sizes]}`);
});

test("chat: followHeight pins, eases toward the content height and releases it", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  let content = 20;
  // Content height = the contents' range box (happy-dom has no layout: the range is stubbed); frames run by hand at 60 fps.
  const createRange = document.createRange.bind(document);
  document.createRange = () => ({ selectNodeContents() {}, getBoundingClientRect: () => ({ bottom: content }) }) as unknown as Range;
  const raf = globalThis.requestAnimationFrame;
  let queue: FrameRequestCallback[] = [];
  let now = 0;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => queue.push(cb);
  const frames = (n: number): number[] => {
    const heights: number[] = [];
    for (let i = 0; i < n && queue.length; i++) {
      const run = queue;
      queue = [];
      now += 1000 / 60;
      run.forEach((cb) => cb(now));
      heights.push(parseFloat(el.style.height));
    }
    return heights;
  };
  try {
    const active = signal(true);
    const dispose = chat.followHeight(el, active);
    assert.equal(el.style.overflow, "clip");
    frames(60);
    content = 60;
    el.append(document.createElement("p"));
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver wakes the loop
    const heights = [20, ...frames(120)];
    const steps = heights.slice(1).map((h, i) => h - heights[i]!);
    assert.equal(Math.max(...steps) <= 4.01, true, `steps ${steps.join(",")}`);
    assert.equal(heights.at(-1), 60);
    active.set(false);
    frames(5);
    assert.equal(el.style.height, "");
    assert.equal(el.style.overflow, "");
    dispose();
  } finally {
    globalThis.requestAnimationFrame = raf;
    document.createRange = createRange;
    el.remove();
  }
});
