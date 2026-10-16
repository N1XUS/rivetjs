// DOM-target suite: `ComboBox` (upstream tests/components/combo-box/combo-box.test.tsx + fixtures.tsx ported to happy-dom):
// data-slots + BEM block, open + select (trigger press, option press → `onChange` + input value), filtering while typing, disabled,
// default selected value, FieldError when invalid.
// Rivet: `@react-aria/test-utils` ComboBox tester / user-event → direct pointer / input events; fake timers → `flush()`; Input
// variant from the ComboBox context; trigger `data-open` + default icon; full-width + popover classes; parts outside a ComboBox;
// index exports.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Description } = await import("../src/components/description/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");
const { Input } = await import("../src/components/input/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { ListBox } = await import("../src/components/list-box/index.ts");
const C = await import("../src/components/combo-box/index.ts");
const { ComboBox } = C;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; InputEvent: typeof InputEvent; Event: typeof Event };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
function type(el: HTMLInputElement, text: string) {
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new W.InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
  }
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const root = () => q("[data-testid=combo-box]")!;
const input = () => q("[role=combobox]") as HTMLInputElement;
const trigger = () => q('[data-slot="combo-box-trigger"]') as HTMLButtonElement;
const listbox = () => q("[role=listbox]");
const options = () => [...document.querySelectorAll("[role=option]")] as HTMLElement[];
const option = (text: string) => options().find((o) => o.textContent!.includes(text))!;

type FixtureProps = {
  isDisabled?: boolean;
  isInvalid?: boolean;
  defaultValue?: string;
  onChange?: (key: unknown) => void;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

const ComboBoxFixture = (props: FixtureProps = {}) => (
  <ComboBox
    data-testid="combo-box"
    defaultValue={props.defaultValue}
    fullWidth={props.fullWidth}
    isDisabled={props.isDisabled}
    isInvalid={props.isInvalid}
    variant={props.variant}
    onChange={props.onChange as never}
  >
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
        <ListBox.Item id="panda" textValue="Panda">
          Panda
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </ComboBox.Popover>
    {props.isInvalid ? <FieldError>Please choose an animal</FieldError> : null}
  </ComboBox>
);

let mounted: { unmount(): void } | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  document.body.innerHTML = "";
});
const mount = async (props: FixtureProps = {}) => {
  const r = (mounted = render(() => <ComboBoxFixture {...props} />));
  await flush();
  return r;
};

test("combo-box: index exports", () => {
  assert.equal(ComboBox, C.ComboBoxRoot);
  assert.equal(ComboBox.Root, C.ComboBoxRoot);
  assert.equal(ComboBox.InputGroup, C.ComboBoxInputGroup);
  assert.equal(ComboBox.Value, C.ComboBoxValue);
  assert.equal(ComboBox.Trigger, C.ComboBoxTrigger);
  assert.equal(ComboBox.Popover, C.ComboBoxPopover);
  assert.equal(ComboBox.Item, C.ComboBoxItem);
  assert.ok(C.ComboBoxContext);
  assert.equal(C.comboBoxVariants().base(), "combo-box");
  assert.equal(C.comboBoxVariants({ fullWidth: true }).inputGroup(), "combo-box__input-group combo-box__input-group--full-width");
});

test("combo-box (upstream): exposes data-slots and BEM block", async () => {
  const r = await mount();
  assert.equal(root().getAttribute("data-slot"), "combo-box");
  assert.match(root().className, /\bcombo-box\b/);
  const group = q('[data-slot="combo-box-input-group"]')!;
  assert.ok(group);
  assert.equal(group.getAttribute("role"), "group");
  assert.equal(group.className, "combo-box__input-group");
  assert.ok(q('[data-slot="combo-box-trigger"]'));
  assert.equal(trigger().className, "combo-box__trigger");
  assert.ok(group.contains(input()) && group.contains(trigger()));
  assert.ok(q('[data-slot="combo-box-trigger-default-icon"]'));
  assert.equal(input().getAttribute("data-slot"), "input");
  assert.equal(input().className, "input input--primary");
  r.unmount();
});

test("combo-box (upstream): open and select", async () => {
  const changes: unknown[] = [];
  const r = await mount({ onChange: (k) => changes.push(k) });
  assert.equal(listbox(), null);
  press(trigger());
  await flush();
  assert.ok(listbox());
  assert.ok(q('[data-slot="combo-box-popover"]'));
  assert.match(q('[data-slot="combo-box-popover"]')!.className, /combo-box__popover/);
  assert.equal(trigger().getAttribute("data-open"), "true");
  assert.equal(options().length, 3);
  press(option("Dog"));
  await flush();
  assert.deepEqual(changes, ["dog"]);
  assert.equal(input().value, "Dog");
  assert.equal(listbox(), null);
  assert.equal(trigger().getAttribute("data-open"), null);
  r.unmount();
});

