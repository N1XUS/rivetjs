---
title: ComboBox
description: ComboBox from @rivetjs/cdk combines a text input with a filtered listbox in a popover; single or multiple selection, custom values and form validation.
template: guide
status: experimental
related: [components/autocomplete, components/select, components/listbox, components/popover, components/field, foundations/announcements, foundations/collections]
---

`ComboBox` combines text entry with a popup list of options. It is composed from parts: a `Label`, an `Input` (with an optional trigger `Button`, usually inside a `Group`), and a `Popover` holding a `ListBox` of `ListBoxItem`s. The combobox fills each part through its context, so the parts need no ids or handlers. Typing filters the options (contains, ignoring case and accents, in the current locale) and opens the popover; the arrow keys move a virtual focus (`aria-activedescendant`) while DOM focus stays in the input; :kbd[Enter] or a click selects. A hidden input carries the selected key in form posts. The server HTML holds the closed field; nothing runs until the first interaction.

::example{id=combobox-basic}

## Anatomy

Closed (server HTML):

```html
<div class="rv-ComboBox">
  <label id="city-label" for="city" class="rv-Label">City</label>
  <div role="group" class="rv-Group">
    <input type="text" id="city" role="combobox" class="rv-Input" aria-autocomplete="list" aria-expanded="false"
           aria-labelledby="city-label" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Type a city" value="" />
    <button type="button" id="rv2" tabindex="-1" class="rv-Button" aria-label="Show cities" aria-labelledby="rv2 city-label"
            aria-haspopup="listbox" aria-expanded="false"><svg … /></button>
  </div>
  <span data-rv-overlay-anchor="" style="display:contents"></span>
  <input type="hidden" name="city" value="" />
</div>
```

Open, the popover lives in the overlay layer at the end of `<body>`; the rest of the page is `aria-hidden` while it is open:

```html
<div class="rv-Popover" data-trigger="ComboBox" data-rv-overlay="" data-placement="bottom" style="position: absolute; --trigger-width: 384px; …">
  <div id="rv0" role="listbox" class="rv-ListBox" aria-label="Suggestions" aria-labelledby="rv0 city-label" data-orientation="vertical">
    <div id="rv0-option-ber" role="option" class="rv-ListBoxItem" data-key="ber" aria-selected="false" data-focused="true" data-focus-visible="true">Berlin</div>
    <div id="rv0-option-bog" role="option" class="rv-ListBoxItem" data-key="bog" aria-selected="false">Bogotá</div>
  </div>
  <div style="(visually hidden)"><button type="button" aria-label="Dismiss" tabindex="-1"></button></div>
</div>
```

The input then has `aria-expanded="true"`, `aria-controls` (the listbox id) and `aria-activedescendant` (the virtually focused option); the button gets `data-pressed`.

