// `virtualizer/dom.ts` createScrollView (react-aria useScrollView as a controller): size updates after a throw.
import "./dom.ts";
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createScrollView } from "../virtualizer/dom.ts";

describe("createScrollView.updateSize", () => {
  it("a throwing size listener does not stop later size updates (reentrancy flag reset in finally)", () => {
    const element = document.createElement("div");
    let width = 100;
    Object.defineProperty(element, "clientWidth", { get: () => width });
    Object.defineProperty(element, "clientHeight", { get: () => 50 });
    const sizes: number[] = [];
    let fail = true;
    const view = createScrollView(element, {
      direction: () => "ltr",
      onVisibleRectChange: () => {},
      onSizeChange: (size: { width: number }) => {
        sizes.push(size.width);
        if (fail) throw new Error("listener");
      },
    } as never);
    try {
      assert.throws(() => view.updateSize(), /listener/);
      fail = false;
      width = 200;
      view.updateSize();
      assert.deepEqual(sizes, [100, 200]);
    } finally {
      view.dispose();
    }
  });
});
