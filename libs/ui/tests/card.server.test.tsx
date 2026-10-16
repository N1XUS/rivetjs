// Server-target suite: `Card` SSR markup = HeroUI v3.2.6 (`cardVariants` slot classes, `data-slot` values, elements).
// Imports the `index.ts` subpath entry: the test register carries the server target through relative `.ts` imports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { useContext } from "@rivetjs/reactivity";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Card, CardContent, CardHeader } from "../src/components/card/index.ts";
import { SurfaceContext } from "../src/components/surface/index.ts";

const card = (variant?: "default" | "secondary" | "tertiary" | "transparent") =>
  renderToString(() => (
    <Card variant={variant} class="w-[400px]">
      <Card.Header>
        <Card.Title>T</Card.Title>
        <Card.Description>D</Card.Description>
      </Card.Header>
      <Card.Content>C</Card.Content>
      <Card.Footer>F</Card.Footer>
    </Card>
  ));

test("card: default variant markup = HeroUI v3.2.6", async () => {
  const html = await card();
  assert.match(html, /<div[^>]*class="card card--default w-\[400px\]"[^>]*data-slot="card"/);
  assert.match(html, /<div[^>]*class="card__header"[^>]*data-slot="card-header"/);
  assert.match(html, /<h3[^>]*class="card__title"[^>]*data-slot="card-title"[^>]*>T<\/h3>/);
  assert.match(html, /<p[^>]*class="card__description"[^>]*data-slot="card-description"[^>]*>D<\/p>/);
  assert.match(html, /<div[^>]*class="card__content"[^>]*data-slot="card-content"[^>]*>C</);
  assert.match(html, /<div[^>]*class="card__footer"[^>]*data-slot="card-footer"[^>]*>F</);
});

test("card: each variant sets its base modifier", async () => {
  for (const v of ["secondary", "tertiary", "transparent"] as const) assert.match(await card(v), new RegExp(`class="card card--${v} `));
});

test("card: part class + rest props reach the element", async () => {
  const html = await renderToString(() => (
    <Card id="c1">
      <CardHeader class="gap-2" id="h1">
        x
      </CardHeader>
    </Card>
  ));
  assert.equal(html, '<div class="card card--default" data-slot="card" id="c1"><div class="card__header gap-2" data-slot="card-header" id="h1">x</div></div>');
});

test("card: parts outside a Card get no slot class (upstream `slots` undefined)", async () => {
  const html = await renderToString(() => <CardContent class="p-1">y</CardContent>);
  assert.equal(html, '<div class="p-1" data-slot="card-content">y</div>');
});

test("card: class merges onto every part's slot class", async () => {
  const html = await renderToString(() => (
    <Card class="r">
      <Card.Header class="h">
        <Card.Title class="t">T</Card.Title>
        <Card.Description class="d">D</Card.Description>
      </Card.Header>
      <Card.Content class="c">C</Card.Content>
      <Card.Footer class="f">F</Card.Footer>
    </Card>
  ));
  assert.equal(
    html,
    '<div class="card card--default r" data-slot="card">' +
      '<div class="card__header h" data-slot="card-header">' +
      '<h3 class="card__title t" data-slot="card-title">T</h3>' +
      '<p class="card__description d" data-slot="card-description">D</p></div>' +
      '<div class="card__content c" data-slot="card-content">C</div>' +
      '<div class="card__footer f" data-slot="card-footer">F</div></div>',
  );
});

test("card: provides SurfaceContext with the variant, except transparent", async () => {
  const Probe = () => <i>{useContext(SurfaceContext).variant ?? "none"}</i>;
  const probe = (variant: "secondary" | "transparent") =>
    renderToString(() => (
      <Card variant={variant}>
        <Probe />
      </Card>
    ));
  assert.match(await probe("secondary"), /^<div[^>]*card--secondary[^>]*><i>secondary<\/i><\/div>$/);
  assert.match(await probe("transparent"), /^<div[^>]*card--transparent[^>]*><i>none<\/i><\/div>$/);
});
