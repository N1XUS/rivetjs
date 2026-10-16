// DOM-target suite: `Autocomplete` (upstream tests/components/autocomplete/autocomplete.test.tsx + fixtures.tsx ported to happy-dom):
// data-slots + BEM block, open + search field + select → `onChange` / value text, ClearButton → `onClear`, disabled, FieldError when
// invalid, multiple selection with tags (removing a tag does not open the popover).
// Rivet: `@react-aria/test-utils` Select tester / user-event → direct pointer events; fake timers → `flush()`; `useFilter` → cdk
// `createFilter`; `state.selectedItems` → `selectedKeys(state)`; trigger group click toggles; clear button attributes; variants;
// parts outside an Autocomplete; index exports.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { createFilter } = await import("@rivetjs/cdk/i18n/filter");
const { selectedKeys } = await import("@rivetjs/cdk/select");
const { FieldError } = await import("../src/components/field-error/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { ListBox } = await import("../src/components/list-box/index.ts");
const { SearchField } = await import("../src/components/search-field/index.ts");
const { Tag } = await import("../src/components/tag/index.ts");
const { TagGroup } = await import("../src/components/tag-group/index.ts");
const A = await import("../src/components/autocomplete/index.ts");
const { Autocomplete } = A;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const root = () => q("[data-testid=autocomplete]")!;
const trigger = () => q('[data-slot="autocomplete-trigger"]')!;
const button = () => trigger().querySelector("button:not([data-slot=autocomplete-clear-button])") as HTMLButtonElement;
const listbox = () => q("[role=listbox]");
const options = () => [...document.querySelectorAll("[role=option]")] as HTMLElement[];
const option = (text: string) => options().find((o) => o.textContent!.includes(text))!;
const clearButton = () => q('[data-slot="autocomplete-clear-button"]') as HTMLButtonElement;

const animals = [
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "panda", name: "Panda" },
];
const { contains } = createFilter({ sensitivity: "base" }, "en-US");

