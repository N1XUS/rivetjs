// `<textarea>` `value` through the DOM attribute writer (`dom-attr.ts` `write`, used by spreads / `_attrs`): the property and
// the content default, never a `value` attribute — the server writes it as content (`server-spread.ts`). SELECT-B 2026-10-28:
// an adopted cdk TextArea lost its server text (`defaultValue` "", a form reset emptied it) and gained `value="…"`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { write } from "../dom-attr.ts";

const window = new Window({ url: "http://localhost/" });
const doc = window.document as unknown as Document;

test("textarea value writes the property and the content default, no attribute", () => {
  const host = doc.createElement("div");
  host.innerHTML = "<textarea>Roses are red</textarea>";
  const area = host.firstElementChild as HTMLTextAreaElement;
  write(area, "value", "Roses are red");
  assert.equal(area.value, "Roses are red");
  assert.equal(area.defaultValue, "Roses are red");
  assert.equal(area.hasAttribute("value"), false);
  write(area, "value", "Violets");
  assert.equal(area.value, "Violets");
  assert.equal(area.defaultValue, "Violets");
  assert.equal(area.hasAttribute("value"), false);
  // An empty server text (the node removed) comes back from the written value.
  area.textContent = "";
  write(area, "value", "Violets");
  assert.equal(area.defaultValue, "Violets");
  write(area, "value", null);
  assert.equal(area.value, "");
  assert.equal(area.defaultValue, "");
});

test("input value still writes the attribute (server parity)", () => {
  const input = doc.createElement("input");
  write(input, "value", "a");
  assert.equal(input.value, "a");
  assert.equal(input.getAttribute("value"), "a");
});
