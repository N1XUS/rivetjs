// `dom-v2-controls.ts` unit behaviour (happy-dom): v1 `bindModel` / `bindSelectValue` / `bindRCData`
// validation errors, owner disposal detaching listeners / observers / text nodes, no writes after
// disposal. Browser parity vs v1: dom-v2-controls-browser.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createRoot, signal } from "@rivetjs/reactivity";
import { _model, _rcdata, _select } from "../dom-v2-controls.ts";

const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, { MutationObserver: window.MutationObserver });
const doc = window.document as unknown as Document;
const el = <T extends Element>(html: string) => {
  const host = doc.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as T;
};

test("_model validates like bindModel and stops writing once disposed", () => {
  const input = el<HTMLInputElement>('<input type="number">');
  assert.throws(() => createRoot(() => _model(input, "value", signal(""))), /Unsupported model/);
  assert.throws(() => createRoot(() => _model(el("<input>"), "value", (() => "") as never)), /writable signal/);
  const text = el<HTMLInputElement>("<input>");
  const value = signal("a");
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    _model(text, "value", value);
  });
  assert.equal(text.value, "a");
  text.value = "b";
  text.dispatchEvent(new window.Event("input") as never);
  assert.equal(value(), "b");
  dispose();
  text.value = "c";
  text.dispatchEvent(new window.Event("input") as never);
  assert.equal(value(), "b");
  assert.throws(() => createRoot(() => _model(el("<input>"), "value", signal(1) as never)), /Invalid model signal value/);
});

test("_select re-applies on option changes until disposed", async () => {
  const select = el<HTMLSelectElement>('<select><option value="a">A</option></select>');
  const pick = signal("b");
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    _select(select, pick);
  });
  const option = doc.createElement("option");
  option.value = "b";
  select.append(option);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(select.value, "b");
  dispose();
  pick.set("a");
  assert.equal(select.value, "b");
});

test("_rcdata keeps one Text node per part, rejects non-scalar parts, removes its nodes on disposal", () => {
  const area = el<HTMLTextAreaElement>("<textarea>x</textarea>");
  const n = signal<unknown>(1);
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    _rcdata(area, ["n=", () => n() as number]);
  });
  assert.equal(area.childNodes.length, 2);
  assert.equal(area.value, "n=1");
  n.set(false);
  assert.equal(area.value, "n=");
  assert.throws(() => n.set({}), /must be scalar text/);
  dispose();
  assert.equal(area.childNodes.length, 0);
  assert.throws(() => createRoot(() => _rcdata(el("<div></div>") as never, [])), /requires textarea or title/);
  assert.throws(() => createRoot(() => _rcdata(el("<title></title>") as never, [1 as never])), /Invalid RCDATA part/);
});

test("_select preserves conversion, duplicate options and mutation reapplication for large selections", async () => {
  const select = el<HTMLSelectElement>(
    '<select multiple><option value="1">One</option><option value="1">Duplicate</option><option value="NaN">NaN</option><option value="null">Null</option><option value="missing">Missing</option></select>',
  );
  const value = signal<unknown[]>([...Array.from({ length: 20 }, (_, i) => i), 1, NaN, null]);
  const root = createRoot(() => _select(select, value));
  assert.deepEqual(
    [...select.options].map((o) => o.selected),
    [true, true, true, true, false],
  );
  select.options[4]!.value = "19";
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(select.options[4]!.selected);
  value.set([1]);
  assert.deepEqual(
    [...select.options].map((o) => o.selected),
    [true, true, false, false, false],
  );
  value.set([]);
  assert.ok([...select.options].every((o) => !o.selected));
  root.dispose();
});
