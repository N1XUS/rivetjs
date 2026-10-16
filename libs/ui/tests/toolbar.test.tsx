// DOM-target suite: `Toolbar` (upstream tests/components/toolbar/toolbar.test.tsx ported to happy-dom): labelled toolbar role +
// data-slot + BEM block, orientation / attached modifiers, press inside, nested ToggleButtonGroup selection; Rivet: provides
// cdk `SeparatorContext` (perpendicular orientation) + `ToggleButtonGroupContext` orientation, live `isAttached`, index exports.
// Arrow-key focus moves (upstream "keyboard arrow navigation"): `tests-components/collections.test.ts` (real keyboard).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Button } = await import("../src/components/button/index.ts");
const { ToggleButton } = await import("../src/components/toggle-button/index.ts");
const { ToggleButtonGroup } = await import("../src/components/toggle-button-group/index.ts");
const { Separator } = await import("../src/components/separator/index.ts");
const { Toolbar, ToolbarRoot, toolbarVariants } = await import("../src/components/toolbar/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 10));

test("toolbar: index exports", () => {
  assert.equal(Toolbar, ToolbarRoot);
  assert.equal(Toolbar.Root, ToolbarRoot);
  assert.equal(toolbarVariants(), "toolbar toolbar--horizontal");
});

test("toolbar: labelled toolbar role with data-slot and BEM block, horizontal default", () => {
  const r = render(() => (
    <Toolbar aria-label="Text formatting">
      <Button>Bold</Button>
      <Button>Italic</Button>
    </Toolbar>
  ));
  const tb = r.container.querySelector("[role=toolbar]")!;
  assert.equal(tb.getAttribute("aria-label"), "Text formatting");
  assert.equal(tb.getAttribute("data-slot"), "toolbar");
  assert.match(tb.className, /\btoolbar\b/);
  assert.match(tb.className, /toolbar--horizontal/);
  r.unmount();
});

test("toolbar: vertical + attached modifiers", () => {
  const r = render(() => (
    <Toolbar aria-label="Tools" orientation="vertical" isAttached>
      <Button>One</Button>
    </Toolbar>
  ));
  const tb = r.container.querySelector("[role=toolbar]")!;
  assert.match(tb.className, /toolbar--vertical/);
  assert.match(tb.className, /toolbar--attached/);
  assert.equal(tb.getAttribute("aria-orientation"), "vertical");
  r.unmount();
});

test("toolbar: press on a grouped button", async () => {
  let n = 0;
  const r = render(() => (
    <Toolbar aria-label="Editor toolbar">
      <Button onPress={() => n++}>Undo</Button>
      <Button>Redo</Button>
    </Toolbar>
  ));
  r.container.querySelector("button")!.click();
  await flush();
  assert.equal(n, 1);
  r.unmount();
});

test("toolbar: nested ToggleButtonGroup selection; separator perpendicular", async () => {
  const seen: unknown[] = [];
  const r = render(() => (
    <Toolbar aria-label="Text formatting">
      <ToggleButtonGroup selectionMode="multiple" onSelectionChange={(k: Set<unknown>) => seen.push([...k])}>
        <ToggleButton id="bold">Bold</ToggleButton>
      </ToggleButtonGroup>
      <Separator />
    </Toolbar>
  ));
  r.container.querySelector("button")!.click();
  await flush();
  assert.deepEqual(seen, [["bold"]]);
  const sep = r.container.querySelector("[data-slot=separator]")!;
  assert.equal(sep.getAttribute("data-orientation"), "vertical");
  r.unmount();
});

test("toolbar: live isAttached updates the class in place", async () => {
  const attached = signal(false);
  const r = render(() => (
    <Toolbar aria-label="t" isAttached={attached()}>
      <Button>One</Button>
    </Toolbar>
  ));
  const tb = r.container.querySelector("[role=toolbar]")!;
  assert.doesNotMatch(tb.className, /toolbar--attached/);
  attached.set(true);
  await flush();
  assert.equal(r.container.querySelector("[role=toolbar]"), tb);
  assert.match(tb.className, /toolbar--attached/);
  r.unmount();
});
