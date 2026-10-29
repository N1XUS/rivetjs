---
title: Select
description: Select from @rivetjs/cdk is a button that opens a listbox popover. Single or multiple selection, typeahead, sections, validation and a hidden native select.
template: guide
status: experimental
related: [components/listbox, components/combobox, components/popover, components/text-field, foundations/overlays, foundations/collections, foundations/selection]
---

`Select` lets users choose an option from a popup listbox. It renders a label, a trigger `<button aria-haspopup="listbox">` that shows the selected value or a placeholder, a description, a field error and, while open, a listbox in a popover of the overlay layer. A hidden native `<select>` is in the server HTML, so the value posts with the form and browser autofill works before any JavaScript runs. While closed, typing on the trigger selects the matching option and :kbd[ArrowLeft] / :kbd[ArrowRight] step through the options. No library code runs until the first interaction.

::example{id=select-basic}

## Anatomy

Closed (server HTML):

```html
<div id="pet" class="rv-Select">
  <span id="pet-trigger-label" class="rv-Label" data-slot="label">Favorite animal</span>
  <button
    type="button"
    id="pet-trigger"
    class="rv-Select-trigger"
    aria-haspopup="listbox"
    aria-expanded="false"
    aria-labelledby="pet-value pet-trigger-label"
    aria-describedby="pet-trigger-description"
    data-rk="Enter Space ArrowDown ArrowUp ArrowLeft ArrowRight"
  >
    <span id="pet-value" class="rv-SelectValue" data-placeholder="true">Select an item</span>
  </button>
  <span id="pet-trigger-description" class="rv-Text" data-slot="description">Pick one.</span>
  <!-- while invalid: <span id="pet-trigger-error" class="rv-FieldError" slot="errorMessage">…</span> -->
  <span data-rv-overlay-anchor="" style="display:contents"></span>
  <div style="(visually hidden, fixed)" aria-hidden="true" data-react-aria-prevent-focus="">
    <label>
      <select id="pet-hidden" tabindex="-1" name="animal">
        <option value="" selected> </option>
        <option value="cat">Cat</option>
        …
      </select>
    </label>
  </div>
</div>
```

Open, the overlay layer at the end of `<body>` holds an inert underlay and the popover (dismiss buttons for screen readers around the listbox):

```html
<div id="pet-popover" class="rv-Select-popover" data-trigger="Select" data-rv-overlay="" data-placement="bottom" style="position: absolute; max-height: …; --trigger-width: 240px; …">
  <div id="pet-listbox" role="listbox" class="rv-ListBox" aria-labelledby="pet-trigger-label" aria-orientation="vertical" data-orientation="vertical" data-layout="stack" tabindex="-1">
    <div id="pet-listbox-option-cat" role="option" class="rv-ListBoxItem" data-key="cat" aria-selected="false" data-selection-mode="single" tabindex="0" data-focused="">Cat</div>
    …
  </div>
</div>
```

A closed select renders no popover, on the server too.

| Part | Element | Default class | Class prop | Id |
| --- | --- | --- | --- | --- |
| Root | `div` | `rv-Select` | `class` | `id` |
| Label | `span` | `rv-Label` | `labelClass` | `<id>-trigger-label` |
| Trigger | `button` | `rv-Select-trigger` | `triggerClass` | `<id>-trigger` |
| Value | `span` inside the trigger | `rv-SelectValue` | `valueClass` | `<id>-value` |
| Description | `span` | `rv-Text` | `descriptionClass` | `<id>-trigger-description` |
| Field error | `span` | `rv-FieldError` | `errorClass` | `<id>-trigger-error` |
| Popover | `div` in the overlay layer | `rv-Select-popover` | `popoverClass` | `<id>-popover` |
| Listbox | `div[role=listbox]` | `rv-ListBox` | `listClass` | `<id>-listbox` |
| Option (`ListBoxItem`) | `div[role=option]` (`a` with `href`) | `rv-ListBoxItem` | `optionClass` | `<id>-listbox-option-<key>` |
| Section (`ListBoxSection`) | `section[role=group]` | `rv-ListBoxSection` | `sectionClass` | none |
| Section header (`Header`) | `header` | `rv-Header` | `headerClass` | generated |
| Empty state (`renderEmptyState`) | `div[role=option]` | none | none | none |
| Hidden select | `select` (or hidden `input`s over 300 items) | none | none | `<id>-hidden` |

