// DOM-target suite (happy-dom): `Surface` mounts the same markup as SSR and provides `SurfaceContext`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { useContext } = await import("@rivetjs/reactivity");
const { Surface, SurfaceRoot, SurfaceContext, surfaceVariants } = await import("../src/components/surface/index.ts");
const root = await import("../src/components/surface/surface.tsx");

test("surface: DOM markup matches HeroUI v3.2.6 (class + data-slot)", () => {
  const r = render(() => (
    <Surface variant="secondary" class="p-4">
      x
    </Surface>
  ));
  assert.equal(r.html(), '<div class="surface surface--secondary p-4" data-slot="surface">x</div>');
  r.unmount();
});

test("surface: ref is forwarded to the div", () => {
  let el: Element | undefined;
  const r = render(() => <Surface ref={(e: Element) => (el = e)}>z</Surface>);
  assert.equal(el?.getAttribute("data-slot"), "surface");
  r.unmount();
});

test("surface: SurfaceContext provides the variant to descendants", () => {
  const Probe = () => {
    const ctx = useContext(SurfaceContext);
    return <i>{ctx.variant ?? "none"}</i>;
  };
  const r = render(() => (
    <Surface variant="tertiary">
      <Probe />
    </Surface>
  ));
  assert.equal(r.html(), '<div class="surface surface--tertiary" data-slot="surface"><i>tertiary</i></div>');
  r.unmount();
});

test("surface: exports = HeroUI v3.2.6 index (Surface.Root, SurfaceRoot, SurfaceContext, surfaceVariants)", () => {
  assert.equal(Surface, SurfaceRoot);
  assert.equal(Surface.Root, SurfaceRoot);
  assert.equal(SurfaceRoot, root.SurfaceRoot);
  assert.equal(SurfaceContext, root.SurfaceContext);
  assert.equal(SurfaceContext.id, "rv-ui-surface");
  assert.deepEqual(SurfaceContext.defaultValue, {});
  assert.equal(surfaceVariants({ variant: "tertiary" }), "surface surface--tertiary");
  assert.equal(surfaceVariants(), "surface surface--default");
});
