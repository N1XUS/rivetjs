// Server-target suite: `CheckboxButtonGroup` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) SSR — group root + layout modifier, card items (label around a hidden native checkbox sharing the group
// name), default selection, indicator / icon / content parts + data-slot, custom indicator, item description wiring, disabled; T21 shorthand (`label` / `items`) = the compound HTML.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CheckboxButtonGroup } from "../src/components/checkbox-button-group/index.ts";
import { Label } from "../src/components/label/index.ts";
import { Description } from "../src/components/description/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("checkbox-button-group SSR: root, cards, selection, parts", async () => {
  const html = await renderToString(() => (
    <CheckboxButtonGroup defaultValue={["team"]} name="plan" layout="grid">
      <Label>Plan</Label>
      <CheckboxButtonGroup.Item value="solo">
        <CheckboxButtonGroup.Indicator />
        <CheckboxButtonGroup.ItemIcon>S</CheckboxButtonGroup.ItemIcon>
        <CheckboxButtonGroup.ItemContent>
          <Label>Solo</Label>
          <Description>One seat</Description>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="team" isDisabled={false}>
        <CheckboxButtonGroup.Indicator>*</CheckboxButtonGroup.Indicator>
        <CheckboxButtonGroup.ItemContent>
          <Label>Team</Label>
        </CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
      <CheckboxButtonGroup.Item value="org" isDisabled>
        <CheckboxButtonGroup.ItemContent>Org</CheckboxButtonGroup.ItemContent>
      </CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  ));
  const root = /<div[^>]*data-slot="checkbox-button-group"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(root, /role="group"/);
  assert.match(root, /class="checkbox-button-group checkbox-button-group--grid"/);
  const labels = html.match(/<label[^>]*data-slot="checkbox-button-group-item"[^>]*>/g) ?? [];
  assert.equal(labels.length, 3);
  for (const l of labels) assert.match(l, /class="checkbox-button-group__item"/);
  assert.match(labels[1]!, /data-selected/);
  assert.doesNotMatch(labels[0]!, /data-selected/);
  assert.match(labels[2]!, /data-disabled/);
  const inputs = html.match(/<input[^>]*>/g) ?? [];
  assert.equal(inputs.length, 3);
  for (const i of inputs) {
    assert.match(i, /type="checkbox"/);
    assert.match(i, /name="plan"/);
  }
  assert.match(inputs[1]!, /checked/);
  assert.match(inputs[2]!, /disabled/);
  assert.match(html, /class="checkbox-button-group__field"/);
  assert.match(
    html,
    /<span aria-hidden="true" class="checkbox-button-group__indicator" data-slot="checkbox-button-group-indicator">(?:<!--[^>]*-->)*<svg[^>]*data-slot="checkbox-button-group-default-indicator"/,
  );
  assert.match(
    html,
    /<span aria-hidden="true" class="checkbox-button-group__indicator" data-slot="checkbox-button-group-indicator" data-custom="true">\*<\/span>/,
  );
  assert.match(html, /<span aria-hidden="true" class="checkbox-button-group__item-icon" data-slot="checkbox-button-group-item-icon">S<\/span>/);
  assert.match(html, /class="checkbox-button-group__item-content" data-slot="checkbox-button-group-item-content"/);
  // Item description: the first checkbox is described by it.
  const descId = /<span[^>]*id="([^"]+)"[^>]*>One seat/.exec(html)?.[1] ?? /id="([^"]+)"[^>]*data-slot="description"[^>]*>One seat/.exec(html)?.[1];
  assert.ok(descId);
  assert.match(inputs[0]!, new RegExp(`aria-describedby="[^"]*${descId}`));
});

test("checkbox-button-group SSR: flex layout default", async () => {
  const html = await renderToString(() => (
    <CheckboxButtonGroup aria-label="A">
      <CheckboxButtonGroup.Item value="a">A</CheckboxButtonGroup.Item>
    </CheckboxButtonGroup>
  ));
  assert.match(html, /class="checkbox-button-group checkbox-button-group--flex"/);
});

test("shorthand SSR (T21): label / description / items = Label, Description and one card per item (icon optional)", async () => {
  await assertSameHtml(
    () => (
      <CheckboxButtonGroup
        defaultValue={["a"]}
        label="Plan"
        description="Billed monthly"
        items={[
          { value: "a", label: "Small", description: "Up to 5" },
          { value: "b", label: "Large", icon: <b>L</b>, isDisabled: true },
        ]}
      />
    ),
    () => (
      <CheckboxButtonGroup defaultValue={["a"]}>
        <Label>Plan</Label>
        <Description>Billed monthly</Description>
        <CheckboxButtonGroup.Item value="a">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Small</Label>
            <Description>Up to 5</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="b" isDisabled>
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemIcon>
            <b>L</b>
          </CheckboxButtonGroup.ItemIcon>
          <CheckboxButtonGroup.ItemContent>
            <Label>Large</Label>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
      </CheckboxButtonGroup>
    ),
  );
});
