// Server-target suite: `CellSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// SSR — cdk Select parts form: root + trigger variant classes, label span inside the trigger naming it, value text, default
// indicator, hidden select; defaultOpen popover with the vendored select popover look + listbox.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { assertSameHtml } from "./same-html.ts";
import { ListBox } from "../src/components/list-box/index.ts";
import { CellSelect } from "../src/components/cell-select/index.ts";

const Fixture = (props: { defaultOpen?: boolean; variant?: "default" | "secondary" }) => (
  <CellSelect name="theme" defaultValue="dark" defaultOpen={props.defaultOpen} variant={props.variant}>
    <CellSelect.Trigger>
      <CellSelect.Label>Theme</CellSelect.Label>
      <CellSelect.Value />
      <CellSelect.Indicator />
    </CellSelect.Trigger>
    <CellSelect.Popover>
      <ListBox>
        <ListBox.Item id="light" textValue="Light">
          Light
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="dark" textValue="Dark">
          Dark
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </CellSelect.Popover>
  </CellSelect>
);

test("cell-select SSR: trigger row, label span, value, indicator, hidden select", async () => {
  const html = await renderToString(() => <Fixture />);
  assert.match(html, /data-slot="cell-select"/);
  assert.match(html, /class="cell-select"/);
  const trigger = /<button[^>]*data-slot="cell-select-trigger"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(trigger, /class="cell-select__trigger cell-select__trigger--default"/);
  assert.match(trigger, /aria-haspopup="listbox"/);
  const labelId = /<span[^>]*class="cell-select__label"[^>]*id="([^"]+)"|<span[^>]*id="([^"]+)"[^>]*class="cell-select__label"/.exec(html);
  assert.ok(labelId, "label renders as a span");
  const id = labelId[1] ?? labelId[2];
  assert.match(trigger, new RegExp(`aria-labelledby="[^"]*${id}`));
  assert.match(html, /class="cell-select__value"[^>]*>(?:<!--[^>]*-->)*Dark/);
  assert.match(html, /data-slot="cell-select-default-indicator"/);
  assert.match(html, /<select[^>]*name="theme"/);
  assert.doesNotMatch(html, /role="listbox"/);
});

test("cell-select SSR: auto form (label + CellSelect.Item) = compound form, closed + open", async () => {
  const Auto = (props: { defaultOpen?: boolean }) => (
    <CellSelect name="theme" defaultValue="dark" defaultOpen={props.defaultOpen} label="Theme">
      <CellSelect.Item id="light">Light</CellSelect.Item>
      <CellSelect.Item id="dark">Dark</CellSelect.Item>
    </CellSelect>
  );
  await assertSameHtml(
    () => <Auto />,
    () => <Fixture />,
  );
  await assertSameHtml(
    () => <Auto defaultOpen />,
    () => <Fixture defaultOpen />,
  );
});

test("cell-select SSR: secondary variant, defaultOpen popover", async () => {
  const html = await renderToString(() => <Fixture variant="secondary" defaultOpen />);
  assert.match(html, /class="cell-select__trigger cell-select__trigger--secondary"/);
  assert.match(html, /data-slot="cell-select-popover"/);
  assert.match(html, /class="select__popover cell-select__popover"/);
  assert.equal(html.match(/role="option"/g)?.length, 2);
});