Without `id`, a generated id is the base. Whitespace is removed from string keys in option ids.

| Attribute | Where | Value |
| --- | --- | --- |
| `data-open` | root | while the popover is open |
| `data-focused`, `data-focus-visible` | root | focus inside the select; keyboard focus |
| `data-disabled`, `data-invalid`, `data-required` | root | `isDisabled`, displayed invalid state, `isRequired` |
| `aria-expanded` | trigger | `"true"` / `"false"` |
| `aria-controls` | trigger | the listbox id, only while open |
| `data-pressed` | trigger | `"true"` while open |
| `aria-describedby` | trigger | the description, plus the error while invalid |
| `data-placeholder` | value | while nothing is selected |
| `data-placement` | popover | the side it took after flipping (`bottom`, `top`, …) |
| `data-entering`, `data-exiting` | popover | first and last frame of the enter / exit transition |
| `aria-multiselectable` | listbox | `"true"` with `selectionMode="multiple"` |
| `data-empty` | listbox | no items |
| `aria-selected`, `data-selected` | option | the selected options |
| `aria-disabled`, `data-disabled` | option | disabled options |
| `data-focused` | option | the focused option |
| `data-focus-visible`, `data-hovered`, `data-pressed` | option | keyboard-focused / hovered / pressed option |
| `data-key`, `data-collection`, `data-selection-mode` | option | the key; the listbox id; `"single"` / `"multiple"` |

## Import

