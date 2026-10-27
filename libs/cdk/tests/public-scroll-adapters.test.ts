// Public imperative scrolling adapters; dimensions are explicit because happy-dom has no layout.
// Scroll-lock cases ported from react-aria/test/overlays/usePreventScroll.test.js
// (adobe/react-spectrum @ 06891de), Apache-2.0, © Adobe. Hook unmounts become imperative releases.
import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { installDom, mockLayout } from "./install-dom.ts";
import { preventScroll, isScrollPrevented, isScrollable, getScrollParent, getScrollParents } from "@rivetjs/cdk/prevent-scroll";
import { scrollWheelProps } from "@rivetjs/cdk/interactions/scroll-wheel";

const dom = installDom();
beforeEach(() => dom.reset());

test.each([false, true])("scroll lock survives either release order (nested first: %s) and ignores disabled locks", (nestedFirst) => {
  document.documentElement.style.overflow = "auto";
  const release = preventScroll(),
    nested = preventScroll(),
    disabled = preventScroll({ isDisabled: true });
  try {
    assert.equal(isScrollPrevented(), true);
    assert.equal(document.documentElement.style.overflow, "hidden");
    const first = nestedFirst ? nested : release;
    const last = nestedFirst ? release : nested;
    first();
    first();
    disabled();
    assert.equal(isScrollPrevented(), true);
    last();
    assert.equal(isScrollPrevented(), false);
    assert.equal(document.documentElement.style.overflow, "auto");
  } finally {
    release();
    nested();
    disabled();
  }
});

test("scroll parent helpers distinguish overflow styles from actual overflow and order ancestors", () => {
  document.body.innerHTML = '<div id="outer" style="overflow:auto"><div id="inner" style="overflow:scroll"><span id="leaf"></span></div></div>';
  const outer = document.querySelector("#outer")!,
    inner = document.querySelector("#inner")!,
    leaf = document.querySelector("#leaf")!;
  mockLayout(outer, { width: 100, height: 100, scrollHeight: 200 });
  mockLayout(inner, { width: 100, height: 100 });
  assert.equal(isScrollable(inner), true);
  assert.equal(isScrollable(inner, true), false);
  assert.equal(isScrollable(outer, true), true);
  assert.equal(getScrollParent(leaf), inner);
  assert.equal(getScrollParent(leaf, true), outer);
  assert.equal(getScrollParent(inner), outer);
  assert.deepEqual(getScrollParents(leaf), [inner, outer]);
  assert.deepEqual(getScrollParents(leaf, true), [outer]);
});

test("wheel handler reports deltas, prevents page scroll and preserves zoom and disabled input", () => {
  const disabled = signal(false),
    calls: unknown[] = [];
  const { scrollWheelProps: attrs } = scrollWheelProps({ isDisabled: disabled, onScroll: (event) => calls.push(event) });
  const onWheel = attrs.onWheel as (event: WheelEvent) => void;
  const wheel = new dom.window.WheelEvent("wheel", { deltaX: 4, deltaY: 12, cancelable: true });
  onWheel(wheel as unknown as WheelEvent);
  assert.deepEqual(calls, [{ deltaX: 4, deltaY: 12 }]);
  assert.equal(wheel.defaultPrevented, true);
  const zoom = new dom.window.WheelEvent("wheel", { deltaY: 1, cancelable: true });
  // happy-dom WheelEvent does not initialize the inherited modifier fields.
  Object.defineProperty(zoom, "ctrlKey", { value: true });
  onWheel(zoom as unknown as WheelEvent);
  assert.equal(zoom.defaultPrevented, false);
  disabled.set(true);
  const ignored = new dom.window.WheelEvent("wheel", { deltaY: 1, cancelable: true });
  onWheel(ignored as unknown as WheelEvent);
  assert.equal(ignored.defaultPrevented, false);
  assert.equal(calls.length, 1);
});
