// DOM-target suite: `InputGroup`, `SearchField`, `NumberField` (upstream input-group / search-field / number-field tests ported).
// Typing = `value` + an `input` event and presses = `click` (happy-dom; upstream user-event); keyboard focus-visible runs in Chromium
// (`tests-components/forms.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { InputGroup, InputGroupRoot, inputGroupVariants } = await import("../src/components/input-group/index.ts");
const { SearchField, SearchFieldRoot, searchFieldVariants } = await import("../src/components/search-field/index.ts");
const { NumberField, NumberFieldRoot, numberFieldVariants } = await import("../src/components/number-field/index.ts");
const { TextField } = await import("../src/components/textfield/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { FieldError } = await import("../src/components/field-error/index.ts");

const type = (el: HTMLInputElement, text: string) => {
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
};
const slot = (root: ParentNode, name: string) => root.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;
/** A virtual click (`detail: 0`, RA usePress `isVirtualClick`): happy-dom has no PointerEvent. */
const press = (el: Element) => (el as HTMLElement).click();

/* ------------------------------------------------------------------ InputGroup */

const renderGroup = (extra: Record<string, unknown> = {}) =>
  render(() => (
    <TextField name="amount" {...extra}>
      <Label>Amount</Label>
      <InputGroup>
        <InputGroup.Prefix>$</InputGroup.Prefix>
        <InputGroup.Input placeholder="0.00" />
        <InputGroup.Suffix>USD</InputGroup.Suffix>
      </InputGroup>
    </TextField>
  ));

test("input-group: compound data-slots under TextField, BEM block, accessible name", () => {
  const r = renderGroup();
  for (const s of ["input-group", "input-group-prefix", "input-group-input", "input-group-suffix"]) assert.ok(slot(r.container, s), s);
  const slots = inputGroupVariants({});
  assert.equal(slot(r.container, "input-group")!.className, slots.base());
  assert.equal(slot(r.container, "input-group-input")!.className, slots.input());
  assert.equal(slot(r.container, "input-group-prefix")!.className, slots.prefix());
  assert.equal(slot(r.container, "input-group-suffix")!.className, slots.suffix());
  const input = r.container.querySelector("input")!;
  const label = r.container.querySelector("[data-slot=label]")!;
  assert.equal(input.getAttribute("aria-labelledby"), label.id);
  assert.equal(label.textContent, "Amount");
  r.unmount();
});

test("input-group: clicking Prefix / Suffix focuses the input; onClick still called", () => {
  const clicks: number[] = [];
  const r = render(() => (
    <InputGroup aria-label="Amount" onClick={() => clicks.push(1)}>
      <InputGroup.Prefix>$</InputGroup.Prefix>
      <InputGroup.Input aria-label="Amount" />
      <InputGroup.Suffix>USD</InputGroup.Suffix>
    </InputGroup>
  ));
  document.body.appendChild(r.container);
  const input = r.container.querySelector("input")!;
  slot(r.container, "input-group-prefix")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(document.activeElement, input);
  input.blur();
  slot(r.container, "input-group-suffix")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(document.activeElement, input);
  assert.equal(clicks.length, 2);
  r.unmount();
  (r.container as Element).remove();
});

test("input-group: inherited variant from TextField; disabled via TextField; TextArea slot", () => {
  const r = renderGroup({ variant: "secondary", isDisabled: true });
  assert.match(slot(r.container, "input-group")!.className, /\binput-group--secondary\b/);
  assert.equal(r.container.querySelector("input")!.disabled, true);
  r.unmount();
  const t = render(() => (
    <TextField name="notes">
      <Label>Notes</Label>
      <InputGroup>
        <InputGroup.TextArea />
      </InputGroup>
    </TextField>
  ));
  const ta = slot(t.container, "input-group-textarea")!;
  assert.equal(ta.tagName, "TEXTAREA");
  assert.equal(ta.className, inputGroupVariants({}).input());
  assert.equal(ta.getAttribute("aria-labelledby"), t.container.querySelector("[data-slot=label]")!.id);
  t.unmount();
});

test("input-group: parts outside a group get only the caller's class; fullWidth; live variant in place; exports", async () => {
  const r = render(() => <InputGroup.Prefix class="x">$</InputGroup.Prefix>);
  assert.equal(slot(r.container, "input-group-prefix")!.className, "x");
  r.unmount();
  const variant = signal<"primary" | "secondary">("primary");
  const g = render(() => (
    <InputGroup aria-label="A" fullWidth variant={variant()}>
      <InputGroup.Input aria-label="A" />
    </InputGroup>
  ));
  const root = slot(g.container, "input-group")!;
  const input = g.container.querySelector("input")!;
  assert.equal(root.className, inputGroupVariants({ fullWidth: true, variant: "primary" }).base());
  variant.set("secondary");
  await flush();
  assert.equal(slot(g.container, "input-group"), root);
  assert.equal(g.container.querySelector("input"), input);
  assert.equal(root.className, inputGroupVariants({ fullWidth: true, variant: "secondary" }).base());
  g.unmount();
  assert.equal(InputGroup, InputGroupRoot);
  assert.equal(InputGroup.Root, InputGroupRoot);
});

/* ------------------------------------------------------------------ SearchField */

const renderSearch = (extra: Record<string, unknown> = {}) =>
  render(() => (
    <SearchField name="search" {...extra}>
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder="Search..." />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  ));

test("search-field: search role with accessible name; compound data-slots and BEM block", () => {
  const r = renderSearch();
  const input = r.container.querySelector("input")!;
  assert.equal(input.type, "search");
  assert.equal(input.getAttribute("aria-labelledby"), r.container.querySelector("[data-slot=label]")!.id);
  const slots = searchFieldVariants({});
  assert.match(slot(r.container, "search-field")!.className, new RegExp(`^${slots.base()}\\b`));
  assert.equal(slot(r.container, "search-field-group")!.className, slots.group());
  assert.equal(slot(r.container, "search-field-input")!.className, slots.input());
  const icon = slot(r.container, "search-field-search-icon")!;
  assert.equal(icon.tagName.toLowerCase(), "svg");
  assert.equal(icon.getAttribute("class"), slots.searchIcon());
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.match(slot(r.container, "search-field-clear-button")!.className, new RegExp(slots.clearButton()));
  assert.equal(slot(r.container, "search-field-clear-button")!.getAttribute("slot"), "clear");
  r.unmount();
});

test("search-field: variant BEM modifier", () => {
  const r = renderSearch({ variant: "secondary" });
  assert.match(slot(r.container, "search-field")!.className, /\bsearch-field--secondary\b/);
  r.unmount();
});

test("search-field: typing calls onChange; clear button empties it (data-empty)", async () => {
  const calls: string[] = [];
  const r = renderSearch({ onChange: (v: string) => calls.push(v) });
  const input = r.container.querySelector("input")!;
  type(input, "hero");
  assert.equal(input.value, "hero");
  assert.equal(calls.at(-1), "hero");
  r.unmount();

  const changes: string[] = [];
  const c = renderSearch({ defaultValue: "hero", onChange: (v: string) => changes.push(v) });
  const field = slot(c.container, "search-field")!;
  assert.equal(field.hasAttribute("data-empty"), false);
  press(slot(c.container, "search-field-clear-button")!);
  await flush();
  assert.equal(c.container.querySelector("input")!.value, "");
  assert.deepEqual(changes, [""]);
  assert.equal(field.getAttribute("data-empty"), "true");
  c.unmount();
});

test("search-field: disabled state; FieldError when invalid", () => {
  const calls: string[] = [];
  const r = renderSearch({ isDisabled: true, onChange: (v: string) => calls.push(v) });
  assert.equal(r.container.querySelector("input")!.disabled, true);
  assert.equal(slot(r.container, "search-field")!.getAttribute("data-disabled"), "true");
  r.unmount();
  const e = render(() => (
    <SearchField isInvalid isRequired name="search" value="ab">
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input />
        <SearchField.ClearButton />
      </SearchField.Group>
      <FieldError>Enter at least 3 characters</FieldError>
    </SearchField>
  ));
  assert.equal(slot(e.container, "field-error")?.textContent, "Enter at least 3 characters");
  assert.equal(slot(e.container, "search-field")!.getAttribute("data-invalid"), "true");
  e.unmount();
});

test("search-field: custom SearchIcon children wrap in the slot span; exports", () => {
  const r = render(() => (
    <SearchField aria-label="Find">
      <SearchField.Group>
        <SearchField.SearchIcon>
          <b>?</b>
        </SearchField.SearchIcon>
        <SearchField.Input />
      </SearchField.Group>
    </SearchField>
  ));
  const icon = slot(r.container, "search-field-search-icon")!;
  assert.equal(icon.tagName, "SPAN");
  assert.equal(icon.className, searchFieldVariants({}).searchIcon());
  assert.equal(icon.querySelector("b")!.textContent, "?");
  r.unmount();
  assert.equal(SearchField, SearchFieldRoot);
});

/* ------------------------------------------------------------------ NumberField */

const renderNumber = (extra: Record<string, unknown> = {}) =>
  render(() => (
    <NumberField defaultValue={10} minValue={0} name="width" {...extra}>
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  ));

test("number-field: textbox with accessible name + roledescription; compound data-slots and BEM block", () => {
  const r = renderNumber();
  const input = slot(r.container, "number-field-input") as HTMLInputElement;
  assert.equal(input.getAttribute("role"), null);
  assert.equal(input.getAttribute("aria-roledescription"), "Number field");
  assert.ok(input.getAttribute("aria-labelledby")!.includes(r.container.querySelector("[data-slot=label]")!.id));
  const slots = numberFieldVariants({});
  assert.match(slot(r.container, "number-field")!.className, new RegExp(`^${slots.base()}\\b`));
  assert.equal(slot(r.container, "number-field-group")!.className, slots.group());
  assert.equal(input.className, slots.input());
  assert.equal(slot(r.container, "number-field-increment-button")!.className, slots.incrementButton());
  assert.equal(slot(r.container, "number-field-decrement-button")!.className, slots.decrementButton());
  assert.ok(slot(r.container, "number-field-increment-button-icon"));
  assert.ok(slot(r.container, "number-field-decrement-button-icon"));
  r.unmount();
});

for (const [description, hasDecrement, hasIncrement] of [
  ["no stepper buttons", false, false],
  ["only a decrement button", true, false],
  ["only an increment button", false, true],
  ["both stepper buttons", true, true],
] as const) {
  test(`number-field: composition with ${description}`, () => {
    const r = render(() => (
      <NumberField defaultValue={11} name="customer-number">
        <Label>Customer number</Label>
        <NumberField.Group data-testid="number-field-group">
          {hasDecrement ? <NumberField.DecrementButton /> : null}
          <NumberField.Input />
          {hasIncrement ? <NumberField.IncrementButton /> : null}
        </NumberField.Group>
      </NumberField>
    ));
    const group = r.container.querySelector("[data-testid=number-field-group]")!;
    assert.equal(group.querySelector('[slot="decrement"]') !== null, hasDecrement);
    assert.equal(group.querySelector('[slot="increment"]') !== null, hasIncrement);
    r.unmount();
  });
}

test("number-field: variant BEM modifier", () => {
  const r = renderNumber({ variant: "secondary" });
  assert.match(slot(r.container, "number-field")!.className, /\bnumber-field--secondary\b/);
  r.unmount();
});

test("number-field: typing a value calls onChange on commit (blur)", async () => {
  const calls: number[] = [];
  const r = render(() => (
    <NumberField defaultValue={0} name="width" onChange={(v: number) => calls.push(v)}>
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  ));
  document.body.appendChild(r.container);
  const input = slot(r.container, "number-field-input") as HTMLInputElement;
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  type(input, "42");
  input.blur();
  await flush();
  assert.equal(calls.at(-1), 42);
  r.unmount();
  (r.container as Element).remove();
});

test("number-field: stepper buttons increment / decrement; ArrowUp / ArrowDown on the input", async () => {
  const calls: number[] = [];
  const r = renderNumber({ defaultValue: 10, onChange: (v: number) => calls.push(v) });
  document.body.appendChild(r.container);
  press(slot(r.container, "number-field-increment-button")!);
  await flush();
  assert.equal(calls.at(-1), 11);
  press(slot(r.container, "number-field-decrement-button")!);
  await flush();
  assert.equal(calls.at(-1), 10);
  const input = slot(r.container, "number-field-input") as HTMLInputElement;
  input.focus();
  input.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
  );
  await flush();
  assert.equal(calls.at(-1), 11);
  input.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
  );
  await flush();
  assert.equal(calls.at(-1), 10);
  r.unmount();
  (r.container as Element).remove();
});

