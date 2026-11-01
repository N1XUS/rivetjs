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

test("markdown: identical input uses StreamingText characters and marks only appended text for animation", async () => {
  const step = frames();
  const text = signal("Existing");
  const running = signal(true);
  const r = render(() => (
    <div>
      <StreamingText id="plain-parity" content={text} isStreaming={running} speed={20} />
      <Markdown id="markdown-parity" content={text} isStreaming={running} streamingSpeed={20} />
    </div>
  ));
  await flush();
  const plain = r.container.querySelector("#plain-parity")!;
  const markdown = r.container.querySelector("#markdown-parity")!;
  assert.equal(markdown.querySelectorAll(".streaming-text__character").length, plain.querySelectorAll(".streaming-text__character").length);
  assert.equal(markdown.querySelectorAll("[data-new]").length, 0);
  text.set("Existing Hello");
  await flush();
  await step(100);
  assert.equal(markdown.textContent, plain.textContent);
  assert.equal(markdown.querySelectorAll(".streaming-text__character[data-new]").length, plain.querySelectorAll(".streaming-text__character[data-new]").length);
  assert.ok(markdown.querySelector(".streaming-text__character[data-new]"));
  const first = markdown.querySelector(".streaming-text__character");
  running.set(false);
  await step(240);
  assert.equal(markdown.textContent, plain.textContent);
  assert.equal(markdown.querySelectorAll(".streaming-text__character").length, plain.querySelectorAll(".streaming-text__character").length);
  assert.equal(markdown.querySelector(".streaming-text__character") === first, true, "finishing input must not replace glyphs and cut their fades short");
  r.unmount();
});

test("markdown: formatted inline text also uses the shared character renderer", async () => {
  const step = frames();
  const text = signal("");
  const r = render(() => <Markdown content={text} isStreaming />);
  await flush();
  text.set("**bold** and `code`");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("strong")?.textContent, "bold");
  assert.equal(r.container.querySelectorAll("strong .streaming-text__character[data-new]").length, 4);
  assert.equal(r.container.querySelectorAll("code .streaming-text__character[data-new]").length, 4);
  r.unmount();
});

test("markdown: a completed paragraph keeps its glyphs while later blocks stream", async () => {
  const step = frames();
  const text = signal("");
  const r = render(() => <Markdown content={text} isStreaming />);
  await flush();
  text.set("First");
  await flush();
  await step(240);
  const first = r.container.querySelector("p")!;
  const glyph = first.querySelector(".streaming-text__character");
  text.set("First\n\nSecond");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("p") === first, true);
  assert.equal(first.querySelector(".streaming-text__character") === glyph, true);
  assert.equal(r.container.querySelectorAll(".markdown__caret").length, 1);
  assert.equal(r.container.querySelectorAll("p")[1]?.textContent, "Second");
  r.unmount();
});

test("markdown: retained tables follow appended cells and rows through completion", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <Markdown content={text} isStreaming={running} />);
  await flush();
  text.set("| Name |\n| --- |\n| A |");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("td")?.textContent, "A");
  text.set("| Name |\n| --- |\n| Alice |\n| Bob |");
  await flush();
  await step(240);
  running.set(false);
  await flush();
  assert.deepEqual(
    [...r.container.querySelectorAll("td")].map((cell) => cell.textContent),
    ["Alice", "Bob"],
  );
  r.unmount();
});

test("markdown: retained task lists keep checkboxes and update their checked state", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <Markdown content={text} isStreaming={running} />);
  await flush();
  text.set("- [ ] First");
  await flush();
  await step(240);
  assert.equal(r.container.querySelectorAll("li[data-task] input[type=checkbox]").length, 1);
  text.set("- [x] First\n- [ ] Second");
  await flush();
  await step(240);
  running.set(false);
  await flush();
  const boxes = [...r.container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
  assert.deepEqual(
    boxes.map((box) => box.checked),
    [true, false],
  );
  assert.ok(boxes.every((box) => box.disabled));
  assert.equal(r.container.querySelector("ul")?.getAttribute("data-task"), "true");
  r.unmount();
});

test("markdown: retained lists follow loose paragraph layout and ordered start changes", async () => {
  const step = frames();
  const text = signal("");
  const r = render(() => <Markdown content={text} isStreaming />);
  await flush();
  text.set("1. First");
  await flush();
  await step(240);
  text.set("1. First\n\n   Second paragraph");
  await flush();
  await step(240);
  assert.deepEqual(
    [...r.container.querySelectorAll("li p")].map((p) => p.textContent),
    ["First", "Second paragraph"],
  );
  text.set("3. Replacement");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("ol")?.getAttribute("start"), "3");
  r.unmount();
});

test("markdown: retained image nodes follow source replacement", async () => {
  const step = frames();
  const text = signal("");
  const r = render(() => <Markdown content={text} isStreaming />);
  await flush();
  text.set("![old](https://example.com/old.png)");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("img")?.getAttribute("alt"), "old");
  text.set("![new](https://example.com/new.png)");
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("img")?.getAttribute("alt"), "new");
  assert.equal(r.container.querySelector("img")?.getAttribute("src"), "https://example.com/new.png");
  r.unmount();
});

test("markdown: retained links preserve and update their title", async () => {
  const step = frames();
  const text = signal("");
  const running = signal(true);
  const r = render(() => <Markdown content={text} isStreaming={running} />);
  await flush();
  text.set('[Link](https://example.com "First title")');
  await flush();
  await step(240);
  running.set(false);
  await flush();
  assert.equal(r.container.querySelector("a")?.title, "First title");
  text.set('[Link](https://example.com "New title")');
  await flush();
  await step(240);
  assert.equal(r.container.querySelector("a")?.title, "New title");
  r.unmount();
});
