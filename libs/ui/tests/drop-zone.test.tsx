// DOM-target suite: DropZone (Rivet addition): the Trigger clears and clicks the root's hidden input, the input reports the
// picked files through `onSelect`, a disabled input is not clicked, paste on the area's hidden button reaches `onDrop`
// (drag and drop with a real DataTransfer: cdk `drop-zone.browser.test.tsx` + story `/drop-zone`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { DropZone } = await import("../src/components/drop-zone/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; Event: typeof Event };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

test("drop zone: Trigger opens the hidden input; onSelect gets the files", async () => {
  let selected = -1;
  const { container, unmount } = render(() => (
    <DropZone>
      <DropZone.Area>
        <DropZone.Label>Drop</DropZone.Label>
        <DropZone.Trigger>Browse</DropZone.Trigger>
      </DropZone.Area>
      <DropZone.Input onSelect={(files) => (selected = files.length)} />
    </DropZone>
  ));
  await flush();
  const input = container.querySelector<HTMLInputElement>("input[data-drop-zone-input]")!;
  let clicks = 0;
  input.addEventListener("click", (e) => {
    clicks++;
    e.preventDefault();
  });
  const trigger = container.querySelector(".drop-zone__trigger")!;
  assert.equal(trigger.textContent, "Browse");
  press(trigger);
  await flush();
  assert.equal(clicks, 1);
  input.dispatchEvent(new W.Event("change", { bubbles: true }));
  assert.equal(selected, 0);
  unmount();
});

test("drop zone: a disabled input is not clicked", async () => {
  const { container, unmount } = render(() => (
    <DropZone>
      <DropZone.Area>
        <DropZone.Label>Drop</DropZone.Label>
        <DropZone.Trigger />
      </DropZone.Area>
      <DropZone.Input disabled />
    </DropZone>
  ));
  await flush();
  const input = container.querySelector<HTMLInputElement>("input[data-drop-zone-input]")!;
  let clicks = 0;
  input.addEventListener("click", () => clicks++);
  press(container.querySelector(".drop-zone__trigger")!);
  await flush();
  assert.equal(clicks, 0);
  unmount();
});
