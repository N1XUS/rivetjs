// Server-target suite: `RadioButtonGroup` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) SSR — radiogroup root + layout modifier, card items (label around a hidden native radio sharing the group
// name), default selection, indicator / icon / content parts + data-slot, custom indicator, item description wiring, disabled; T21 shorthand (`label` / `items`) = the compound HTML.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { RadioButtonGroup } from "../src/components/radio-button-group/index.ts";
import { Label } from "../src/components/label/index.ts";
import { Description } from "../src/components/description/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("radio-button-group SSR: root, cards, selection, parts", async () => {
  const html = await renderToString(() => (
    <RadioButtonGroup defaultValue="team" name="plan" layout="grid">
      <Label>Plan</Label>
      <RadioButtonGroup.Item value="solo">
        <RadioButtonGroup.Indicator />
        <RadioButtonGroup.ItemIcon>S</RadioButtonGroup.ItemIcon>
        <RadioButtonGroup.ItemContent>
          <Label>Solo</Label>
          <Description>One seat</Description>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="team" isDisabled={false}>
        <RadioButtonGroup.Indicator>*</RadioButtonGroup.Indicator>
        <RadioButtonGroup.ItemContent>
          <Label>Team</Label>
        </RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
      <RadioButtonGroup.Item value="org" isDisabled>
        <RadioButtonGroup.ItemContent>Org</RadioButtonGroup.ItemContent>
      </RadioButtonGroup.Item>
    </RadioButtonGroup>
  ));
  const root = /<div[^>]*data-slot="radio-button-group"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(root, /role="radiogroup"/);
  assert.match(root, /class="radio-button-group radio-button-group--grid"/);
  const labels = html.match(/<label[^>]*data-slot="radio-button-group-item"[^>]*>/g) ?? [];
  assert.equal(labels.length, 3);
  for (const l of labels) assert.match(l, /class="radio-button-group__item"/);
  assert.match(labels[1]!, /data-selected/);
  assert.doesNotMatch(labels[0]!, /data-selected/);
  assert.match(labels[2]!, /data-disabled/);
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  assert.equal(inputs.length, 3);
  for (const i of inputs) {
    assert.match(i, /type="radio"/);
    assert.match(i, /name="plan"/);
  }
  assert.match(inputs[1]!, /checked/);
  assert.match(inputs[2]!, /disabled/);
  assert.match(html, /class="radio-button-group__field"/);
  assert.match(html, /<span aria-hidden="true" class="radio-button-group__indicator" data-slot="radio-button-group-indicator"><\/span>/);
  assert.match(html, /<span aria-hidden="true" class="radio-button-group__indicator" data-slot="radio-button-group-indicator" data-custom="true">\*<\/span>/);
  assert.match(html, /<span aria-hidden="true" class="radio-button-group__item-icon" data-slot="radio-button-group-item-icon">S<\/span>/);
  assert.match(html, /class="radio-button-group__item-content" data-slot="radio-button-group-item-content"/);
  // Item description: the first radio is described by it.
  const descId = /<span[^>]*id="([^"]+)"[^>]*>One seat/.exec(html)?.[1] ?? /id="([^"]+)"[^>]*data-slot="description"[^>]*>One seat/.exec(html)?.[1];
  assert.ok(descId);
  assert.match(inputs[0]!, new RegExp(`aria-describedby="[^"]*${descId}`));
});

test("radio-button-group SSR: flex layout default", async () => {
  const html = await renderToString(() => (
    <RadioButtonGroup aria-label="A">
      <RadioButtonGroup.Item value="a">A</RadioButtonGroup.Item>
    </RadioButtonGroup>
  ));
  assert.match(html, /class="radio-button-group radio-button-group--flex"/);
});

test("shorthand SSR (T21): label / description / items = Label, Description and one card per item (icon optional)", async () => {
  await assertSameHtml(
    () => (
      <RadioButtonGroup
        defaultValue={"a"}
        label="Plan"
        description="Billed monthly"
        items={[
          { value: "a", label: "Small", description: "Up to 5" },
          { value: "b", label: "Large", icon: <b>L</b>, isDisabled: true },
        ]}
      />
    ),
    () => (
      <RadioButtonGroup defaultValue={"a"}>
        <Label>Plan</Label>
        <Description>Billed monthly</Description>
        <RadioButtonGroup.Item value="a">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Small</Label>
            <Description>Up to 5</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="b" isDisabled>
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemIcon>
            <b>L</b>
          </RadioButtonGroup.ItemIcon>
          <RadioButtonGroup.ItemContent>
            <Label>Large</Label>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
    ),
  );
});