test("combo-box (upstream): filters options while typing", async () => {
  const r = await mount();
  input().focus();
  type(input(), "pa");
  await flush();
  assert.ok(listbox());
  assert.ok(option("Panda"));
  assert.equal(options().length, 1);
  r.unmount();
});

test("combo-box (upstream): disabled state", async () => {
  const changes: unknown[] = [];
  const r = await mount({ isDisabled: true, onChange: (k) => changes.push(k) });
  assert.equal(input().disabled, true);
  press(trigger());
  await flush();
  assert.equal(listbox(), null);
  assert.deepEqual(changes, []);
  r.unmount();
});

test("combo-box (upstream): renders default selected value", async () => {
  const r = await mount({ defaultValue: "cat" });
  assert.equal(input().value, "Cat");
  r.unmount();
});

test("combo-box (upstream): renders FieldError when invalid", async () => {
  const r = await mount({ isInvalid: true });
  assert.match(document.body.textContent!, /Please choose an animal/);
  assert.ok(q('[data-slot="field-error"]'));
  assert.equal(root().getAttribute("data-invalid"), "true");
  r.unmount();
});

test("combo-box: Input takes the ComboBox variant; fullWidth classes", async () => {
  const r = await mount({ variant: "secondary", fullWidth: true });
  assert.equal(input().className, "input input--secondary");
  assert.match(root().className, /combo-box--full-width/);
  assert.match(q('[data-slot="combo-box-input-group"]')!.className, /combo-box__input-group--full-width/);
  r.unmount();
});

test("combo-box: menuTrigger defaults to focus", async () => {
  const r = await mount();
  input().focus();
  await flush();
  assert.ok(listbox());
  r.unmount();
});

test("combo-box: parts outside a ComboBox keep only the caller's class", async () => {
  const r = render(() => <ComboBox.InputGroup class="x">{null}</ComboBox.InputGroup>);
  await flush();
  assert.equal(q('[data-slot="combo-box-input-group"]')!.className, "x");
  r.unmount();
});

/* ------------------------------------------------------------------ Rivet: ComboBox.Item + auto form (identity spec §4.2, plan T22) */

test("combo-box (Rivet): auto form = compound markup; ComboBox.Item adds the indicator + textValue from string children", async () => {
  const shape = () => [...document.querySelectorAll("[data-slot]")].map((el) => `${el.tagName}.${el.getAttribute("class")}[${el.getAttribute("data-slot")}]`);
  const short = render(() => (
    <ComboBox data-testid="combo-box" label="Favorite Animal" placeholder="Search animals..." description="Pick one">
      <ComboBox.Item id="cat">Cat</ComboBox.Item>
      <ComboBox.Item id="dog">Dog</ComboBox.Item>
    </ComboBox>
  ));
  await flush();
  const closed = shape();
  assert.equal(input().getAttribute("placeholder"), "Search animals...");
  press(trigger());
  await flush();
  const open = shape();
  assert.equal(options()[0]!.querySelectorAll('[data-slot="list-box-item-indicator"]').length, 1);
  type(input(), "d");
  await flush();
  assert.deepEqual(
    options().map((o) => o.textContent),
    ["Dog"],
  );
  short.unmount();
  const compound = render(() => (
    <ComboBox data-testid="combo-box">
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
      <Description>Pick one</Description>
    </ComboBox>
  ));
  await flush();
  assert.deepEqual(closed, shape());
  press(trigger());
  await flush();
  assert.deepEqual(open, shape());
  compound.unmount();
});

test("combo-box (Rivet): items + render function on the root, two-way value signal", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const animals = [
    { id: "cat", name: "Cat" },
    { id: "dog", name: "Dog" },
  ];
  const value = signal<string | null>("dog");
  const r = render(() => (
    <ComboBox data-testid="combo-box" aria-label="Animal" items={animals} value={value as never}>
      {(item: { id: string; name: string }) => <ComboBox.Item id={item.id}>{item.name}</ComboBox.Item>}
    </ComboBox>
  ));
  await flush();
  assert.equal(q('[data-slot="label"]'), null);
  assert.equal(input().value, "Dog");
  press(trigger());
  await flush();
  assert.deepEqual(
    options().map((o) => o.textContent),
    ["Cat", "Dog"],
  );
  press(option("Cat"));
  await flush();
  assert.equal(value(), "cat");
  assert.equal(input().value, "Cat");
  r.unmount();
});

test("combo-box (Rivet): errorMessage renders the FieldError while invalid", async () => {
  const r = render(() => (
    <ComboBox data-testid="combo-box" label="Animal" isInvalid errorMessage="Pick an animal">
      <ComboBox.Item id="cat">Cat</ComboBox.Item>
    </ComboBox>
  ));
  await flush();
  assert.equal(q('[data-slot="field-error"]')?.textContent, "Pick an animal");
  r.unmount();
});
