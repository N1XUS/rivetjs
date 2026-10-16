// Server-target suite (upstream tests/components/combo-box/combo-box.ssr.test.tsx): `ComboBox` closed (root, input group, input with
// the combobox role, trigger + default icon, hidden form input) and with a default value (input value = the item text).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ComboBox, Input, Label, ListBox } from "../index.ts";

const Fixture = (props: { defaultValue?: string; variant?: "primary" | "secondary" }) => (
  <ComboBox data-testid="combo-box" name="animal" defaultValue={props.defaultValue} variant={props.variant}>
    <Label>Favorite Animal</Label>
    <ComboBox.InputGroup>
      <Input placeholder="Search animals..." />
      <ComboBox.Trigger />
    </ComboBox.InputGroup>
    <ComboBox.Popover>
      <ListBox>
        <ListBox.Item id="cat" textValue="Cat">
          Cat
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="dog" textValue="Dog">
          Dog
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </ComboBox.Popover>
  </ComboBox>
);

test("combo-box SSR (upstream): closed renders root, input group, input and trigger", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="combo-box"/);
  assert.match(html, /class="combo-box"/);
  assert.match(
    html,
    /class="combo-box__input-group"[^>]*data-slot="combo-box-input-group"|data-slot="combo-box-input-group"[^>]*class="combo-box__input-group"/,
  );
  assert.match(html, /role="combobox"/);
  assert.match(html, /class="input input--primary"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-slot="combo-box-trigger"/);
  assert.match(html, /class="combo-box__trigger"/);
  assert.match(html, /data-slot="combo-box-trigger-default-icon"/);
  assert.match(html, /<input[^>]*type="hidden"[^>]*name="animal"/);
  assert.doesNotMatch(html, /role="listbox"/);
});

test("combo-box SSR (upstream): default value fills the input", async () => {
  const html = await renderToString(() => <Fixture defaultValue="cat" />);
  assert.match(html, /role="combobox"[^>]*value="Cat"|value="Cat"[^>]*role="combobox"/);
});

test("combo-box SSR: Input takes the ComboBox variant", async () => {
  const html = await renderToString(() => <Fixture variant="secondary" />);
  assert.match(html, /class="input input--secondary"/);
});

test("combo-box SSR (Rivet): auto form renders the same markup as the compound form", async () => {
  const strip = (html: string) => html.replace(/\brv[\w-]*\d[\w-]*/g, "rv#");
  const auto = await renderToString(() => (
    <ComboBox data-testid="combo-box" name="animal" defaultValue="dog" label="Favorite Animal" placeholder="Search animals...">
      <ComboBox.Item id="cat">Cat</ComboBox.Item>
      <ComboBox.Item id="dog">Dog</ComboBox.Item>
    </ComboBox>
  ));
  assert.equal(strip(auto), strip(await renderToString(() => <Fixture defaultValue="dog" />)));
});
