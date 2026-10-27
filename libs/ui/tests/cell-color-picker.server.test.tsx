// Server-target suite: CellColorPicker (Rivet addition, feature set inspired by HeroUI Pro's public Cell Color Picker docs): cell
// trigger button with the variant class, label, uppercase hex value from the picker state, swatch, disabled trigger.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CellColorPicker } from "../src/components/cell-color-picker/index.ts";

test("cell color picker SSR: trigger, label, value, swatch", async () => {
  const html = await renderToString(() => (
    <CellColorPicker defaultValue="#3b82f6">
      <CellColorPicker.Trigger>
        <CellColorPicker.Label>Accent</CellColorPicker.Label>
        <CellColorPicker.ValueDisplay />
        <CellColorPicker.Swatch />
      </CellColorPicker.Trigger>
      <CellColorPicker.Popover>
        <p>panel</p>
      </CellColorPicker.Popover>
    </CellColorPicker>
  ));
  assert.match(html, /cell-color-picker/);
  assert.match(html, /<button[^>]*class="cell-color-picker__trigger cell-color-picker__trigger--default"/);
  assert.match(html, /cell-color-picker__label[^>]*>Accent</);
  assert.match(html, /cell-color-picker__value-display[^>]*>#3B82F6</);
  assert.match(html, /cell-color-picker__swatch/);
  assert.doesNotMatch(html, />panel</);
});

test("cell color picker SSR: secondary, disabled", async () => {
  const html = await renderToString(() => (
    <CellColorPicker defaultValue="#000000" variant="secondary" isDisabled>
      <CellColorPicker.Trigger>
        <CellColorPicker.Label>Text</CellColorPicker.Label>
      </CellColorPicker.Trigger>
    </CellColorPicker>
  ));
  assert.match(html, /cell-color-picker__trigger--secondary/);
  assert.match(html, /<button[^>]*disabled/);
});