```tsx
import { Select, SelectValue, HiddenSelect, createSelectState, setSelectValue, openSelect, toggleSelect, selectValue, selectedKeys, selectedItems, selectedItemsOf, removeSelected, clearSelection, toggleSelected } from "@rivetjs/cdk/select";
import type { Key, Item, SelectState, SelectProps, SelectRenderProps, SelectValueRenderProps, ItemRenderProps } from "@rivetjs/cdk/select";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `readonly CollectionEntry[]` or `() => readonly CollectionEntry[]` | required | Items `{ key, label, … }` and sections `{ key, title, children }`, see [Items](#items). A function for items that change. |
| `label` | content | none | Visible label. Without it, pass `aria-label` or `aria-labelledby`. |
| `description` | content | none | Help text under the trigger (`aria-describedby`). |
| `errorMessage` | content or `(validation) => content` | the validation errors | Shown while invalid. |
| `placeholder` | `string` | `"Select an item"`, localized | Shown while nothing is selected. |
| `selectionMode` | `"single" \| "multiple"` | `"single"` | |
| `value` | `Key \| null` / `readonly Key[]`, or a `Signal` of it | none | Controlled value. A Signal is two-way; a plain value stays shown and `onChange` reports picks (RAC controlled prop). |
| `defaultValue` | `Key \| null` or `readonly Key[]` | `null` / `[]` | Initial value (uncontrolled); restored on form reset. |
| `isOpen` | `Signal<boolean>` | none | Two-way open state (controlled). |
| `defaultOpen` | `boolean` | `false` | Initial open state (uncontrolled). |
| `disabledKeys` | `Iterable<Key>` | none | Options that cannot be focused or selected. |
| `isDisabled` | `boolean` | `false` | Disables the trigger and the hidden select. |
| `shouldCloseOnSelect` | `boolean` | `true` single, `false` multiple | Close the popover after a choice. |
| `allowsEmptyCollection` | `boolean` | `false` | Allow opening with no items (shows `renderEmptyState`). |
| `isRequired` | `boolean` | `false` | `required` on the hidden select (native) or a required error (aria). |
| `isInvalid` | `boolean` or `() => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validate` | `(value) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the value (`Key` or `Key[]`). |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the enclosing `Form`'s) | Native blocks submit through the hidden select; aria only marks the field. |
| `name` | `string` | none | Form field name of the hidden select. |
| `form` | `string` | none | Id of the `<form>` the hidden select belongs to. |
| `autoComplete` | `string` | none | Autocomplete hint of the hidden select. |
| `autoFocus` | `boolean` | `false` | Focus the trigger on load. |
| `aria-label`, `aria-labelledby`, `aria-describedby` | `string` | none | Names the trigger (with the value) and the listbox. |
| `id` | `string` | generated | Root id and base of the part ids. |
| `state` | `SelectState` | created from the props | A shared state from `createSelectState`, see [Shared state](#shared-state). |
| `placement` | `Placement` | `"bottom start"` | Popover side and alignment; flips when there is no room. |
| `offset` | `number` | `8` | Gap between trigger and popover (main axis). |
| `crossOffset` | `number` | `0` | Shift along the trigger edge. |
| `shouldFlip` | `boolean` | `true` | Flip to the other side when there is no room. |
| `maxHeight` | `number` | the available height | Cap of the popover height. |
| `children` | `(item: () => Item, states: ItemRenderProps) => content` | the label (and description) | Option content. The trigger renders it too, with the states off. |
| `renderValue` | `(props: SelectValueRenderProps) => content` | the selected content | Trigger value content. |
| `indicator` | `(props: SelectRenderProps) => content` or content | none | Extra trigger content after the value (an arrow). |
| `renderEmptyState` | content | none | Listbox content when there are no items. |
| `enter`, `enterFrom`, `enterTo`, `entered`, `leave`, `leaveFrom`, `leaveTo` | `string` | none | Transition classes of the popover (Headless UI style). |
| `class`, `labelClass`, `triggerClass`, `valueClass`, `descriptionClass`, `errorClass`, `popoverClass`, `listClass`, `optionClass`, `sectionClass`, `headerClass` | `string` | see [Anatomy](#anatomy) | Replace the default class names. |
| `triggerProps`, `valueProps`, `popoverProps`, `listBoxProps` | `GlobalDOMAttributes` | none | DOM events and attributes of the parts, see [DOM events and attributes](#dom-events-and-attributes). |
| `dir`, `lang`, `hidden`, `inert`, `translate`, `on*` | `GlobalDOMAttributes` | none | DOM events and attributes of the root. |

`selectedKey`, `defaultSelectedKey` and `onSelectionChange` still work as deprecated single-mode aliases of `value`, `defaultValue` and `onChange`.

### Items

| Field | Type | Notes |
| --- | --- | --- |
| `key` | `Key` (`string \| number`) | required; unique. Number keys stay numbers in the value; the form posts `String(key)`. |
| `label` | `string` | Option text, the trigger text and the typeahead text. |
| `textValue` | `string` | Typeahead, hidden option and `selectedText` text when it differs from `label`. |
| `description` | `string` | Second line (`Text slot="description"`), wired with `aria-describedby`. |
| `disabled` | `boolean` | Disables this option. |
| `href`, `target`, `rel`, `download` | `string` | Link option (`<a role="option">`). |
| `aria-label` | `string` | Accessible name of the option. |
| `dir`, `lang`, `on*`, … | `GlobalDOMAttributes` | DOM events and attributes of the option element. |

Sections: `{ key, title?, "aria-label"?, children: Item[] }`, plus DOM attributes for the `<section>`.

### Events

| Event | Type | When |
| --- | --- | --- |
| `onChange` | `(value: Key \| null)` single, `(value: Key[])` multiple | The value changed (a choice, typeahead, arrows on the closed trigger, autofill, `setSelectValue`, form reset). Single mode: only when the key differs. |
| `onSelectionChange` | `(key: Key \| null) => void` | Deprecated: single-mode key change, after `onChange`. |
| `onOpenChange` | `(isOpen: boolean) => void` | The popover opened or closed. |
| `onFocus`, `onBlur` | `(event: FocusEvent) => void` | Focus entered or left the select (trigger and listbox together). |
| `onFocusChange` | `(isFocused: boolean) => void` | Same moments as `onFocus` / `onBlur`. |
| `onKeyDown`, `onKeyUp` | `(event: KeyboardEvent) => void` | Keys on the trigger (not in the listbox). A key the closed-trigger typeahead consumed does not reach `onKeyDown`. |

## Content

### Options, values and indicators

Items with a `description` render a label and a description. `children` replaces the option content and gets the item accessor plus `ItemRenderProps` (`isSelected()`, `isFocused()`, `isDisabled`, `selectionMode`, `selectionBehavior()`); the trigger shows the same slot for the selected item with every state off. `renderValue` replaces the trigger value and gets `SelectValueRenderProps`: `isPlaceholder`, `selectedItems`, `selectedText` (a localized list in multiple mode), `state` (and the deprecated `selectedItem`). `indicator` adds content after the value; as a function it gets `SelectRenderProps` (`isOpen`, `isFocused`, `isFocusVisible`, `isDisabled`, `isInvalid`, `isRequired`). `renderEmptyState` fills an empty listbox, which only opens with `allowsEmptyCollection`.

::example{id=select-slots}

### Sections

Entries with `children` are sections: a `section[role=group]` named by its `header` (`title`), or by `aria-label` without a title. Arrow keys and typeahead move across sections.

::example{id=select-sections}

## Value

### Controlled and uncontrolled

Pass a signal as `value` to own the value (a plain `value={v()}` is a RAC controlled prop: the select shows it, follows it in place and calls `onChange`), and one as `isOpen` to own the open state: set them from anywhere and the select follows; the select writes them back. `defaultValue` and `defaultOpen` set only the start. A single-mode `value` that is an array shows its first key.

::example{id=select-controlled}

### Shared state

`createSelectState(props)` creates the state `Select` would create (same props as `Select` without the slots and classes; pass the same `items` to both). Hand it to `Select` as `state` and to your own code:

| Function | What it does |
| --- | --- |
| `setSelectValue(state, value)` | Set the value (`Key`, `Key[]` or `null`), with `onChange`. |
| `openSelect(state, focusStrategy?)` | Open (`"first"`, `"last"` or `null`); not with an empty collection unless `allowsEmptyCollection`. |
| `toggleSelect(state, focusStrategy?)` | Toggle the popover. |
| `selectValue(state)` | The value (reads the signal). |
| `selectedKeys(state)` | The selected keys in value order. |
| `selectedItems(state)` | The selected items in value order. |
| `selectedItemsOf(items, keys)` | The items of `keys` from any items (selected items shown outside, from a shared `value` signal). |
| `removeSelected(state, keys)` | Remove one key or several from the value (`onChange`, commits validation): a chip's remove button. |
| `clearSelection(state)` | Empty the value. |
| `toggleSelected(state, key)` | Add or remove one key. |

With a `state`, the select ignores the state props it would otherwise read (`value`, `selectionMode`, `isDisabled`, `onChange`, …): put them into `createSelectState`.

::example{id=select-state}

### Multiple selection

`selectionMode="multiple"` makes the value a `Key[]`. Options toggle, the listbox gets `aria-multiselectable`, the trigger lists the labels with `Intl.ListFormat` ("Cheese and Olives"), and the popover stays open. `shouldCloseOnSelect` overrides the default either way.

::example{id=select-multiple}

## Disabled

Disable options with the item's `disabled` or with `disabledKeys`: they get `aria-disabled="true"` and `data-disabled`, and the arrow keys, the closed-trigger arrows and typeahead skip them. `isDisabled` disables the trigger button and the hidden select (its value does not post) and sets `data-disabled` on the root.

::example{id=select-disabled}

## Validation

`Select` follows the [TextField](text-field.md) validation model. With the default `validationBehavior="native"`, `isRequired` puts `required` on the hidden select: submitting an empty select is blocked, the trigger takes focus and the error shows. `validate` returns an error for a value; `isInvalid` forces the state; server errors come from `<Form validationErrors>` by `name` and show until the value changes. Errors are committed on every choice and on submit. `errorMessage` replaces the error text (or is a function of the validation result). With `validationBehavior="aria"` nothing blocks the submit; the field is only marked invalid.

::example{id=select-validation}

Form reset restores `defaultValue`. Browser autofill writes the hidden select, which sets the value.

## Popover

`placement` (`"bottom start"` by default), `offset`, `crossOffset`, `shouldFlip` and `maxHeight` position the popover through the overlay layer (see [Overlays](../foundations/overlays.md)). It gets the trigger's width as `--trigger-width` and the side it took as `data-placement`. While open, the page behind is inert (an underlay), an outside press or :kbd[Escape] closes it, and focus returns to the trigger.

::example{id=select-placement}

## Events

::example{id=select-events}

`onFocus` / `onBlur` cover the trigger and the listbox together: focus moving from the trigger into the open listbox does not end the focus of the select (one `onFocus` / `onBlur` pair per visit). In multiple mode `onChange` runs on every toggle.

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`):

| Where you pass them | Element |
| --- | --- |
| props of `Select` | root `div.rv-Select` |
| `triggerProps` | trigger `button` |
| `valueProps` | value `span` |
| `popoverProps` | popover `div` (overlay layer) |
| `listBoxProps` | listbox `div[role=listbox]` |
| fields of each item / section | that option / `section` |

The trigger handles `onPointerDown`, `onMouseDown` and `onClick` itself; the listbox `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onMouseDown` and `onPointerOver`. Your handlers of the same name run right after the select's own one. A mouse press opens on pointer down, so the trigger's `onClick` runs only for touch and screen reader clicks. Keyboard and focus events are the select's own props (`onKeyDown`, `onFocus`, …), not part props.

::example{id=select-dom-events}

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-Select[data-open]` | open select | `data-[open]:`, `group-data-[open]:` |
| `.rv-Select[data-focus-visible]` | keyboard focus | `data-[focus-visible]:` |
| `.rv-Select[data-invalid]`, `[data-required]`, `[data-disabled]` | field state | `data-[invalid]:`, … |
| `.rv-Select-trigger[aria-expanded="true"]` | trigger while open | `aria-expanded:` |
| `.rv-SelectValue[data-placeholder]` | placeholder | `data-[placeholder]:` |
| `.rv-Select-popover[data-placement^="top"]` | popover side | `placement-top:`, `placement-bottom:` |
| `.rv-Select-popover[data-entering]`, `[data-exiting]` | transition frames | `entering:`, `exiting:` |
| `.rv-ListBoxItem[aria-selected="true"]` | selected option | `aria-selected:` |
| `.rv-ListBoxItem[data-focused]` | focused option | `focused:` |
| `.rv-ListBoxItem[aria-disabled="true"]` | disabled option | `aria-disabled:` |
| `.rv-ListBox[data-empty]` | empty listbox | `data-[empty]:` |

Class props replace the default class names; the attributes stay. `focused:`, `entering:`, `exiting:` and `placement-*:` come from `@rivetjs/cdk/tailwind.css`.

### Tailwind

`entering:` / `exiting:` style the first and last frame of a CSS transition on `popoverClass`; or use `enter` / `enterFrom` / `enterTo` / `leave` / `leaveFrom` / `leaveTo`, which run class-based transitions. The popover stays in the DOM until the exit transition ends.

::example{id=select-tailwind}

### Plain CSS

::example{id=select-css}

### Starter theme

`@rivetjs/cdk/theme.css` (imported by most examples on this page) styles the trigger as a bordered button, the listbox as a bordered surface, options with padding, the selected option with the accent background, disabled options faded and the placeholder muted. It sets `width: var(--trigger-width)` on `.rv-Select-popover` and fades it in and out (`data-entering` / `data-exiting`, unless reduced motion). Its rules use `:where(…)`, so any rule of yours wins.

## Accessibility

- The trigger is a `button` with `aria-haspopup="listbox"`, `aria-expanded` and, while open, `aria-controls`. It is named by the value and the label (`aria-labelledby="<id>-value <id>-trigger-label"`), so a screen reader reads "Dog, Favorite animal".
- The listbox is named by the label; options have `aria-selected`, disabled ones `aria-disabled`. Multiple mode sets `aria-multiselectable`.
- The label is a `span`; clicking it focuses the trigger and shows its focus ring.
- The hidden select is `aria-hidden` and not focusable; it exists for forms and autofill only.
- While open, the rest of the page is inert; visually hidden dismiss buttons let screen reader users close the popover.

### Keyboard

| Key | Where | Action |
| --- | --- | --- |
| :kbd[ArrowDown], :kbd[Enter], :kbd[Space] | trigger | Open; focus the selected option, else the first. |
| :kbd[ArrowUp] | trigger | Open; focus the selected option, else the last. |
| :kbd[ArrowLeft], :kbd[ArrowRight] | closed trigger, single | Select the previous / next enabled option. |
| Letters | closed trigger, single | Typeahead: select the next option starting with the typed text. |
| :kbd[ArrowDown], :kbd[ArrowUp] | listbox | Next / previous enabled option. |
| :kbd[Home], :kbd[End], :kbd[PageUp], :kbd[PageDown] | listbox | First / last / page. |
| Letters | listbox | Typeahead: focus the matching option. |
| :kbd[Enter], :kbd[Space] | listbox | Select the focused option (toggle in multiple mode); single mode closes. |
| :kbd[Escape] | listbox | Close and focus the trigger. |

Pointer: a mouse press opens on pointer down and an option selects on release. Touch opens on release. A pointer open focuses the selected option, or the listbox itself when nothing is selected (then :kbd[ArrowDown] focuses the first option).

## Resumability

- The server renders the trigger with the value text and the hidden select with every option; a closed popover renders nothing. The trigger's `data-rk` keys are held while the handler chunk loads, so the first key press is not lost. The first open creates only the popover.
- State is signals plus JSON (`createSelectState`), so `value` / `isOpen` signals and number keys resume as they were.
- `children`, `renderValue` and a function `indicator` are slots. Pass element content for `indicator` as a function (`indicator={() => <Icon />}`). `renderEmptyState` takes text.
- A `children` slot that returns elements needs a starting value (`defaultValue` or `value`): when the server rendered the placeholder text, the resumed trigger cannot switch that text to elements. Use `renderValue` returning text, or start with a value.
- `on…Capture` handlers work on resumed pages too, the first event included.

## Testing

`@rivetjs/testing/user` ships the ported `SelectTester` (React Aria test-utils): `user.createTester("Select", { root, interactionType? })`, then `open({ interactionType? })`, `close()`, `toggleOptionSelection({ option, closesOnSelect?, interactionType? })` (option: index, text or element), `findOption({ indexOrText })`, `getOptions()`, `getSections()`, `getTrigger()` and `getListbox()`.

```tsx
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { Select } from "@rivetjs/cdk/select";

render(() => <Select id="pet" label="Pet" items={[{ key: "cat", label: "Cat" }, { key: "dog", label: "Dog" }]} />);
const select = new User({ interactionType: "keyboard" }).createTester("Select", { root: document.getElementById("pet")! });
await select.toggleOptionSelection({ option: "Dog" });
expect(select.getTrigger().textContent).toBe("Dog");
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Select` | RAC `Select` + `Label` + `Button` + `SelectValue` + `Text` + `FieldError` + `Popover` + `ListBox` (data-driven: `items` plus slots) |
| `HiddenSelect` | react-aria `HiddenSelect` / `useHiddenSelect` |
| `@rivetjs/cdk/select/behaviour` | react-aria `useSelect` and `useMenuTrigger` (type `"listbox"`) |
| `SelectValue`, `SelectContext`, `SelectStateContext`, `SelectValueContext` | RAC `SelectValue` and contexts (render props are accessors: `selectedItems()`) |
| `selectProps(props, state)` in `@rivetjs/cdk/select/behaviour` | react-aria `useSelect` attribute bags (`labelProps`, `triggerProps`, `valueProps`, `menuProps`, …) |
| `createSelectState`, `setSelectValue`, `openSelect`, `toggleSelect` | react-stately `useSelectState` |
| `removeSelected`, `clearSelection`, `toggleSelected`, `selectedItemsOf` | Rivet helpers over `useSelectState` `setValue` / `selectedItems` |

Deviations:

- One monolithic `Select` with `items`, not composed children; the parts take classes and `*Props` objects.
- `state` replaces RAC `SelectStateContext` for outside controls.
- `validationBehavior` defaults to `"native"` on `Select` (as in RAC) but `"aria"` on a bare `createSelectState`.
- `isOpen` is a signal instead of a value + callback pair.

### Not yet supported

- JSX item children (`<ListBoxItem>`), `dependencies`, virtualized options.
- Render-prop `className` / `style` functions; style with the data attributes instead.
- The option render props `isHovered`, `isPressed`, `isFocusVisible` in the `children` slot (the option element has the `data-*` attributes).
- `excludeFromTabOrder` and `slot`.

## Known issues

- Items with a `description` render empty options (the label and description `Text` slots are missing), so they have no accessible name yet.
- A value changed from outside while the popover is open shows in the listbox at its next interaction.
- :kbd[Tab] in the open listbox moves focus to `<body>` and leaves the popover open.
