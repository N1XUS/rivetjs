---
title: SearchField
description: SearchField from @rivetjs/cdk is a labelled search input with a clear button; Enter submits, Escape clears. Composed from Label, Input and Button parts.
template: guide
status: experimental
related: [components/text-field, components/autocomplete, components/field, components/form, components/button]
---

`SearchField` is a port of React Aria Components `SearchField` (with react-aria `useSearchField` and react-stately `useSearchFieldState`). It is composed from parts like RAC: a `Label`, an `Input` (`type="search"`), a clear `Button`, an optional `Text slot="description"` and a `FieldError`. The field fills each part through its context. :kbd[Enter] calls `onSubmit` with the text, :kbd[Escape] and the clear button empty it and call `onClear`. The server HTML is the complete field; nothing runs until the first interaction.

::example{id=search-field-basic}

## Anatomy

```html
<div class="rv-SearchField" data-empty="true">
  <label id="q-label" for="q" class="rv-Label">Search</label>
  <input type="search" id="q" class="rv-Input" aria-labelledby="q-label" placeholder="Search docs" value="" />
  <button type="button" id="rv0" tabindex="-1" class="rv-Button" aria-label="Clear search"><svg … /></button>
  <span id="q-description" slot="description" class="rv-Text">At least 2 characters.</span>
</div>
```

```tsx
<SearchField>
  <Label />
  <Input />
  <Button />
  <Text slot="description" />
  <FieldError />
</SearchField>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `SearchField` | `div` | `rv-SearchField` | Root; state attributes below. `id` goes to the input. |
| `Label` | `label` | `rv-Label` | `for` the input; id `<id>-label`. |
| `Input` | `input[type=search]` | `rv-Input` | `type` from the field (`"search"` by default); `placeholder` on the Input. |
| `Button` | `button` | `rv-Button` | The clear button: `aria-label="Clear search"` (localized), out of the tab order, keeps focus in the input; disabled with the field. |
| `Text slot="description"` | `span` | `rv-Text` | Id `<id>-description`; describes the input. |
| `FieldError` | `span` | `rv-FieldError` | Rendered while invalid; describes the input. |

Other markup (a wrapping `div`, a search icon) may sit between the parts: the contexts reach any depth.

| Attribute | Where | Value |
| --- | --- | --- |
| `data-empty` | root | the text is empty |
| `data-disabled`, `data-readonly`, `data-required`, `data-invalid` | root | `isDisabled`, `isReadOnly`, `isRequired`, invalid |
| `aria-invalid`, `aria-describedby` | input | invalid; description and error ids |

## Import

```ts
import { SearchField } from "@rivetjs/cdk/search-field";
import { Label } from "@rivetjs/cdk/label";
import { Input } from "@rivetjs/cdk/input";
import { Button } from "@rivetjs/cdk/button";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | parts, or `(props: SearchFieldRenderProps) => content` | none | |
| `value` | `string \| Signal<string> \| () => string` | none | Controlled text: a plain value (reported through `onChange`), a two-way Signal, or an accessor read live. |
| `defaultValue` | `string` | `""` | Initial text (uncontrolled). |
| `onChange` | `(value: string) => void` | none | |
| `onSubmit` | `(value: string) => void` | none | :kbd[Enter]. Without it, :kbd[Enter] submits the enclosing form (browser default). |
| `onClear` | `() => void` | none | :kbd[Escape] or the clear button. |
| `type` | `"search" \| "text" \| "url" \| "tel" \| "email" \| "password" \| string` | `"search"` | The input type. |
| `enterKeyHint` | `"enter" \| "done" \| "go" \| "next" \| "previous" \| "search" \| "send"` | none | |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | Disabled / read-only: no :kbd[Enter] / :kbd[Escape] shortcuts, clear button disabled. |
| `isInvalid` | `boolean \| () => boolean` | none | An accessor stays live. `validationState` (`"valid" \| "invalid"`) is the deprecated RA form. |
| `validate` | `(value: string) => string \| string[] \| true \| null \| undefined` | none | |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the enclosing `Form`'s) | |
| `name`, `form` | `string` | none | The input's form field. |
| `pattern`, `maxLength`, `minLength`, `autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck`, `inputMode` | | none | On the input. |
| `autoFocus`, `excludeFromTabOrder` | `boolean` | `false` | |
| `id` | `string` | generated | The input's id. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-activedescendant`, `aria-autocomplete`, `aria-haspopup`, `aria-controls` | | none | On the input. |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp` | | none | Input focus and keys. |
| `onCopy`, `onCut`, `onPaste`, `onCompositionStart`, `onCompositionEnd`, `onCompositionUpdate`, `onSelect` | | none | Input events. |
| `class`, `style` | value or `(props: SearchFieldRenderProps) => value` | `rv-SearchField` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `SearchField`; see [Render](#render). |
| `slot` | `string \| null` | none | `SearchFieldContext` slot. |
| `ref` | `Ref<HTMLDivElement>` | none | Root element. |
| global DOM props | `GlobalDOMAttributes` (without `style`, `onInput`, `onBeforeInput`) | none | On the root. |

`SearchFieldRenderProps` (accessors): `isEmpty()`, `isDisabled()`, `isInvalid()`, `isReadOnly()`, `isRequired()`, plus `state` (the `SearchFieldState`).

::api{symbol="@rivetjs/cdk/search-field#SearchFieldProps"}

### Events

| Event | Fires |
| --- | --- |
| `onChange(value)` | Typing, :kbd[Escape], the clear button. |
| `onSubmit(value)` | :kbd[Enter]. |
| `onClear()` | :kbd[Escape] with text, the clear button. |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp` | On the input. |

::example{id=search-field-events}

## Value

Uncontrolled with `defaultValue`; controlled with `value`. A `Signal` is written two-way (`value={query}`); an accessor (`value={() => store.query}`) is read live and changes reach `onChange`. Inside an [Autocomplete](autocomplete.md), the Autocomplete owns the value.

## Description, validation and disabled

A `Text slot="description"` and a `FieldError` describe the input (`aria-describedby`). `isRequired`, `minLength`, `pattern` and `validate` validate with the field's `validationBehavior`: `"native"` (default) blocks the form submit and shows the error after submit / commit; `"aria"` shows it as you type. `isDisabled` disables the input and the clear button.

::example{id=search-field-validation}

:::warning
On a resumed page the `FieldError` inside a SearchField does not render yet: the input gets `aria-invalid` and the root `data-invalid`, but the message part stays empty.
:::

## DOM events and attributes

Every part takes the global DOM events and attributes (`GlobalDOMAttributes`: mouse, pointer, touch, wheel, scroll, drag, animation and transition events, `dir`, `lang`, `hidden`, `inert`, `data-*`): `SearchField` props land on the root `div`, `Input` props on the `<input>`, `Button` props on the clear button. The field owns the input's `onKeyDown` (:kbd[Enter] / :kbd[Escape] shortcuts, then your `onKeyDown`) and the clear button's press. `on…Capture` handlers do not resume yet.

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-SearchField` | root | `class` |
| `.rv-SearchField[data-empty]` | empty text (hide the clear button) | `group-data-[empty]:invisible` on the Button |
| `.rv-SearchField[data-disabled]`, `[data-invalid]`, `[data-readonly]`, `[data-required]` | states | `data-[disabled]:`, … |
| `.rv-Input::-webkit-search-cancel-button` | the browser's own clear control | `[&::-webkit-search-cancel-button]:hidden` |
| `.rv-Button[data-pressed]` | clear button pressed | `data-[pressed]:` |

`class` / `style` replace the default class names (or compute them from the render props); the data attributes stay.

### Tailwind

::example{id=search-field-tailwind}

### Plain CSS

::example{id=search-field-css}

### Starter theme

`@rivetjs/cdk/theme.css` styles the `rv-Input`, `rv-Label` and `rv-Button` parts; it has no SearchField-specific rules (hide the clear button on `[data-empty]` yourself). Its rules use `:where(…)`, so yours win.

## Accessibility

- A native `<input type="search">` labelled by the `Label` (or `aria-label`), described by the description and the error.
- The clear button is labelled "Clear search" (localized from the locale), is not in the tab order (:kbd[Escape] does the same from the keyboard) and keeps focus in the input when pressed.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter] | `onSubmit(value)`; without `onSubmit`, the form submits. |
| :kbd[Escape] | Clear the text and call `onClear`; with no text, the key propagates (an enclosing dialog closes). |

