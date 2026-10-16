// DOM-target suite: `Skeleton` (upstream tests ported): animation class from the prop or the `--skeleton-animation` variable.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

const window = installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Skeleton, SkeletonRoot, skeletonVariants } = await import("../src/components/skeleton/index.ts");
const { _clearCSSVariableCache } = await import("../src/hooks/use-css-variable.ts");

test("skeleton: default animation is shimmer; prop wins; class merged", () => {
  _clearCSSVariableCache();
  const a = render(() => <Skeleton class="h-4 w-20" />);
  assert.equal(a.html(), '<div class="skeleton skeleton--shimmer h-4 w-20"></div>');
  a.unmount();
  const b = render(() => <Skeleton animationType="pulse" />);
  assert.equal(b.container.firstElementChild?.className, "skeleton skeleton--pulse");
  b.unmount();
});

test("skeleton: a client-created Skeleton reads --skeleton-animation from the root", () => {
  _clearCSSVariableCache();
  window.document.documentElement.style.setProperty("--skeleton-animation", "none");
  const r = render(() => <Skeleton />);
  assert.equal(r.container.firstElementChild?.className, "skeleton skeleton--none");
  r.unmount();
  // The prop still wins over the variable.
  const p = render(() => <Skeleton animationType="pulse" />);
  assert.equal(p.container.firstElementChild?.className, "skeleton skeleton--pulse");
  p.unmount();
  window.document.documentElement.style.removeProperty("--skeleton-animation");
  _clearCSSVariableCache();
  assert.equal(Skeleton, SkeletonRoot);
  assert.equal(skeletonVariants().base(), "skeleton skeleton--shimmer");
});
