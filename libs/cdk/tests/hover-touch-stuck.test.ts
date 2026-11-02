// Rivet test: a touch pointer event during a mouse hover must not orphan the hover (FIX2-CDK, review cdk-a-2#5).
// happy-dom; the hover handlers are called with event-shaped objects (currentTarget is read-only on real events).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { hoverProps } = await import("../interactions/hover.tsx");

test("a touch pointerover elsewhere keeps the mouse hover, the next mouse pointerover outside ends it", () => {
  const el = document.createElement("div");
  const outside = document.createElement("div");
  document.body.append(el, outside);
  const log: string[] = [];
  const { hoverProps: bag, isHovered } = hoverProps({ onHoverChange: (h) => log.push(String(h)) });
  const enter = bag.onPointerEnter as (e: unknown) => void;
  enter({ type: "pointerenter", pointerType: "mouse", target: el, currentTarget: el, relatedTarget: null, composedPath: () => [el] });
  assert.equal(isHovered(), true);
  outside.dispatchEvent(new PointerEvent("pointerover", { pointerType: "touch", bubbles: true }));
  assert.equal(isHovered(), true, "touch does not end a mouse hover");
  outside.dispatchEvent(new PointerEvent("pointerover", { pointerType: "mouse", bubbles: true }));
  assert.equal(isHovered(), false, "the hover still ends on the next mouse move outside");
  assert.deepEqual(log, ["true", "false"]);
  el.remove();
  outside.remove();
});
