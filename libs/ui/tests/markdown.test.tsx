// DOM-target suite (happy-dom): `Markdown` (Rivet-authored; feature set inspired by HeroUI Pro's public Markdown docs):
// exports, streaming from a signal keeps finished blocks' DOM (only the written block re-renders), caret only while
// streaming, open marks repaired, unsafe URLs dropped, fenced code → CodeBlock; live tail: a chunk only appends word
// spans (MutationObserver: no node removed), an open fence streams as words and is highlighted once closed (one code block, no stale tail copy).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Markdown, MarkdownRoot, markdownVariants } = await import("../src/components/markdown/index.ts");
const flush = () => new Promise((r) => setTimeout(r, 20));

test("markdown: exports + variants", () => {
  assert.equal(Markdown, MarkdownRoot);
  assert.equal(markdownVariants().base(), "markdown");
});

test("markdown: streaming keeps finished blocks", async () => {
  const text = signal("# Plan\n\nFirst **bo");
  const streaming = signal(true);
  const r = render(() => <Markdown streamingSpeed={0} content={() => text()} isStreaming={() => streaming()} />);
  const root = r.container.querySelector("[data-slot=markdown]")!;
  assert.equal(root.getAttribute("data-streaming"), "true");
  const heading = root.querySelector("h1")!;
  assert.equal(root.querySelector("strong")!.textContent, "bo");
  assert.ok(root.querySelector("p .markdown__caret"));
  text.set("# Plan\n\nFirst **bold** done.\n\n- one");
  await flush();
  assert.equal(root.querySelector("h1"), heading, "finished heading node kept");
  assert.equal(root.querySelector("p")!.textContent, "First bold done.");
  assert.ok(root.querySelector("li .markdown__caret"));
  assert.equal(root.querySelectorAll(".markdown__caret").length, 1);
  streaming.set(false);
  await flush();
  assert.equal(root.getAttribute("data-streaming"), null);
  assert.equal(root.querySelectorAll(".markdown__caret").length, 0);
  assert.equal(root.querySelector("h1"), heading);
  r.unmount();
});

test("markdown: safety + code blocks", () => {
  const r = render(() => <Markdown streamingSpeed={0} content={"[x](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n```py\nprint(1)\n```"} />);
  assert.equal(r.container.querySelector("a"), null);
  assert.equal(r.container.querySelector("img"), null);
  assert.match(r.container.textContent!, /<img src=x onerror=alert\(1\)>/);
  assert.ok(r.container.querySelector(".code-block .code-block__token--function, .code-block .code-block__token--keyword"));
  assert.match(r.container.querySelector(".code-block__language")!.textContent!, /Python/);
  r.unmount();
});

test("markdown: live tail appends words, existing nodes kept", async () => {
  const text = signal("Resumable pages");
  const streaming = signal(true);
  const r = render(() => <Markdown streamingSpeed={0} content={() => text()} isStreaming={() => streaming()} />);
  const root = r.container.querySelector("[data-slot=markdown]")!;
  const paragraph = root.querySelector("p")!;
  assert.equal(paragraph.classList.contains("markdown__live"), true);
  const firstWords = [...root.querySelectorAll(".markdown__character")];
  assert.equal(firstWords.map((w) => w.textContent).join(""), "Resumable pages");
  const removed: Node[] = [];
  const observer = new MutationObserver((records) => records.forEach((record) => removed.push(...record.removedNodes)));
  observer.observe(root, { subtree: true, childList: true });
  text.set("Resumable pages skip **hydra");
  await flush();
  text.set("Resumable pages skip **hydration** entirely");
  await flush();
  observer.disconnect();
  // Booleans / strings only: a failing assert on DOM nodes would deep-inspect the whole happy-dom graph.
  assert.equal(removed.map((node) => `${node.nodeName}:${node.textContent}`).join("|"), "");
  assert.equal(root.querySelector("p") === paragraph, true);
  assert.equal(root.querySelectorAll(".markdown__character")[0] === firstWords[0], true);
  assert.equal(paragraph.querySelector("strong")!.textContent, "hydration");
  assert.match(paragraph.textContent!, /^Resumable pages skip hydration entirely/);
  assert.equal(paragraph.querySelector(".markdown__caret") !== null, true);
  streaming.set(false);
  await flush();
  assert.equal(root.querySelector(".markdown__caret") === null, true);
  assert.equal(root.querySelector(".markdown__character") === null, true);
  assert.equal(root.querySelector("p")!.textContent, "Resumable pages skip hydration entirely");
  r.unmount();
});

test("markdown: open fence streams as words, highlighted when closed", async () => {
  const text = signal("Intro\n\n```ts\nconst a");
  const r = render(() => <Markdown streamingSpeed={0} content={() => text()} isStreaming={() => true} />);
  const root = r.container.querySelector("[data-slot=markdown]")!;
  assert.equal(root.querySelector(".code-block[data-streaming=true] .markdown__character") !== null, true);
  assert.equal(root.querySelector(".code-block__token--keyword") === null, true);
  text.set("Intro\n\n```ts\nconst a = 1;");
  await flush();
  text.set("Intro\n\n```ts\nconst a = 1;\n```\n\nDone");
  await flush();
  assert.equal(root.querySelector(".code-block .code-block__token--keyword") !== null, true);
  assert.equal(root.querySelector(".code-block[data-streaming]") === null, true);
  // The replaced tail row leaves no copy behind (every row is one element).
  assert.equal(root.querySelectorAll(".code-block").length, 1);
  assert.equal(root.textContent!.match(/Done/g)?.length, 1);
  r.unmount();
});