test("number-field: maxValue and invalid state", async () => {
  const calls: number[] = [];
  const r = render(() => (
    <NumberField isInvalid defaultValue={9} maxValue={10} minValue={0} name="width" onChange={(v: number) => calls.push(v)}>
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input />
        <NumberField.IncrementButton />
      </NumberField.Group>
      <FieldError>Max is 10</FieldError>
    </NumberField>
  ));
  document.body.appendChild(r.container);
  assert.equal(slot(r.container, "field-error")?.textContent, "Max is 10");
  assert.equal(slot(r.container, "number-field")!.getAttribute("data-invalid"), "true");
  press(slot(r.container, "number-field-increment-button")!);
  await flush();
  assert.deepEqual(calls, [10]);
  press(slot(r.container, "number-field-increment-button")!);
  await flush();
  assert.deepEqual(calls, [10]);
  r.unmount();
  (r.container as Element).remove();
});

test("number-field: disabled state", async () => {
  const calls: number[] = [];
  const r = renderNumber({ isDisabled: true, onChange: (v: number) => calls.push(v) });
  assert.equal((slot(r.container, "number-field-input") as HTMLInputElement).disabled, true);
  assert.equal(slot(r.container, "number-field")!.getAttribute("data-disabled"), "true");
  press(slot(r.container, "number-field-increment-button")!);
  await flush();
  assert.deepEqual(calls, []);
  r.unmount();
});

test("number-field: custom stepper children replace the icon; live variant in place; exports", async () => {
  const variant = signal<"primary" | "secondary">("primary");
  const r = render(() => (
    <NumberField aria-label="Qty" defaultValue={1} variant={variant()}>
      <NumberField.Group>
        <NumberField.DecrementButton>less</NumberField.DecrementButton>
        <NumberField.Input />
        <NumberField.IncrementButton>more</NumberField.IncrementButton>
      </NumberField.Group>
    </NumberField>
  ));
  assert.equal(slot(r.container, "number-field-increment-button")!.textContent, "more");
  assert.equal(slot(r.container, "number-field-increment-button-icon"), null);
  const root = slot(r.container, "number-field")!;
  const input = slot(r.container, "number-field-input")!;
  variant.set("secondary");
  await flush();
  assert.equal(slot(r.container, "number-field"), root);
  assert.equal(slot(r.container, "number-field-input"), input);
  assert.match(root.className, /\bnumber-field--secondary\b/);
  r.unmount();
  assert.equal(NumberField, NumberFieldRoot);
  assert.equal(NumberField.Root, NumberFieldRoot);
});
