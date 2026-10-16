// Server-target suite (upstream tests/components/select/select.ssr.test.tsx): `Select` closed (trigger + placeholder + hidden
// select), `defaultOpen` (popover + listbox + options, selected value), with a clear button (span in the trigger).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Label, ListBox, Select } from "../index.ts";

const Fixture = (props: { defaultOpen?: boolean; withClearButton?: boolean; defaultValue?: string }) => (
  <Select data-testid="select" name="state" defaultOpen={props.defaultOpen} defaultValue={props.defaultValue} placeholder="Select one">
    <Label>State</Label>
    <Select.Trigger>
      <Select.Value />
      {props.withClearButton ? <Select.ClearButton /> : null}
      <Select.Indicator />
    </Select.Trigger>
    <Select.Popover>
      <ListBox>
        <ListBox.Item id="florida" textValue="Florida">
          Florida
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="california" textValue="California">
          California
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </Select.Popover>
  </Select>
);

test("select SSR (upstream): closed renders the trigger, placeholder and hidden select", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="select"/);
  assert.match(html, /class="select select--primary"/);
  assert.match(html, /data-slot="select-trigger"/);
  assert.match(html, /class="select__trigger"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-slot="select-value"[^>]*>Select one|>Select one</);
  assert.match(html, /data-slot="select-default-indicator"/);
  assert.match(html, /<select[^>]*name="state"/);
  assert.doesNotMatch(html, /role="listbox"/);
});

test("select SSR (upstream): defaultOpen renders popover, listbox and options", async () => {
  const html = await renderToString(() => <Fixture defaultOpen defaultValue="california" />);
  assert.match(html, /data-slot="select-popover"/);
  assert.match(html, /role="listbox"/);
  assert.equal(html.match(/role="option"/g)?.length, 2);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /data-trigger="Select"/);
});

test("select SSR (upstream): clear button is a span inside the trigger", async () => {
  const html = await renderToString(() => <Fixture withClearButton defaultValue="california" />);
  assert.match(html, /<span[^>]*data-slot="select-clear-button"/);
  assert.match(html, /class="select__clear-button"/);
  assert.match(html, /data-slot="select-clear-button-icon"/);
  assert.match(html, /California/);
});

test("select SSR (Rivet): auto form renders the same closed and open markup as the compound form", async () => {
  const strip = (html: string) => html.replace(/\brv[\w-]*\d[\w-]*/g, "rv#");
  const auto = (open?: boolean) =>
    renderToString(() => (
      <Select data-testid="select" name="state" defaultOpen={open} defaultValue="california" label="State" placeholder="Select one">
        <Select.Item id="florida">Florida</Select.Item>
        <Select.Item id="california">California</Select.Item>
      </Select>
    ));
  const compound = (open?: boolean) => renderToString(() => <Fixture defaultOpen={open} defaultValue="california" />);
  assert.equal(strip(await auto()), strip(await compound()));
  assert.equal(strip(await auto(true)), strip(await compound(true)));
});
