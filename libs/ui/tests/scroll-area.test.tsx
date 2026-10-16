// DOM-target suite: `ScrollArea` (Rivet addition: Radix ScrollArea behaviour from `@rivetjs/cdk/scroll-area`, HeroUI look) on
// happy-dom: index exports + compound parts, BEM classes + `data-slot` on every part, `class` merged, size / variant
// modifiers, `variant` → cdk `type` (`always`: scrollbar mounted at once; `hover`: only while hovered), explicit `type` wins,
// `Scrollbar` default thumb, `shadow` classes on the viewport. Layout-dependent behaviour (thumb size / position, drag,
// hover visibility, no script before interaction): `tests-components/scroll-area.test.ts` (Chromium, resumed).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
// cdk scroll-area presence calls `CSS.escape` (animation end); happy-dom has `CSS` on the window only
(globalThis as Record<string, unknown>).CSS ??= (window as unknown as Record<string, unknown>).CSS;

const { render } = await import("@rivetjs/runtime/testing");
const { ScrollArea, ScrollAreaRoot, ScrollAreaViewport, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaCorner, scrollAreaVariants } =
  await import("../src/components/scroll-area/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));

test("scroll-area: index exports + compound parts", () => {
  assert.equal(ScrollArea, ScrollAreaRoot);
  assert.equal(ScrollArea.Root, ScrollAreaRoot);
  assert.equal(ScrollArea.Viewport, ScrollAreaViewport);
  assert.equal(ScrollArea.Scrollbar, ScrollAreaScrollbar);
  assert.equal(ScrollArea.Thumb, ScrollAreaThumb);
  assert.equal(ScrollArea.Corner, ScrollAreaCorner);
  assert.equal(scrollAreaVariants().thumb(), "scroll-area__thumb");
  assert.equal(scrollAreaVariants({ size: "sm", variant: "always" }).base(), "scroll-area scroll-area--sm scroll-area--always");
});

test('scroll-area: variant="always" mounts the scrollbars at once; classes, data-slot, class merged', async () => {
  const r = render(() => (
    <ScrollArea variant="always" size="sm" class="custom-root" id="root">
      <ScrollArea.Viewport class="custom-vp" id="vp">
        <p>row</p>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" class="custom-bar" id="y">
        <ScrollArea.Thumb class="custom-thumb" id="thumb" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" id="x" />
      <ScrollArea.Corner class="custom-corner" />
    </ScrollArea>
  ));
  await flush();
  const root = r.container.querySelector("#root")!;
  assert.equal(root.getAttribute("class"), "scroll-area scroll-area--sm scroll-area--always custom-root");
  assert.equal(root.getAttribute("data-slot"), "scroll-area");
  const vp = r.container.querySelector("#vp")!;
  assert.equal(vp.getAttribute("class"), "scroll-area__viewport custom-vp");
  assert.equal(vp.getAttribute("data-slot"), "scroll-area-viewport");
  const y = r.container.querySelector("#y")!;
  assert.equal(y.getAttribute("class"), "scroll-area__scrollbar custom-bar");
  assert.equal(y.getAttribute("data-slot"), "scroll-area-scrollbar");
  assert.equal(y.getAttribute("data-orientation"), "vertical");
  assert.equal(y.getAttribute("data-state"), "visible");
  const x = r.container.querySelector("#x")!;
  assert.equal(x.getAttribute("data-orientation"), "horizontal");
  // client render: active from the start (Radix): enabled axes scroll
  assert.equal((vp as HTMLElement).style.overflowY, "scroll");
  assert.equal((vp as HTMLElement).style.overflowX, "scroll");
  r.unmount();
});

test('scroll-area: variant="hover" (default) renders no scrollbar until the pointer enters; an explicit type wins', async () => {
  const hover = render(() => (
    <ScrollArea id="root">
      <ScrollArea.Viewport>row</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" id="y" />
    </ScrollArea>
  ));
  await flush();
  assert.equal(hover.container.querySelector("#root")!.getAttribute("class"), "scroll-area scroll-area--md scroll-area--hover");
  assert.equal(hover.container.querySelector("#y"), null);
  hover.unmount();
  const always = render(() => (
    <ScrollArea type="always" id="root">
      <ScrollArea.Viewport>row</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" id="y" />
    </ScrollArea>
  ));
  await flush();
  assert.equal(always.container.querySelector("#root")!.getAttribute("class"), "scroll-area scroll-area--md scroll-area--hover");
  assert.equal(always.container.querySelector("#y")?.getAttribute("data-state"), "visible");
  always.unmount();
});

test("scroll-area: shadow puts the ScrollShadow classes, mode and size on the viewport", async () => {
  const r = render(() => (
    <ScrollArea shadow="horizontal" shadowSize={24}>
      <ScrollArea.Viewport id="vp" style={{ height: "100px" }}>
        row
      </ScrollArea.Viewport>
    </ScrollArea>
  ));
  await flush();
  const vp = r.container.querySelector("#vp") as HTMLElement;
  assert.equal(vp.getAttribute("class"), "scroll-area__viewport scroll-shadow scroll-shadow--hide-scrollbar scroll-shadow--horizontal scroll-shadow--fade");
  assert.equal(vp.getAttribute("data-scroll-shadow-mode"), "auto");
  assert.equal(vp.style.getPropertyValue("--scroll-shadow-size"), "24px");
  assert.equal(vp.style.height, "100px");
  r.unmount();
});
