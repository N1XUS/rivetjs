// DOM-target suite (happy-dom): `Card` mounts the same markup as SSR; context, `ref`, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { useContext } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/card/index.ts");
const { Card, cardVariants } = ui;
const parts = await import("../src/components/card/card.tsx");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

test("card: DOM markup matches HeroUI v3.2.6", () => {
  const r = render(() => (
    <Card variant="tertiary" class="w-[400px]">
      <Card.Header>
        <Card.Title>T</Card.Title>
        <Card.Description>D</Card.Description>
      </Card.Header>
      <Card.Content>C</Card.Content>
      <Card.Footer>F</Card.Footer>
    </Card>
  ));
  assert.equal(
    r.html(),
    '<div class="card card--tertiary w-[400px]" data-slot="card">' +
      '<div class="card__header" data-slot="card-header">' +
      '<h3 class="card__title" data-slot="card-title">T</h3>' +
      '<p class="card__description" data-slot="card-description">D</p></div>' +
      '<div class="card__content" data-slot="card-content">C</div>' +
      '<div class="card__footer" data-slot="card-footer">F</div></div>',
  );
  r.unmount();
});

test("card: ref is forwarded on root and parts", () => {
  let root: Element | undefined;
  let title: Element | undefined;
  const r = render(() => (
    <Card ref={(e: Element) => (root = e)}>
      <Card.Title ref={(e: Element) => (title = e)}>t</Card.Title>
    </Card>
  ));
  assert.equal(root?.getAttribute("data-slot"), "card");
  assert.equal(title?.tagName, "H3");
  r.unmount();
});

test("card: SurfaceContext = card variant unless transparent", () => {
  const Probe = () => <i>{useContext(SurfaceContext).variant ?? "none"}</i>;
  for (const [variant, seen] of [
    ["secondary", "secondary"],
    ["transparent", "none"],
  ] as const) {
    const r = render(() => (
      <Card variant={variant}>
        <Probe />
      </Card>
    ));
    assert.equal(r.html(), `<div class="card card--${variant}" data-slot="card"><i>${seen}</i></div>`);
    r.unmount();
  }
});

test("card: exports = HeroUI v3.2.6 index", () => {
  assert.equal(Card, parts.CardRoot);
  assert.equal(Card.Root, parts.CardRoot);
  assert.equal(Card.Header, parts.CardHeader);
  assert.equal(Card.Title, parts.CardTitle);
  assert.equal(Card.Description, parts.CardDescription);
  assert.equal(Card.Content, parts.CardContent);
  assert.equal(Card.Footer, parts.CardFooter);
  for (const k of ["CardRoot", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"] as const) assert.equal(ui[k], parts[k]);
  assert.deepEqual(Object.keys(ui).sort(), ["Card", "CardContent", "CardDescription", "CardFooter", "CardHeader", "CardRoot", "CardTitle", "cardVariants"]);
  assert.equal(cardVariants({ variant: "secondary" }).base(), "card card--secondary");
});
