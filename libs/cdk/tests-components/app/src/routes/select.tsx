import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Select, HiddenSelect, createSelectState, setSelectValue, selectedItems, removeSelected, clearSelection, type Key } from "@rivetjs/cdk/select";
import { Form } from "@rivetjs/cdk/form";

export const head = { title: "Select" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "kangaroo", label: "Kangaroo" },
];
const numbered = [
  { key: 1, label: "Cat" },
  { key: 2, label: "Dog" },
];
const numbers = (n: number) => Array.from({ length: n }, (_, i) => ({ key: i, label: String(i) }));
const states = [
  "Australian Capital Territory",
  "New South Wales",
  "Northern Territory",
  "Queensland",
  "South Australia",
  "Tasmania",
  "Victoria",
  "Western Australia",
].map((label) => ({ key: label, label }));
const many = Array.from({ length: 320 }, (_, i) => ({ key: i, label: "item" + i }));
const hidden5 = Array.from({ length: 5 }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
const hidden400 = Array.from({ length: 400 }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
const show = (value: unknown) => (value == null ? "null" : Array.isArray(value) ? "[" + value.join(",") + "]" : String(value));

export default function SelectStory() {
  const log = signal("");
  const append = (entry: string) => log.update((l) => (l ? l + " " : "") + entry);
  // Shared state: the clear button sets the value (RAC SelectStateContext).
  const clearable = createSelectState({ items: animals, id: "clearable", onSelectionChange: (key: Key | null) => append("sel:" + show(key)) });
  const required = signal<Key | null>(null);
  const submits = signal(0);
  const multi = signal<readonly Key[]>(["dog", "kangaroo"]);
  const hiddenState = createSelectState({ items: hidden5, id: "hidden5", onSelectionChange: (key: Key | null) => append("autofill:" + show(key)) });
  const hiddenForm = createSelectState({ items: hidden5, id: "hidden-form5" });
  const hiddenMany = createSelectState({ items: hidden400, id: "hidden400" });
  const hiddenEmpty = createSelectState({ items: [], id: "hidden-empty", defaultValue: "value" });
  // Outside value / open state (spec 3.1: the listbox follows the value however the select opens).
  const external = signal<Key | null>("cat");
  const externalOpen = signal(false);
  // Selected items rendered outside the select, each removable (spec 2.2).
  const chips = createSelectState({ items: animals, id: "chips", selectionMode: "multiple", defaultValue: ["cat", "dog"] });
  return (
    <section>
      <h1>Select</h1>
      <Select id="animal" label="Favorite Animal" description="Description" items={animals} name="animal" />
      <Select id="render-item" label="Favorite Animal" items={animals} defaultValue="cat">
        {(item, { isSelected }) => (
          <>
            {item().label}
            {isSelected() ? " (selected)" : ""}
          </>
        )}
      </Select>
      <Select
        id="custom-value"
        label="Favorite Animal"
        items={numbered}
        defaultValue={1}
        renderValue={({ selectedItem, selectedText }) => <span>{selectedItem ? `${selectedItem.key} - ${selectedText}` : ""}</span>}
      />
      <Select id="placeholder" label="Favorite Animal" items={animals} placeholder="Select an animal" />
      <Select id="empty" label="Favorite Animal" items={[]} allowsEmptyCollection renderEmptyState="No results" />
      <Select id="no-items" label="Favorite Animal" items={[]} defaultValue="cat" />
      <Select
        id="render-props"
        label="Favorite Animal"
        items={animals}
        indicator={({ isOpen }) => <span aria-hidden="true">{isOpen ? "close" : "open"}</span>}
      />
      <Select id="stay-open" label="Favorite Animal" items={animals} shouldCloseOnSelect={false} />
      <Select id="close-multi" label="Favorite Animal" items={animals} selectionMode="multiple" shouldCloseOnSelect />
      <Select id="disabled" label="Favorite Animal" items={animals} name="disabledsel" isDisabled />
      <Select id="form-prop" label="Favorite Animal" items={animals} name="formsel" form="test" />
      <Select
        id="numbers"
        aria-label="Pick a number"
        items={numbers(3)}
        onSelectionChange={(key) => append("pick:" + show(key))}
        onChange={(value) => append("change:" + show(value))}
      />
      <Select id="falsy" label="Pick a number" items={numbers(5)} placeholder="pick a number" />
      <Select id="typeahead" label="Favorite Animal" items={states} />
      <input id="before" />
      <Select id="clearable" label="Favorite Animal" items={animals} state={clearable} />
      <button type="button" id="clear" onClick={() => setSelectValue(clearable, null)}>
        Clear
      </button>
      <input id="after" />
      <Select id="controlled-multi" label="Favorite Animal" items={animals} selectionMode="multiple" value={multi} />
      <Select
        id="custom-multi"
        label="Favorite Animal"
        items={numbered}
        selectionMode="multiple"
        defaultValue={[1]}
        renderValue={({ selectedItems }) => (selectedItems.length === 1 ? selectedItems[0]!.label : `${selectedItems.length} selected items`)}
      />
      <form id="validation-form">
        <Select id="required" label="Favorite Animal" items={animals} name="required" isRequired />
      </form>
      <Form id="submit-form" onSubmit={(event) => (event.preventDefault(), submits.update((n) => n + 1))}>
        {() => (
          <>
            <Select id="submit" label="Favorite Animal" items={animals} name="submit" isRequired value={required} />
            <button type="submit" id="submit-button">
              Submit
            </button>
            <button type="button" id="submit-clear" onClick={() => required.set(null)}>
              Reset
            </button>
          </>
        )}
      </Form>
      <Form id="multi-form">
        {() => (
          <Select
            id="multi"
            label="Favorite Animal"
            items={animals}
            name="multi"
            selectionMode="multiple"
            onChange={(value) => append("multi:" + show(value))}
          />
        )}
      </Form>
      <Form id="many-form" onSubmit={(event) => event.preventDefault()}>
        {() => (
          <>
            <Select id="many" label="Select" items={many} name="many" selectionMode="multiple" isRequired />
            <button type="submit" id="many-submit">
              Submit
            </button>
          </>
        )}
      </Form>
      <form id="immediate-form">
        <Select id="immediate" aria-label="Select" items={[{ key: "1", label: "value" }]} name="immediate" defaultValue="1" />
        <button type="submit" id="immediate-submit">
          Submit
        </button>
      </form>
      <div id="hidden-select">
        <HiddenSelect state={hiddenState} label="select" />
        <form id="hidden-form-5">
          <HiddenSelect state={hiddenForm} name="select" />
        </form>
        <form id="hidden-form-400">
          <HiddenSelect state={hiddenMany} name="select" />
        </form>
        <form id="hidden-form-empty">
          <HiddenSelect state={hiddenEmpty} name="select" />
        </form>
      </div>
      <Select id="external" label="Favorite Animal" items={animals} value={external} isOpen={externalOpen} />
      <button type="button" id="external-dog" onClick={() => external.set("dog")}>
        Dog
      </button>
      <button type="button" id="external-open" onClick={() => externalOpen.set(true)}>
        Open
      </button>
      <Select
        id="focus-events"
        label="Favorite Animal"
        items={animals}
        onFocus={() => append("focus")}
        onBlur={() => append("blur")}
        onFocusChange={(isFocused) => append("change:" + isFocused)}
      />
      <Select id="plain-controlled" label="Favorite Animal" items={animals} value="dog" onChange={(value) => append("plain:" + show(value))} />
      <Select id="chips" label="Favorite Animals" items={animals} selectionMode="multiple" state={chips} />
      <ul id="chips-list">
        <For each={() => selectedItems(chips)} by={(item) => item.key}>
          {(item) => (
            <li>
              <span>{item().label}</span>
              <button type="button" data-remove={String(item().key)} onClick={(event) => removeSelected(chips, item().key, event)}>
                Remove
              </button>
            </li>
          )}
        </For>
      </ul>
      <button type="button" id="chips-clear" onClick={(event) => clearSelection(chips, event)}>
        Clear all
      </button>
      <Select id="no-items" aria-label="No items" />
      <p id="select-log">{log()}</p>
      <p id="select-submits">{submits()}</p>
      <div class="spacer"></div>
    </section>
  );
}
