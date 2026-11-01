// react-aria useAutoScroll (WebKit macOS only): the scroll direction follows the edge the pointer is at now.
import { installDom } from "./install-dom.ts";
installDom();
import { describe, expect, it, vi } from "vitest";

vi.mock("../platform/index.ts", async (importOriginal) => ({ ...(await importOriginal<object>()), isWebKit: () => true, isIOS: () => false }));
const { useAutoScroll } = await import("../dnd/use-auto-scroll.ts");

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe("useAutoScroll", () => {
  it("moving from the left edge to the bottom edge stops the horizontal scroll", async () => {
    const el = document.createElement("div");
    el.style.overflowX = "auto";
    el.style.overflowY = "auto";
    document.body.append(el);
    el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, toJSON() {} }) as DOMRect;
    let left = 500;
    let top = 500;
    Object.defineProperty(el, "scrollLeft", { get: () => left, set: (v: number) => (left = v) });
    Object.defineProperty(el, "scrollTop", { get: () => top, set: (v: number) => (top = v) });
    const auto = useAutoScroll({ current: el });
    try {
      auto.move(5, 50); // left edge: dx = -15
      await frame();
      await frame();
      expect(left).toBeLessThan(500);
      auto.move(50, 95); // bottom edge at mid width: only vertical
      const x = left;
      const y = top;
      await frame();
      await frame();
      expect(left).toBe(x);
      expect(top).toBeGreaterThan(y);
    } finally {
      auto.stop();
      el.remove();
    }
  });
});