## Resumability

- The server renders the whole field (`data-empty`, the value). No SearchField code runs before the first interaction.
- The state (`createSearchFieldState`: the controlled / uncontrolled value) serializes; callbacks must be inline arrows or local consts.
- The server's `aria-describedby` lists the description and error ids even when the part is absent; the client corrects it on first use.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `SearchField` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<SearchField render={(props) => <div {...(props as {})} />}>…</SearchField>
```

## Custom markup

`@rivetjs/cdk/search-field/behaviour` is the layer `SearchField` is built on (react-aria `useSearchField`): `searchFieldProps(props, state, inputRef?)` returns `{ labelProps, inputProps, clearButtonProps, descriptionProps, errorMessageProps, ids, textState, isInvalid, validationErrors, validationDetails }`; `searchFieldKeyDown`, `searchFieldClear`, `searchFieldClearPressStart` are the handlers. The state is `@rivetjs/cdk/state/search-field` (`createSearchFieldState`, `searchFieldValue`, `setSearchFieldValue`).

::api{symbol="@rivetjs/cdk/search-field/behaviour#searchFieldProps"}

## Upstream

| Rivet | Upstream |
| --- | --- |
| `SearchField`, `SearchFieldContext` | RAC `SearchField.tsx` |
| `@rivetjs/cdk/search-field/behaviour` | react-aria `useSearchField` |
| `@rivetjs/cdk/state/search-field` | react-stately `useSearchFieldState` |

Deviations: render props are accessors; `class` is RAC `className`; `value` also takes a Signal (two-way) or an accessor. Not yet supported: `FieldError` rendering on resumed pages.

## Common mistakes

- **Two clear buttons.** Browsers draw their own on `type="search"`: hide `::-webkit-search-cancel-button`.
- **Clear button always visible.** Hide it on `[data-empty]`.
- **Expecting Enter to submit with `onSubmit`.** `onSubmit` replaces the form submit; drop it to let the form post.
