import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static guard for the transition audit (2026-10-08): every interactive element below eases the property its state
// changes (hover / pressed / selected / disabled …) instead of snapping. Reads the raw component CSS: the block that
// starts with `selector {` must declare a `transition` (top level of that block) naming each property.

const styles = new URL("../styles/components/", import.meta.url);

/** Top-level declarations text of the first block opened by `start` (e.g. `.button {`). */
function block(file: string, start: string): string {
  const css = readFileSync(new URL(file, styles), "utf8");
  // Prefer a top-level rule (at a line start): the same selector may appear nested in another block first.
  const top = css.indexOf(`\n${start}`);
  const at = top >= 0 ? top + 1 : css.indexOf(start);
  assert.ok(at >= 0, `${file}: no block "${start}"`);
  let depth = 0;
  let out = "";
  for (let i = at + start.length - 1; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      depth++;
      if (depth === 1) continue;
    } else if (c === "}") {
      depth--;
      if (depth === 0) break;
    }
    if (depth === 1) out += c;
  }
  return out;
}

function transitioned(file: string, start: string): string[] {
  const body = block(file, start);
  const m = body.match(/(?:^|[;\s])transition:\s*([^;]+);/);
  assert.ok(m, `${file} "${start}": no transition declaration`);
  return m[1].split(",").map((part) => part.trim().split(/\s+/)[0]);
}

const CASES: [file: string, start: string, props: string[]][] = [
  // Vendored HeroUI (TWEAKS.md rows)
  ["button.css", ".button {", ["background-color", "color", "opacity", "transform"]],
  ["toggle-button.css", ".toggle-button {", ["background-color", "color"]],
  ["close-button.css", ".close-button {", ["opacity", "background-color"]],
  ["accordion.css", ".accordion__trigger {", ["background-color"]],
  ["select.css", '&:not([data-empty="true"]) {', ["opacity", "background-color", "transform"]],
  ["autocomplete.css", '&:not([data-empty="true"]) {', ["opacity", "background-color", "transform"]],
  ["toast.css", ".toast__close-button {", ["opacity", "background-color"]],
  ["radio.css", ".radio__control {", ["scale"]],
  ["number-field.css", ".number-field__increment-button,", ["transform", "opacity"]],
  ["switch.css", ".switch__thumb {", ["box-shadow", "color"]],
  ["calendar.css", ".calendar__cell {", ["background-color", "color"]],
  ["calendar.css", ".calendar__nav-button {", ["color"]],
  ["range-calendar.css", ".range-calendar__cell {", ["background-color"]],
  ["range-calendar.css", ".range-calendar__cell-button {", ["background-color", "color"]],
  ["range-calendar.css", ".range-calendar__nav-button {", ["color"]],
  ["table.css", ".table__cell {", ["background-color"]],
  ["table.css", ".table__column {", ["color"]],
  ["table.css", ".table__row {", ["opacity"]],
  ["list-box-item.css", ".list-box-item {", ["background-color"]],
  ["menu-item.css", ".menu-item {", ["background-color"]],
  // Rivet-authored
  ["number-stepper.css", ".number-stepper__button {", ["opacity", "background-color"]],
  ["chart.css", ".chart__guide {", ["opacity"]],
  ["chart.css", ".chart__dot {", ["opacity"]],
  ["rating.css", ".rating__fill {", ["clip-path", "scale"]],
  ["sidebar.css", ".sidebar__group-action,", ["background-color", "opacity"]],
  ["sidebar.css", ".sidebar__menu-actions {", ["opacity"]],
  ["sidebar.css", ".sidebar__menu-badge {", ["opacity"]],
  ["sidebar.css", ".sidebar__menu-chip {", ["opacity"]],
  ["data-grid.css", ".data-grid .table__row .data-grid__cell[data-pinned] {", ["background-color", "--data-grid-pinned-state"]],
  ["data-grid.css", ".data-grid__expand {", ["background-color", "color"]],
  ["chat-tool.css", ".chat-tool__trigger {", ["color"]],
  ["markdown.css", ".markdown__link {", ["text-decoration-color"]],
];

test("interactive components declare a transition for the property their state changes", () => {
  for (const [file, start, props] of CASES) {
    const have = transitioned(file, start);
    for (const p of props) assert.ok(have.includes(p), `${file} "${start}": transition lacks ${p} (has ${have.join(", ")})`);
  }
});

test("every transitioned block keeps the reduced-motion opt-out", () => {
  for (const [file, start] of CASES) {
    const body = block(file, start);
    const css = readFileSync(new URL(file, styles), "utf8");
    const reduced = /motion-reduce:transition-none/.test(body) || /prefers-reduced-motion/.test(css);
    assert.ok(reduced, `${file} "${start}": no reduced-motion opt-out`);
  }
});
