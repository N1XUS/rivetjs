// Server-target suite: `Surface` SSR markup = HeroUI v3.2.6 (`surfaceVariants` classes, `data-slot="surface"`).
// Imports the `index.ts` subpath entry: the test register carries the server target through relative `.ts` imports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { useContext } from "@rivetjs/reactivity";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Surface, SurfaceContext } from "../src/components/surface/index.ts";

test("surface: SSR markup matches HeroUI v3.2.6 (class + data-slot)", async () => {
  const html = await renderToString(() => (
    <Surface variant="secondary" class="p-4">
      x
    </Surface>
  ));
  assert.match(html, /<div[^>]*class="surface surface--secondary p-4"[^>]*data-slot="surface"[^>]*>x<\/div>/);
});

test("surface: every variant renders its HeroUI v3.2.6 class", async () => {
  for (const variant of ["default", "secondary", "tertiary", "transparent"] as const) {
    const html = await renderToString(() => <Surface variant={variant}>v</Surface>);
    assert.equal(html, `<div class="surface surface--${variant}" data-slot="surface">v</div>`, variant);
  }
});

test("surface: variant defaults to default; rest props reach the div", async () => {
  const html = await renderToString(() => (
    <Surface id="s1" aria-label="panel">
      y
    </Surface>
  ));
  assert.equal(html, '<div class="surface surface--default" data-slot="surface" id="s1" aria-label="panel">y</div>');
});

test("surface: SurfaceContext provides the variant to descendants (nearest wins)", async () => {
  const Probe = () => {
    const ctx = useContext(SurfaceContext);
    return <i>{ctx.variant ?? "none"}</i>;
  };
  const html = await renderToString(() => (
    <div>
      <Probe />
      <Surface variant="tertiary">
        <Probe />
        <Surface variant="transparent">
          <Probe />
        </Surface>
      </Surface>
    </div>
  ));
  assert.match(html, /^<div><i>none<\/i><div[^>]*><i>tertiary<\/i><div[^>]*><i>transparent<\/i><\/div><\/div><\/div>$/);
  assert.equal(SurfaceContext.id, "rv-ui-surface");
});
