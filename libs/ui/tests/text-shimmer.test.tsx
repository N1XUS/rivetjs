// DOM-target suite (happy-dom): `TextShimmer` (Rivet-authored; feature set inspired by HeroUI Pro's public TextShimmer
// docs): exports + variants, one element (no duplicated text), `isActive` accessor toggles `data-active` in place (text node kept).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { TextShimmer, TextShimmerRoot, textShimmerVariants } = await import("../src/components/text-shimmer/index.ts");
const flush = () => new Promise((r) => setTimeout(r, 20));

test("text-shimmer: exports + variants", () => {
  assert.equal(TextShimmer, TextShimmerRoot);
  assert.equal(TextShimmer.Root, TextShimmerRoot);
  assert.equal(textShimmerVariants().base(), "text-shimmer");
});

test("text-shimmer: single text node + reactive isActive", async () => {
  const on = signal(true);
  const r = render(() => <TextShimmer isActive={() => on()}>Thinking</TextShimmer>);
  const root = r.container.querySelector("[data-slot=text-shimmer]") as HTMLElement;
  assert.equal(root.getAttribute("data-active"), "true");
  assert.equal(root.textContent, "Thinking");
  assert.equal(root.children.length, 0);
  const text = root.firstChild;
  on.set(false);
  await flush();
  assert.equal(root.getAttribute("data-active"), "false");
  assert.equal(root.firstChild, text);
  assert.equal(root.textContent, "Thinking");
  r.unmount();
});
