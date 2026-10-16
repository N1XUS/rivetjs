// Server-target suite: `NumberStepper` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) SSR — NumberField root + size modifier, pill group, stepper buttons (labels, disabled at the bound), the
// spinbutton input + aria-hidden display (one span per character, no `data-roll` on the server), formatOptions, `format`,
// render-function Value children, `aria-describedby` / `aria-controls` IDREFs resolve.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { NumberStepper } from "../src/components/number-stepper/index.ts";
import { Label } from "../src/components/label/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("number-stepper SSR: parts, display characters, bound-disabled button", async () => {
  const html = await renderToString(() => (
    <NumberStepper defaultValue={0} minValue={0} size="lg">
      <Label>Guests</Label>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  ));
  assert.match(html, /class="number-stepper number-stepper--lg"/);
  assert.match(
    html,
    /<div[^>]*class="number-stepper__group"[^>]*data-slot="number-stepper-group"|<div[^>]*data-slot="number-stepper-group"[^>]*class="number-stepper__group"/,
  );
  const input = /<input[^>]*data-slot="number-stepper-input"[^>]*>|<input[^>]*class="number-stepper__input"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(input, /role="spinbutton"|aria-roledescription/);
  assert.match(input, /value="0"/);
  assert.match(
    html,
    /<span aria-hidden="true" class="number-stepper__display" data-slot="number-stepper-display">(?:<!--[^>]*-->)*<span class="number-stepper__char" data-slot="number-stepper-char">0<\/span>/,
  );
  assert.doesNotMatch(html, /data-roll/);
  const dec = /<button[^>]*data-slot="number-stepper-decrement-button"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(dec, /class="number-stepper__button number-stepper__decrement-button"/);
  assert.match(dec, /disabled/);
  assert.match(dec, /aria-label="Decrease"/);
  const inc = /<button[^>]*data-slot="number-stepper-increment-button"[^>]*>/.exec(html)?.[0] ?? "";
  assert.doesNotMatch(inc, /disabled/);
  assert.match(html, /data-slot="number-stepper-increment-icon"/);
});

test("number-stepper SSR: formatOptions characters, format, render-function children", async () => {
  const html = await renderToString(() => (
    <>
      <NumberStepper defaultValue={12.5} formatOptions={{ style: "currency", currency: "USD" }} aria-label="Price" id="a">
        <NumberStepper.Group>
          <NumberStepper.Value />
        </NumberStepper.Group>
      </NumberStepper>
      <NumberStepper defaultValue={2} aria-label="Nights">
        <NumberStepper.Group>
          <NumberStepper.Value format={(v) => `${v} nights`} />
        </NumberStepper.Group>
      </NumberStepper>
      <NumberStepper defaultValue={3} aria-label="Seats">
        <NumberStepper.Group>
          <NumberStepper.Value>{({ value }) => <b>{`${value()} seats`}</b>}</NumberStepper.Value>
        </NumberStepper.Group>
      </NumberStepper>
    </>
  ));
  const chars = (from: string) => Array.from(from.matchAll(/data-slot="number-stepper-char">([^<]*)</g), (m) => m[1]).join("");
  const [price, rest] = html.split('aria-label="Nights"');
  const [nights, seats] = rest!.split('aria-label="Seats"');
  assert.equal(chars(price!), "$12.50");
  assert.equal(chars(nights!), "2 nights");
  assert.match(seats!, /<b>3 seats<\/b>/);
});

test("number-stepper SSR: no aria-describedby without a Description; buttons control the input id", async () => {
  const html = await renderToString(() => (
    <NumberStepper id="seats" aria-label="Team seats" defaultValue={3}>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  ));
  assert.doesNotMatch(html, /aria-describedby/);
  for (const [, id] of html.matchAll(/aria-controls="([^"]+)"/g)) assert.match(html, new RegExp(`<input[^>]* id="${id}"`));
});

test("shorthand SSR (T21): NumberStepper without children = Group(Decrement, Value, Increment)", async () => {
  await assertSameHtml(
    () => <NumberStepper aria-label="Qty" defaultValue={2} />,
    () => (
      <NumberStepper aria-label="Qty" defaultValue={2}>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
    ),
  );
});
