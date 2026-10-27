// DOM-target suite: FloatingToc (Rivet addition): press mode opens the content on a trigger press; an item press runs its
// onPress and closes the content; active items carry data-active + aria-current (hover mode: story `/floating-toc`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { FloatingToc } = await import("../src/components/floating-toc/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 30));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}

test("floating toc: press mode opens, item press closes", async () => {
  const pressed: string[] = [];
  const { container, unmount } = render(() => (
    <FloatingToc triggerMode="press">
      <FloatingToc.Trigger>
        <FloatingToc.Bar active />
        <FloatingToc.Bar />
      </FloatingToc.Trigger>
      <FloatingToc.Content>
        <FloatingToc.Item active onPress={() => pressed.push("intro")}>
          Intro
        </FloatingToc.Item>
        <FloatingToc.Item level={2} onPress={() => pressed.push("setup")}>
          Setup
        </FloatingToc.Item>
      </FloatingToc.Content>
    </FloatingToc>
  ));
  await flush();
  press(container.querySelector(".floating-toc__trigger")!);
  await flush();
  const items = [...window.document.querySelectorAll(".floating-toc__item")];
  assert.equal(items.length, 2);
  assert.equal(items[0].getAttribute("data-active"), "true");
  assert.equal(items[0].getAttribute("aria-current"), "location");
  press(items[1] as never);
  await flush();
  await flush();
  assert.deepEqual(pressed, ["setup"]);
  assert.equal(window.document.querySelectorAll(".floating-toc__item").length, 0);
  unmount();
});
