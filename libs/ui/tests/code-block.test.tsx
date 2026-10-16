// DOM-target suite (happy-dom): `CodeBlock` (Rivet-authored; feature set inspired by HeroUI Pro's public CodeBlock docs):
// exports + variants, tokens per language, `code` accessor re-renders the tokens, wrap flag, copy button feedback.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { CodeBlock, CodeBlockRoot, codeBlockVariants } = await import("../src/components/code-block/index.ts");
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

const written: string[] = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void written.push(t) } });

test("code-block: exports + variants", () => {
  assert.equal(CodeBlock, CodeBlockRoot);
  assert.equal(codeBlockVariants().base(), "code-block");
  assert.equal(codeBlockVariants().token(), "code-block__token");
});

test("code-block: streaming code + copy", async () => {
  const code = signal('{"a": 1');
  const r = render(() => (
    <CodeBlock>
      <CodeBlock.Header>
        <CodeBlock.Language language="json" />
        <CodeBlock.CopyButton code={() => code()} />
      </CodeBlock.Header>
      <CodeBlock.Code code={() => code()} language="json" wrap />
    </CodeBlock>
  ));
  const region = r.container.querySelector("[data-slot=code-block-code]")!;
  assert.equal(region.getAttribute("data-wrap"), "true");
  assert.equal(region.getAttribute("aria-label"), "JSON code");
  assert.equal(r.container.querySelector("code")!.textContent, '{"a": 1');
  assert.ok(r.container.querySelector(".code-block__token--number"));
  code.set('{"a": 1, "b": true}');
  await flush();
  assert.equal(r.container.querySelector("code")!.textContent, '{"a": 1, "b": true}');
  assert.ok(r.container.querySelector(".code-block__token--literal, .code-block__token--keyword"));
  const button = r.container.querySelector("[data-slot=code-block-copy-button]")!;
  assert.equal(button.getAttribute("aria-label"), "Copy code");
  press(button);
  await flush();
  assert.deepEqual(written, ['{"a": 1, "b": true}']);
  assert.equal(button.getAttribute("data-copied"), "true");
  r.unmount();
});
