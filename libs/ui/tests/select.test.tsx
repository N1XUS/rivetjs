// DOM-target suite: `Select` (upstream tests/components/select/select.test.tsx + fixtures.tsx ported to happy-dom): data-slots + BEM
// block, open / select / value update (pointer and keyboard), controlled value, disabled, FieldError when invalid, clear button
// (span inside the trigger, click clears without opening, secondary / middle buttons ignored, empty state, disabled root /
// trigger, custom children), clear shortcut (Backspace / Delete, only with a clear button, other keys left to the select).
// Rivet: `@react-aria/test-utils` Select tester → direct pointer / keyboard events; fake timers → `flush()`; parts outside a
// Select; custom indicator child; variants; index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { FieldError } = await import("../src/components/field-error/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { ListBox } = await import("../src/components/list-box/index.ts");
const S = await import("../src/components/select/index.ts");
const { Select } = S;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element, button = 0) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button, buttons: 1 << button, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  if (button === 0) el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
  else el.dispatchEvent(new W.MouseEvent("auxclick", { bubbles: true, cancelable: true, button, detail: 1 }));
}
const key = (el: Element, k: string) => {
  el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  el.dispatchEvent(new W.KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
};
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const root = () => q("[data-testid=select]")!;
const trigger = () => q('[data-slot="select-trigger"]') as HTMLButtonElement;
const listbox = () => q("[role=listbox]");
const options = () => [...document.querySelectorAll("[role=option]")] as HTMLElement[];
const option = (text: string) => options().find((o) => o.textContent!.includes(text))!;
const clearButton = () => q('[data-slot="select-clear-button"]')!;

type FixtureProps = {
  defaultOpen?: boolean;
  isDisabled?: boolean;
  isTriggerDisabled?: boolean;
  isInvalid?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (key: unknown) => void;
  onClear?: () => void;
  withClearButton?: boolean;
  clearButtonChildren?: unknown;
};

const SelectFixture = (props: FixtureProps = {}) => (
  <Select
    data-testid="select"
    defaultOpen={props.defaultOpen}
    defaultValue={props.defaultValue}
    isDisabled={props.isDisabled}
    isInvalid={props.isInvalid}
    placeholder="Select one"
    value={props.value}
    onChange={props.onChange as never}
    onClear={props.onClear}
  >
    <Label>State</Label>
    <Select.Trigger isDisabled={props.isTriggerDisabled}>
      <Select.Value />
      {props.withClearButton ? <Select.ClearButton data-testid="select-clear-button">{props.clearButtonChildren as never}</Select.ClearButton> : null}
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
        <ListBox.Item id="texas" textValue="Texas">
          Texas
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </Select.Popover>
    {props.isInvalid ? <FieldError>Please choose a state</FieldError> : null}
  </Select>
);

const mount = async (props: FixtureProps = {}) => {
  const r = render(() => <SelectFixture {...props} />);
  await flush();
  return r;
};

test("select: index exports", () => {
  assert.equal(Select, S.SelectRoot);
  assert.equal(Select.Root, S.SelectRoot);
  assert.equal(Select.Trigger, S.SelectTrigger);
  assert.equal(Select.Value, S.SelectValue);
  assert.equal(Select.Indicator, S.SelectIndicator);
  assert.equal(Select.ClearButton, S.SelectClearButton);
  assert.equal(Select.Popover, S.SelectPopover);
  assert.equal(S.selectVariants().base(), "select select--primary");
  assert.equal(S.selectVariants({ fullWidth: true }).trigger(), "select__trigger select__trigger--full-width");
});

test("select (upstream): exposes data-slots and BEM block", async () => {
  const r = await mount();
  assert.equal(root().getAttribute("data-slot"), "select");
  assert.match(root().className, /\bselect\b/);
  assert.ok(q('[data-slot="select-trigger"]'));
  assert.ok(q('[data-slot="select-value"]'));
  assert.equal(trigger().className, "select__trigger");
  assert.equal(q('[data-slot="select-value"]')!.className, "select__value");
  assert.equal(q('[data-slot="select-default-indicator"]')!.getAttribute("class"), "select__indicator morph-chevron");
  assert.equal(q('[data-slot="select-value"]')!.getAttribute("data-placeholder"), "true");
  assert.equal(q('[data-slot="select-value"]')!.textContent, "Select one");
  r.unmount();
});

test("select (upstream): open, select, and value update with the pointer", async () => {
  const changes: unknown[] = [];
  const r = await mount({ onChange: (k) => changes.push(k) });
  assert.equal(listbox(), null);
  press(trigger());
  await flush();
  assert.ok(listbox());
  assert.ok(q('[data-slot="select-popover"]'));
  assert.match(q('[data-slot="select-popover"]')!.className, /select__popover/);
  assert.equal(q('[data-slot="select-default-indicator"]')!.getAttribute("data-open"), "true");
  assert.equal(options().length, 3);
  press(option("California"));
  await flush();
  assert.deepEqual(changes, ["california"]);
  assert.equal(listbox(), null);
  assert.match(root().textContent!, /California/);
  // SelectValue renders the item content; the ListBox item indicator inside it is hidden by CSS (`.select__value`).
  assert.ok(q('[data-slot="select-value"] [data-slot="list-box-item-indicator"]'));
  r.unmount();
});

test("select (upstream): open and select via keyboard", async () => {
  const changes: unknown[] = [];
  const r = await mount({ onChange: (k) => changes.push(k) });
  trigger().focus();
  key(trigger(), "ArrowDown");
  await flush();
  assert.ok(listbox());
  const active = () => document.activeElement as HTMLElement;
  assert.equal(active().getAttribute("role"), "option");
  key(active(), "ArrowDown");
  key(active(), "ArrowDown");
  await flush();
  assert.match(active().textContent!, /Texas/);
  key(active(), "Enter");
  await flush();
  assert.deepEqual(changes, ["texas"]);
  assert.equal(listbox(), null);
  assert.match(root().textContent!, /Texas/);
  r.unmount();
});

test("select (upstream): controlled value", async () => {
  const r = await mount({ value: "texas" });
  assert.match(root().textContent!, /Texas/);
  r.unmount();
});

test("select (upstream): disabled state", async () => {
  const changes: unknown[] = [];
  const r = await mount({ isDisabled: true, onChange: (k) => changes.push(k) });
  assert.equal(trigger().disabled, true);
  press(trigger());
  await flush();
  assert.equal(listbox(), null);
  assert.deepEqual(changes, []);
  r.unmount();
});

test("select (upstream): renders FieldError when invalid", async () => {
  const r = await mount({ isInvalid: true });
  assert.match(document.body.textContent!, /Please choose a state/);
  assert.ok(q('[data-slot="field-error"]'));
  assert.equal(root().getAttribute("data-invalid"), "true");
  r.unmount();
});

test("select clear button (upstream): a span inside the trigger, no nested button", async () => {
  const r = await mount({ withClearButton: true, defaultValue: "california" });
  assert.ok(clearButton());
  assert.equal(clearButton().tagName, "SPAN");
  assert.equal(clearButton().getAttribute("aria-hidden"), "true");
  assert.equal(clearButton().className, "select__clear-button");
  assert.ok(trigger().contains(clearButton()));
  assert.equal(trigger().querySelectorAll("button").length, 0);
  assert.ok(q('[data-slot="select-clear-button-icon"]'));
  r.unmount();
});

test("select clear button (upstream): clears on click without opening the listbox", async () => {
  const changes: unknown[] = [];
  let cleared = 0;
  const r = await mount({ withClearButton: true, defaultValue: "california", onChange: (k) => changes.push(k), onClear: () => cleared++ });
  press(clearButton());
  await flush();
  assert.equal(cleared, 1);
  assert.deepEqual(changes, [null]);
  assert.equal(q('[data-slot="select-popover"]'), null);
  assert.match(root().textContent!, /Select one/);
  assert.equal(q('[data-slot="select-value"]')!.getAttribute("data-placeholder"), "true");
  assert.equal(clearButton().getAttribute("data-empty"), "true");
  r.unmount();
});

test("select clear button (upstream): secondary / middle pointer buttons do not clear", async () => {
  let cleared = 0;
  const r = await mount({ withClearButton: true, defaultValue: "california", onClear: () => cleared++ });
  press(clearButton(), 2);
  press(clearButton(), 1);
  await flush();
  assert.equal(cleared, 0);
  assert.match(root().textContent!, /California/);
  r.unmount();
});

test("select clear button (upstream): empty state, clicks ignored with no selection", async () => {
  let cleared = 0;
  const r = await mount({ withClearButton: true, onClear: () => cleared++ });
  assert.equal(clearButton().getAttribute("data-empty"), "true");
  press(clearButton());
  await flush();
  assert.equal(cleared, 0);
  r.unmount();
});

test("select clear button (upstream): no clear when the select is disabled", async () => {
  let cleared = 0;
  const r = await mount({ isDisabled: true, withClearButton: true, defaultValue: "california", onClear: () => cleared++ });
  clearButton().dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
  await flush();
  assert.equal(cleared, 0);
  assert.match(root().textContent!, /California/);
  r.unmount();
});

test("select clear button (upstream): no clear when only the trigger is disabled", async () => {
  let cleared = 0;
  const r = await mount({ isTriggerDisabled: true, withClearButton: true, defaultValue: "california", onClear: () => cleared++ });
  clearButton().dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
  await flush();
  assert.equal(cleared, 0);
  assert.match(root().textContent!, /California/);
  r.unmount();
});

test("select clear button (upstream): custom children replace the default icon", async () => {
  const r = await mount({ withClearButton: true, defaultValue: "california", clearButtonChildren: <span data-testid="custom-clear-icon" /> });
  assert.ok(q("[data-testid=custom-clear-icon]"));
  assert.equal(q('[data-slot="select-clear-button-icon"]'), null);
  r.unmount();
});

test("select clear shortcut (upstream): Backspace / Delete clear, only with a clear button; other keys open", async () => {
  for (const k of ["Backspace", "Delete"]) {
    const changes: unknown[] = [];
    let cleared = 0;
    const r = await mount({ withClearButton: true, defaultValue: "california", onChange: (c) => changes.push(c), onClear: () => cleared++ });
    trigger().focus();
    assert.equal(document.activeElement, trigger());
    key(trigger(), k);
    await flush();
    assert.equal(cleared, 1, k);
    assert.deepEqual(changes, [null], k);
    assert.match(root().textContent!, /Select one/);
    assert.equal(q('[data-slot="select-popover"]'), null);
    r.unmount();
  }
  {
    const changes: unknown[] = [];
    const r = await mount({ defaultValue: "california", onChange: (c) => changes.push(c) });
    trigger().focus();
    key(trigger(), "Backspace");
    await flush();
    assert.deepEqual(changes, []);
    assert.match(root().textContent!, /California/);
    r.unmount();
  }
  {
    const changes: unknown[] = [];
    const r = await mount({ withClearButton: true, defaultValue: "california", onChange: (c) => changes.push(c) });
    trigger().focus();
    key(trigger(), "ArrowDown");
    await flush();
    assert.deepEqual(changes, []);
    assert.ok(q('[data-slot="select-popover"]'));
    r.unmount();
  }
});

test("select: custom indicator child in a slot span; variants; parts outside a Select", async () => {
  const r = render(() => (
    <>
      <Select data-testid="select" variant="secondary" fullWidth aria-label="Pick">
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator class="extra">
            <i data-testid="custom-indicator" />
          </Select.Indicator>
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="a">A</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Select.Indicator data-testid="lone" />
    </>
  ));
  await flush();
  assert.equal(root().className, "select select--full-width select--secondary");
  assert.equal(trigger().className, "select__trigger select__trigger--full-width");
  const ind = q('[data-slot="select-indicator"]')!;
  assert.equal(ind.tagName, "SPAN");
  assert.equal(ind.className, "select__indicator extra");
  assert.ok(ind.querySelector("[data-testid=custom-indicator]"));
  assert.equal(q('[data-slot="select-default-indicator"]')?.getAttribute("data-testid"), "lone");
  assert.equal(q("[data-testid=lone]")!.getAttribute("class"), "morph-chevron", "outside a Select: the bare morph chevron");
  r.unmount();
});

/* ------------------------------------------------------------------ Rivet: Select.Item + auto form (identity spec §4.2) */

test("select (Rivet): auto form = compound markup; Select.Item adds the indicator + textValue from string children", async () => {
  const short = render(() => (
    <Select data-testid="select" label="State" placeholder="Select one">
      <Select.Item id="florida">Florida</Select.Item>
      <Select.Item id="texas">Texas</Select.Item>
    </Select>
  ));
  await flush();
  const shape = () => [...document.querySelectorAll("[data-slot]")].map((el) => `${el.tagName}.${el.getAttribute("class")}[${el.getAttribute("data-slot")}]`);
  const closed = shape();
  press(trigger());
  await flush();
  const open = shape();
  const texts = options().map((o) => o.textContent);
  assert.equal(options()[0]!.querySelectorAll('[data-slot="list-box-item-indicator"]').length, 1);
  key(listbox()!, "t");
  await flush();
  assert.equal(document.activeElement?.textContent, "Texas");
  short.unmount();
  const compound = render(() => (
    <Select data-testid="select" placeholder="Select one">
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  ));
  await flush();
  assert.deepEqual(closed, shape());
  press(trigger());
  await flush();
  assert.deepEqual(open, shape());
  assert.deepEqual(texts, ["Florida", "Texas"]);
  compound.unmount();
});

test("select (Rivet): items + render function, two-way value signal", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const states = [
    { id: "ca", name: "California" },
    { id: "tx", name: "Texas" },
  ];
  const value = signal<string | null>("tx");
  const r = render(() => (
    <Select data-testid="select" aria-label="State" items={states} value={value as never}>
      {(item: { id: string; name: string }) => <Select.Item id={item.id}>{item.name}</Select.Item>}
    </Select>
  ));
  await flush();
  assert.equal(q('[data-slot="label"]') === null, true);
  assert.equal(q('[data-slot="select-value"]')!.textContent, "Texas");
  press(trigger());
  await flush();
  assert.deepEqual(
    options().map((o) => o.textContent),
    ["California", "Texas"],
  );
  press(option("California"));
  await flush();
  assert.equal(value(), "ca");
  assert.equal(q('[data-slot="select-value"]')!.textContent, "California");
  r.unmount();
});
