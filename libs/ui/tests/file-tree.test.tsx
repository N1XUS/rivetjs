// DOM-target suite: FileTree (Rivet addition): expand button toggles child rows and `data-expanded`, multiple selection
// through row press reaches `onSelectionChange` (keyboard / resume: story `/file-tree`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { FileTree } = await import("../src/components/file-tree/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

test("file tree: chevron expands and collapses", async () => {
  const expanded: string[][] = [];
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files" onExpandedChange={(keys) => expanded.push([...keys].map(String))}>
      <FileTree.Item id="src" title="src">
        <FileTree.Item id="index" title="index.ts" />
      </FileTree.Item>
    </FileTree>
  ));
  await flush();
  assert.equal(container.querySelectorAll('[role="row"]').length, 1);
  press(container.querySelector('[slot="chevron"]')!);
  await flush();
  assert.deepEqual(expanded.at(-1), ["src"]);
  assert.equal(container.querySelectorAll('[role="row"]').length, 2);
  assert.equal(container.querySelector('[data-key="src"], [role="row"]')!.getAttribute("data-expanded"), "true");
  press(container.querySelector('[slot="chevron"]')!);
  await flush();
  assert.deepEqual(expanded.at(-1), []);
  assert.equal(container.querySelectorAll('[role="row"]').length, 1);
  unmount();
});

test("file tree: multiple selection", async () => {
  let selected: string[] = [];
  const { container, unmount } = render(() => (
    <FileTree aria-label="Files" selectionMode="multiple" onSelectionChange={(keys) => (selected = keys === "all" ? ["all"] : [...keys].map(String))}>
      <FileTree.Item id="a" title="a.md" />
      <FileTree.Item id="b" title="b.md" />
    </FileTree>
  ));
  await flush();
  const rows = container.querySelectorAll('[role="row"]');
  press(rows[0]);
  await flush();
  press(rows[1]);
  await flush();
  assert.deepEqual(selected.sort(), ["a", "b"]);
  assert.equal(container.querySelectorAll(".file-tree__selection-cell").length, 2);
  unmount();
});