type Props = {
  isDisabled?: boolean;
  isInvalid?: boolean;
  defaultValue?: string;
  onChange?: (key: unknown) => void;
  onClear?: () => void;
  withClearButton?: boolean;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

const AutocompleteExample = (props: Props) => (
  <Autocomplete
    data-testid="autocomplete"
    defaultValue={props.defaultValue}
    fullWidth={props.fullWidth}
    isDisabled={props.isDisabled}
    isInvalid={props.isInvalid}
    placeholder="Select an animal"
    selectionMode="single"
    variant={props.variant}
    onChange={props.onChange as never}
    onClear={props.onClear}
  >
    <Label>Favorite Animal</Label>
    <Autocomplete.Trigger>
      <Autocomplete.Value />
      {props.withClearButton ? <Autocomplete.ClearButton /> : null}
      <Autocomplete.Indicator />
    </Autocomplete.Trigger>
    <Autocomplete.Popover>
      <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
        <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search animals..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <ListBox>
          {animals.map((item) => (
            <ListBox.Item id={item.id} textValue={item.name}>
              {item.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Autocomplete.Filter>
    </Autocomplete.Popover>
    {props.isInvalid ? <FieldError>Please choose an animal</FieldError> : null}
  </Autocomplete>
);

/** Multiple selection, where the selected items render as tags inside the trigger. */
const AutocompleteMultipleFixture = (props: { onRemove?: (keys: Set<unknown>) => void }) => {
  const value = signal<readonly unknown[]>(["cat", "dog", "panda"]);
  return (
    <Autocomplete data-testid="autocomplete" placeholder="Select animals" selectionMode="multiple" value={value as never}>
      <Label>Favorite Animals</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) =>
            isPlaceholder() || selectedKeys(state).length === 0 ? (
              defaultChildren
            ) : (
              <TagGroup
                aria-label="Selected animals"
                size="sm"
                onRemove={(keys: Set<unknown>) => {
                  props.onRemove?.(keys);
                  value.set(value().filter((key) => !keys.has(key)));
                }}
              >
                <TagGroup.List>
                  {selectedKeys(state).map((key) => {
                    const item = animals.find((animal) => animal.id === key);
                    return item ? <Tag id={item.id}>{item.name}</Tag> : null;
                  })}
                </TagGroup.List>
              </TagGroup>
            )
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.Input placeholder="Search animals..." />
            </SearchField.Group>
          </SearchField>
          <ListBox selectionMode="multiple">
            {animals.map((item) => (
              <ListBox.Item id={item.id} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
};

let mounted: { unmount(): void } | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  document.body.innerHTML = "";
});
const mount = async (view: () => unknown) => {
  const r = (mounted = render(view as never));
  await flush();
  return r;
};

test("autocomplete: index exports", () => {
  assert.equal(Autocomplete, A.AutocompleteRoot);
  assert.equal(Autocomplete.Root, A.AutocompleteRoot);
  assert.equal(Autocomplete.Trigger, A.AutocompleteTrigger);
  assert.equal(Autocomplete.Value, A.AutocompleteValue);
  assert.equal(Autocomplete.Indicator, A.AutocompleteIndicator);
  assert.equal(Autocomplete.Popover, A.AutocompletePopover);
  assert.equal(Autocomplete.Filter, A.AutocompleteFilter);
  assert.equal(Autocomplete.ClearButton, A.AutocompleteClearButton);
  assert.equal(Autocomplete.Item, A.AutocompleteItem);
  assert.equal(A.autocompleteVariants().base(), "autocomplete autocomplete--primary");
});

test("autocomplete (upstream): exposes data-slots and BEM block", async () => {
  await mount(() => <AutocompleteExample />);
  assert.equal(root().getAttribute("data-slot"), "autocomplete");
  assert.match(root().className, /\bautocomplete\b/);
  assert.ok(q('[data-slot="autocomplete-trigger"]'));
  assert.ok(q('[data-slot="autocomplete-value"]'));
  assert.equal(trigger().className, "autocomplete__trigger");
  assert.equal(trigger().getAttribute("role"), "group");
  assert.equal(q('[data-slot="autocomplete-value"]')!.className, "autocomplete__value");
  assert.equal(q('[data-slot="autocomplete-default-indicator"]')!.getAttribute("class"), "autocomplete__indicator morph-chevron");
  assert.equal(button().getAttribute("aria-haspopup"), "listbox");
});

test("autocomplete (upstream): open, select, and value update", async () => {
  const changes: unknown[] = [];
  await mount(() => <AutocompleteExample onChange={(k) => changes.push(k)} />);
  assert.equal(listbox(), null);
  press(q('[data-slot="autocomplete-value"]')!);
  await flush();
  assert.ok(listbox());
  assert.ok(q('[data-slot="autocomplete-popover"]'));
  assert.match(q('[data-slot="autocomplete-popover"]')!.className, /autocomplete__popover/);
  assert.ok(q(`input[type=search][aria-label="Search animals"]`));
  assert.equal(options().length, 3);
  assert.equal(q('[data-slot="autocomplete-default-indicator"]')!.getAttribute("data-open"), "true");
  press(option("Dog"));
  await flush();
  assert.deepEqual(changes, ["dog"]);
  assert.equal(listbox(), null);
  assert.match(root().textContent!, /Dog/);
});

test("autocomplete (upstream): exposes ClearButton and calls onClear", async () => {
  let cleared = 0;
  const changes: unknown[] = [];
  await mount(() => <AutocompleteExample withClearButton defaultValue="cat" onChange={(k) => changes.push(k)} onClear={() => cleared++} />);
  assert.ok(clearButton());
  assert.equal(clearButton().getAttribute("aria-label"), "Clear selection");
  assert.equal(clearButton().className, "autocomplete__clear-button");
  assert.equal(clearButton().getAttribute("tabindex"), "-1");
  assert.equal(clearButton().getAttribute("data-empty"), null);
  assert.ok(q('[data-slot="autocomplete-clear-button-icon"]'));
  press(clearButton());
  await flush();
  assert.equal(cleared, 1);
  assert.deepEqual(changes, [null]);
  assert.equal(listbox(), null);
  assert.equal(clearButton().getAttribute("data-empty"), "true");
  assert.equal(clearButton().getAttribute("aria-hidden"), "true");
});

test("autocomplete (upstream): supports disabled state", async () => {
  const changes: unknown[] = [];
  await mount(() => <AutocompleteExample isDisabled onChange={(k) => changes.push(k)} />);
  assert.equal(button().disabled, true);
  press(button());
  press(q('[data-slot="autocomplete-value"]')!);
  await flush();
  assert.equal(listbox(), null);
  assert.deepEqual(changes, []);
  assert.equal(trigger().getAttribute("data-disabled"), "true");
});

test("autocomplete (upstream): renders FieldError when invalid", async () => {
  await mount(() => <AutocompleteExample isInvalid />);
  assert.match(document.body.textContent!, /Please choose an animal/);
  assert.ok(q('[data-slot="field-error"]'));
  assert.equal(root().getAttribute("data-invalid"), "true");
});

test("autocomplete (upstream): multiple selection with tags removes the tag on the first press without opening the popover", async () => {
  const removed: unknown[] = [];
  await mount(() => <AutocompleteMultipleFixture onRemove={(keys) => removed.push([...keys])} />);
  assert.equal(document.querySelectorAll("[role=row]").length, 3);
  const remove =
    q('[aria-label="Remove tag Dog"]') ?? [...document.querySelectorAll("[role=row]")].find((r) => r.textContent!.includes("Dog"))!.querySelector("button")!;
  press(remove);
  await flush();
  assert.equal(removed.length, 1);
  const rows = [...document.querySelectorAll("[role=row]")].map((r) => r.textContent!.trim());
  assert.deepEqual(rows, ["Cat", "Panda"]);
  assert.equal(listbox(), null);
  assert.equal(q('[data-slot="autocomplete-popover"]'), null);
});

test("autocomplete: variants and fullWidth classes", async () => {
  await mount(() => <AutocompleteExample variant="secondary" fullWidth />);
  assert.match(root().className, /autocomplete--secondary/);
  assert.match(root().className, /autocomplete--full-width/);
  assert.match(trigger().className, /autocomplete__trigger--full-width/);
});

test("autocomplete: parts outside an Autocomplete keep only the caller's class", async () => {
  await mount(() => <Autocomplete.ClearButton class="x" />);
  assert.equal(clearButton().className, "x");
});

/* ------------------------------------------------------------------ Rivet: Autocomplete.Item + auto form (identity spec §4.2, plan T22) */

const shape = () => [...document.querySelectorAll("[data-slot]")].map((el) => `${el.tagName}.${el.getAttribute("class")}[${el.getAttribute("data-slot")}]`);
function typeInto(el: HTMLInputElement, text: string) {
  const IE = (window as unknown as { InputEvent: typeof InputEvent }).InputEvent;
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new IE("input", { bubbles: true, data: ch, inputType: "insertText" }));
  }
}

test("autocomplete (Rivet): auto form = compound markup; Autocomplete.Item adds the indicator + textValue", async () => {
  const short = await mount(() => (
    <Autocomplete data-testid="autocomplete" placeholder="Select an animal" label="Favorite Animal" searchLabel="Search animals">
      <Autocomplete.Item id="cat">Cat</Autocomplete.Item>
      <Autocomplete.Item id="dog">Dog</Autocomplete.Item>
      <Autocomplete.Item id="panda">Panda</Autocomplete.Item>
    </Autocomplete>
  ));
  const closed = shape();
  press(q('[data-slot="autocomplete-value"]')!);
  await flush();
  const open = shape();
  assert.ok(q(`input[type=search][aria-label="Search animals"]`));
  assert.equal(options()[0]!.querySelectorAll('[data-slot="list-box-item-indicator"]').length, 1);
  short.unmount();
  const compound = await mount(() => (
    <Autocomplete data-testid="autocomplete" placeholder="Select an animal">
      <Label>Favorite Animal</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
          <SearchField autoFocus aria-label="Search animals" variant="secondary" />
          <ListBox>
            {animals.map((item) => (
              <ListBox.Item id={item.id} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  ));
  assert.deepEqual(closed, shape());
  press(q('[data-slot="autocomplete-value"]')!);
  await flush();
  assert.deepEqual(open, shape());
  compound.unmount();
});

test("autocomplete (Rivet): items + render function, default filter (case- and accent-insensitive), two-way value", async () => {
  const value = signal<string | null>(null);
  const cities = [
    { id: "zurich", name: "Zürich" },
    { id: "berlin", name: "Berlin" },
  ];
  const r = await mount(() => (
    <Autocomplete data-testid="autocomplete" aria-label="City" placeholder="Pick a city" items={cities} value={value as never}>
      {(item: { id: string; name: string }) => <Autocomplete.Item id={item.id}>{item.name}</Autocomplete.Item>}
    </Autocomplete>
  ));
  assert.equal(q('[data-slot="label"]'), null);
  press(q('[data-slot="autocomplete-value"]')!);
  await flush();
  assert.ok(q('input[type=search][aria-label="Search"]'));
  typeInto(q("input[type=search]") as HTMLInputElement, "ZUR");
  await flush();
  assert.deepEqual(
    options().map((o) => o.textContent),
    ["Zürich"],
  );
  press(option("Zürich"));
  await flush();
  assert.equal(value(), "zurich");
  r.unmount();
});