```tsx
<ComboBox>
  <Label />
  <ComboBoxValue />
  <Group>
    <Input />
    <Button />
  </Group>
  <Text slot="description" />
  <FieldError />
  <Popover>
    <ListBox>
      <ListBoxItem />
      <ListBoxSection>
        <Header />
        <ListBoxItem />
      </ListBoxSection>
    </ListBox>
  </Popover>
</ComboBox>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `ComboBox` | `div` | `rv-ComboBox` | Root; state attributes below. `id` goes to the input (RAC). |
| `Label` | `label` | `rv-Label` | `for` the input; `<input id>-label` (`id` of the ComboBox + `-label`, else generated). |
| `Group` | `div[role=group]` | `rv-Group` | Optional; the popover is placed against it (else against the input). |
| `Input` | `input[role=combobox]` | `rv-Input` | Takes `placeholder` and its own DOM props. |
| `Button` | `button` | `rv-Button` | Optional trigger: out of the tab order, opens every option. Name it (`aria-label`); it is labelled by itself + the label. |
| `ComboBoxValue` | `div` | `rv-ComboBoxValue` | Optional: the selected items' text (multiple selection), `data-placeholder` while empty. |
| `Text slot="description"` | `span` | `rv-Text` | Describes the input. |
| `FieldError` | `span` | `rv-FieldError` | Rendered while invalid. |
| `Popover` | `div` in the overlay layer | `rv-Popover` | `data-trigger="ComboBox"`, non-modal, `placement="bottom start"`, `--trigger-width` of the group / input. |
| `ListBox` | `div[role=listbox]` | `rv-ListBox` | Generated id; labelled "Suggestions" + the label. Without children it renders the `items` / `defaultItems`. |
| `ListBoxItem`, `ListBoxSection`, `Header` | see [ListBox](listbox.md) | `rv-ListBoxItem`, `rv-ListBoxSection`, `rv-Header` | Option ids `<listbox id>-option-<key>`. |
| Hidden input(s) | `input[type=hidden]` | none | With `name` and `formValue="key"`: one per selected key (multiple), or one empty input. |

| Attribute | Where | Value |
| --- | --- | --- |
| `data-open` | root | while the popover is open |
| `data-focused` | root | while the input has focus |
| `data-disabled`, `data-readonly`, `data-required`, `data-invalid` | root (`data-invalid` also on the group and input) | `isDisabled`, `isReadOnly`, `isRequired`, invalid |
| `data-pressed` | button | while the popover is open |
| `data-focused`, `data-focus-visible` | option | the virtually focused option |
| `aria-selected`, `data-selected` | option | selected options |
| `data-placeholder` | `ComboBoxValue` | nothing selected |

## Import

```ts
import { ComboBox, ComboBoxValue, type Key } from "@rivetjs/cdk/combobox";
import { Label } from "@rivetjs/cdk/label";
import { Input } from "@rivetjs/cdk/input";
import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Popover } from "@rivetjs/cdk/popover";
import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";
import { Header } from "@rivetjs/cdk/header";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { Announcer } from "@rivetjs/cdk/announcer";
```

## Props

### ComboBox

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | parts, or `(props: ComboBoxRenderProps) => content` | none | The Label / Input / Popover … parts. |
| `defaultItems` | `readonly T[] \| () => readonly T[]` | none | Items (uncontrolled), filtered with `defaultFilter`. Each item `{ id \| key, name \| label \| textValue }` unless the ListBox has an item renderer. |
| `items` | `readonly T[] \| () => readonly T[]` | none | Items (controlled): not filtered, the app filters (from `inputValue`). An accessor is re-read when it changes. |
| `selectionMode` | `"single" \| "multiple"` | `"single"` | |
| `value` | `Key \| null` (single) / `readonly Key[]` (multiple), or a `Signal` of it | none | Controlled value; a Signal is written two-way. |
| `defaultValue` | `Key \| null` / `readonly Key[]` | none | Initial value (uncontrolled). |
| `onChange` | `(value) => void` | none | The value changed. |
| `selectedKey` | `Key \| null \| Signal<Key \| null>` | none | Deprecated single-selection form of `value` (RAC). |
| `defaultSelectedKey` | `Key \| null` | none | Deprecated form of `defaultValue`. |
| `onSelectionChange` | `(key: Key \| null) => void` | none | Deprecated form of `onChange` (single). |
| `inputValue` | `string \| Signal<string>` | none | Controlled input text; a Signal is written two-way. |
| `defaultInputValue` | `string` | the selected item's text | Initial text (uncontrolled). |
| `onInputChange` | `(value: string) => void` | none | |
| `allowsCustomValue` | `boolean` | `false` | Text that matches no option stays in the input on blur (and posts as the form value). |
| `menuTrigger` | `"input" \| "focus" \| "manual"` | `"input"` | What opens the popover: typing, focus, or only the arrow keys / button. |
| `onOpenChange` | `(isOpen: boolean, menuTrigger?: MenuTriggerAction) => void` | none | |
| `defaultFilter` | `(textValue: string, inputValue: string) => boolean` | locale `contains`, sensitivity `base` | Filter of `defaultItems` / static options. |
| `allowsEmptyCollection` | `boolean` | `false` | Opens (and stays open) with no matching option. |
| `shouldCloseOnBlur` | `boolean` | `true` | |
| `shouldFocusWrap` | `boolean` | `false` | Arrow keys wrap around. |
| `disabledKeys` | `Iterable<Key>` | none | |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | |
| `isInvalid` | `boolean \| () => boolean` | none | An accessor stays live. `validationState` (`"valid" \| "invalid"`) is the deprecated RA form. |
| `validate` | `(value: ComboBoxValidationValue) => string \| string[] \| true \| null \| undefined` | none | `{ value, selectedKey, inputValue }`. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the enclosing `Form`'s) | |
| `name`, `form` | `string` | none | Form field name / form id of the hidden input(s). |
| `formValue` | `"key" \| "text"` | `"key"` | Post the selected key (hidden input) or the input text (`name` on the input). Always `"text"` with `allowsCustomValue`. |
| `id` | `string` | generated | The input's id; label `<id>-label`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | On the input. |
| `autoFocus` | `boolean` | `false` | Focuses the input on mount. |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp` | | none | Input focus and keys (blur into the popover or the button does not count). |
| text input props | `maxLength`, `minLength`, `pattern`, `inputMode`, `enterKeyHint`, `autoCapitalize`, `excludeFromTabOrder`, `onCopy`, `onCut`, `onPaste`, `onComposition*`, `onSelect`, `onBeforeInput` | none | Passed to the input (RA `useTextField`). |
| `class`, `style` | value or `(props: ComboBoxRenderProps) => value` | `rv-ComboBox` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ComboBox`; see [Render](#render). |
| `slot` | `string \| null` | none | `ComboBoxContext` slot. |
| `ref` | `Ref<HTMLDivElement>` | none | Root element. |
| global DOM props | `GlobalDOMAttributes` (without `onFocus`, `onBlur`, `onKeyDown`, `onKeyUp`, `onInput`, `onBeforeInput`) | none | On the root. |

`ComboBoxRenderProps` (accessors): `isOpen()`, `isDisabled()`, `isInvalid()`, `isRequired()`, `isReadOnly()`.

::api{symbol="@rivetjs/cdk/combobox#ComboBoxProps"}

### ComboBoxValue

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `placeholder` | content | none | Shown while nothing is selected. |
| `children` | content or `(props: ComboBoxValueRenderProps) => content` | the selected texts, joined by the locale list format ("Amsterdam and Berlin") | |
| `class`, `style` | value or function of the render props | `rv-ComboBoxValue` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ComboBoxValue`; see [Render](#render). |
| `id`, `ref`, global DOM props | | | On the `div`. |

`ComboBoxValueRenderProps`: `isPlaceholder()`, `selectedItems()` (item values), `selectedText()`, `state`.

### Parts

The parts take their own props as documented on their pages: [Label, Text and FieldError](field.md), [Button](button.md), [Group](group.md), [Popover](popover.md) (`placement`, `offset`, `crossOffset`, `shouldFlip`, `maxHeight`, `class`…), [ListBox](listbox.md) (`ListBoxItem` `textValue`, `isDisabled`, `href`, `onAction`, render props…). What the combobox sets through the contexts wins for behaviour (ids, ARIA, handlers); classes, styles and DOM props are yours.

### Events

| Event | Fires |
| --- | --- |
| `onChange(value)` / `onSelectionChange(key)` | An option was selected (:kbd[Enter], click, :kbd[Tab] commit), or the value cleared (input emptied, single, not both controlled). |
| `onInputChange(text)` | The text changed: typing, or reset to the selected item's text after a selection / :kbd[Escape] / blur. |
| `onOpenChange(isOpen, menuTrigger)` | The popover opened (`"input"`, `"focus"`, `"manual"`) or closed. |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp` | On the input. |

## Content

Options come from the `ListBox`: static `ListBoxItem`s and `ListBoxSection`s with a `Header` (filtered by `defaultFilter`), or an item renderer over `defaultItems` / `items`. A `ListBox` without children renders each item as a `ListBoxItem` (`{ id, name }`). `Text slot="description"` describes the input. Give `textValue` to an item whose content is not a string: the filter and the input text use it.

::example{id=combobox-slots}

## Value

Pass a `selectedKey` (or `value`) Signal to own the selection and an `inputValue` Signal to own the text. With both controlled, the combobox leaves the text alone when the selection changes (RAC): set it in `onSelectionChange`.

::example{id=combobox-controlled}

## Custom filtering and menu trigger

`defaultFilter` replaces the default contains filter (here a prefix match). `menuTrigger="focus"` opens the popover on focus; `"manual"` only on :kbd[ArrowDown] / :kbd[ArrowUp] or the button. For server-side or custom filtering, pass `items` (not filtered) derived from `inputValue`.

::example{id=combobox-filter}

## Multiple selection

`selectionMode="multiple"` keeps the popover open while options toggle; `value` is an array of keys and the text is cleared after each pick. `ComboBoxValue` shows the selection (and is part of the input's `aria-describedby`). With `name`, one hidden input per key posts.

::example{id=combobox-multiple}

## Disabled

`disabledKeys` (or `isDisabled` on a `ListBoxItem`) keeps an option visible but not selectable (`aria-disabled`, skipped by the arrow keys). `isDisabled` on the ComboBox disables the input and the button.

::example{id=combobox-disabled}

## Forms and validation

`name` posts the selected key through a hidden input (`formValue="text"` posts the text instead; `allowsCustomValue` always posts the text). `isRequired` and `validate` validate on commit; with the default `validationBehavior="native"` the input carries `required` and a custom validity, so the form does not submit, and `FieldError` shows the message. Inside a `Form`, its `validationErrors` and `validationBehavior` apply.

::example{id=combobox-validation}

:::warning
On a resumed page the `FieldError` inside a ComboBox does not render yet: the input and the root get `aria-invalid` / `data-invalid`, but the message part stays empty.
:::

## Events

::example{id=combobox-events}

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes`: mouse, pointer, touch, wheel, scroll, drag, animation and transition events, `dir`, `lang`, `hidden`, `inert`, `data-*`): `ComboBox` props land on the root `div` (except `style` / `onFocus` / `onBlur` / `onKeyDown` / `onKeyUp`, which are the field's), `Input` props on the `<input>`, `Button` props on the button, `ListBox` / `ListBoxItem` props on the listbox / option.

The combobox owns the input's `onKeyDown`, `onFocus`, `onBlur`, `onInput`, `onTouchEnd` (its behaviour runs first; give your key and focus handlers to the ComboBox), the button's press and `onKeyDown`, and the listbox handlers of [ListBox](listbox.md#dom-events-and-attributes).

::example{id=combobox-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-ComboBox` | root | `class` |
| `.rv-ComboBox[data-open]`, `[data-focused]`, `[data-disabled]`, `[data-invalid]`, `[data-required]`, `[data-readonly]` | root states | `data-open:` / `group-data-[open]:`, `focused:`, … |
| `.rv-Popover[data-trigger="ComboBox"]` | the combobox popover | `class` on `Popover`, `w-(--trigger-width)` |
| `.rv-ListBoxItem[data-focused]` | the virtually focused option | `focused:` |
| `.rv-ListBoxItem[aria-selected="true"]`, `[aria-disabled="true"]` | selected / disabled option | `aria-selected:`, `aria-disabled:` |
| `.rv-Button[data-pressed]` | trigger while open | `data-[pressed]:` |
| `.rv-ComboBoxValue[data-placeholder]` | empty value | `data-[placeholder]:` |

`class` / `style` replace the default class names (or compute them from the render props); the data attributes stay.

### Tailwind

::example{id=combobox-tailwind}

### Plain CSS

::example{id=combobox-css}

### Starter theme

`@rivetjs/cdk/theme.css` styles the input, the popover and the options (selected and disabled). It does not mark the virtually focused option yet (`.rv-ListBoxItem[data-focused]`): add a rule like the plain-CSS example. Its rules use `:where(…)`, so yours win.

## Accessibility

- The input is `role="combobox"` with `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` while open and `aria-activedescendant` on the focused option; it is labelled by the `Label` and described by the `ComboBoxValue`, the description and the error.
- The listbox is labelled "Suggestions" (localized) and the label; the trigger button is labelled by its own `aria-label` and the label, and stays out of the tab order.
- The popover is non-modal: everything outside the combobox and the popover is `aria-hidden` while it is open; visually hidden Dismiss buttons let screen-reader users close it.
- Announcements (through the live announcer: render `<Announcer />` once, usually in the root layout): the number of options when the list opens or the count changes, the focused option on Apple devices (VoiceOver), and the selected option.

### Keyboard

| Key | Action |
| --- | --- |
| Typing | Filters and opens the popover (`menuTrigger="input"`). |
| :kbd[ArrowDown], :kbd[ArrowUp] | Open (focusing the first / last option), or move the virtual focus. |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Clear the virtual focus (the caret moves in the text). |
| :kbd[Enter] | Select the focused option (or follow its link / action) and close; without a focused option, commit the text. |
| :kbd[Tab] | Commit and move on. |
| :kbd[Escape] | Close and reset the text to the selected item's text (empty when nothing is selected; kept with `allowsCustomValue`). |

## Resumability

- The server renders the closed field (label, input with its text, button, hidden inputs). The popover and its listbox render on the client when it opens; no combobox code loads before the first interaction.
- The state (`createComboBoxCore`: value, text, open flag, focused key, validation) is signals whose values are written into the page; the collection is rebuilt from the children on use.
- Dynamic `{() => cond() ? <ListBoxItem/> : null}` children of the `ListBox` are not tracked: derive `items` / `defaultItems` (an accessor) instead.
- On a resumed page the first keystrokes after load can be lost while the input's `value` is re-applied from the server state.

## Testing

`@rivetjs/testing/user` ships the ported `ComboBoxTester` (React Aria test-utils): `user.createTester("ComboBox", { root, trigger?, interactionType? })`, then `open()`, `findOption({ indexOrText })`, `toggleOptionSelection({ option, closesOnSelect? })`, `close()`, `getCombobox()`, `getTrigger()`, `getListbox()`, `getOptions()`, `getSections()`, `getFocusedOption()`.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ComboBox` (`<div>`), `ComboBoxValue` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ComboBox render={(props) => <div {...(props as {})} />}>…</ComboBox>
```

## Custom markup

`@rivetjs/cdk/combobox/behaviour` is the layer `ComboBox` is built on (react-aria `useComboBox`): `comboBoxProps(props, state)` returns `{ labelProps, inputProps, buttonProps, listBoxProps, valueProps, descriptionProps, errorMessageProps, ids, listBoxId, isInvalid(), validationErrors(), validationDetails() }`; the handlers (`comboBoxInputKeyDown`, `comboBoxInputBlur`, `comboBoxInputFocus`, `comboBoxInputTouchEnd`, `comboBoxLabelClick`, `comboBoxButtonPress`, `comboBoxButtonPressStart`, `comboBoxButtonKeyDown`) and `comboBoxEffects` / `comboBoxDisposeEffects` are exported for custom fields. The state is `@rivetjs/cdk/state/combobox` (react-stately `useComboBoxState`: `createComboBoxState`, `openCombo`, `closeCombo`, `commitCombo`, `revertCombo`, `setComboInputValue`, …).

::api{symbol="@rivetjs/cdk/combobox/behaviour#comboBoxProps"}

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ComboBox`, `ComboBoxValue`, `ComboBoxContext`, `ComboBoxStateContext`, `ComboBoxValueContext` | RAC `ComboBox.tsx` |
| `@rivetjs/cdk/combobox/behaviour` | react-aria `useComboBox` |
| `@rivetjs/cdk/state/combobox` | react-stately `useComboBoxState` |

Deviations:

- Render props are accessors; `class` is RAC `className`.
- `selectedKey` / `value` / `inputValue` take a Signal for two-way binding; a plain value is controlled.
- The popover width is the Popover's `--trigger-width` of the group (else the input); RAC's input + button measurement without a `Group` is not ported.

## Not yet supported

- A `Virtualizer` in the popover; async loading (`useAsyncList` / `ListBoxLoadMoreItem` in a combobox).
- `FieldError` rendering on resumed pages (see [Forms and validation](#forms-and-validation)).

## Common mistakes

- **No `<Announcer />`.** Without the server-rendered live regions, the first result count may not be read.
- **Both values controlled, text never updated.** With `selectedKey` and `inputValue` both controlled, write the text in `onSelectionChange`.
- **Filtering `items` twice.** `items` is not filtered; use `defaultItems` for the built-in filter.
- **No name on the button.** Give the trigger `Button` an `aria-label`.
- **Reading the text as the value.** The value is the selected key (`value` / `selectedKey`, or the hidden input); free text selects nothing unless `allowsCustomValue`.
