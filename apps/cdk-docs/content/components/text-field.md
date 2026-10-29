---
title: TextField
description: TextField from @rivetjs/cdk composes Label, Input or TextArea, a description and FieldError with linked ids, a text value and form validation.
template: guide
status: experimental
related: [components/text-area, components/form, components/field, components/number-field]
---

A text field allows a user to enter a plain text value with a keyboard. `TextField` is the RAC component: it owns the value and the validation, and provides ids, ARIA attributes and state to the parts you compose inside it: a [Label](field.md), an `Input` (or a [TextArea](text-area.md) for several lines), a `Text slot="description"` and a `FieldError`.

::example{id=text-field-controlled}

## Anatomy

```html
<div class="rv-TextField" data-required="true">
  <label id="email-label" for="email" class="rv-Label">Email</label>
  <input id="email" type="email" class="rv-Input" name="email" required
    aria-labelledby="email-label" aria-describedby="email-description" />
  <span id="email-description" slot="description" class="rv-Text">We never share it.</span>
  <!-- FieldError: only while invalid -->
  <span id="email-error" slot="errorMessage" class="rv-FieldError">Enter your email.</span>
</div>
```

```tsx
<TextField>
  <Label />
  <Input /> {/* or <TextArea /> */}
  <Text slot="description" />
  <FieldError />
</TextField>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `TextField` | `div` | `rv-TextField` | Owns value + validation; root state data attributes; global DOM props land here. No `id` (the field `id` goes to the input). |
| `Label` (`@rivetjs/cdk/label`) | `label[for]` | `rv-Label` | Id `<id>-label`; the input's `aria-labelledby`. |
| `Input` (`@rivetjs/cdk/input`) | `input` | `rv-Input` | Id = the field `id` (generated). Native input attributes (`placeholder`, `autoCorrect`, …) go here. |
| `TextArea` (`@rivetjs/cdk/text-area`) | `textarea` | `rv-TextArea` | Instead of `Input`: same props minus `type` / `pattern`. |
| `Text slot="description"` (`@rivetjs/cdk/text`) | `span` | `rv-Text` | Id `<id>-description`; in `aria-describedby` while it renders. |
| `FieldError` (`@rivetjs/cdk/form`) | `span` | `rv-FieldError` | Renders only while invalid; id `<id>-error`; in `aria-describedby` while it renders. |

| Attribute | Where | Value |
| --- | --- | --- |
| `data-disabled`, `data-readonly`, `data-required`, `data-invalid` | root | the matching state |
| `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid` | input / textarea | the part's own state |
| `required` / `aria-required` | input | `isRequired` with native / aria validation |
| `aria-invalid` | input | invalid |
| `aria-describedby` | input | description, error (each while it renders), then yours |
| `data-rv-error` | input | native mode: the current custom error, applied by [Form](form.md) on submit |

## Import

```ts
import { TextField } from "@rivetjs/cdk/text-field";
import { Label } from "@rivetjs/cdk/label";
import { Input } from "@rivetjs/cdk/input";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string \| Signal<string>` | none | A signal is two-way; a plain value is controlled (only `onChange` fires). |
| `defaultValue` | `string` | `""` | Uncontrolled start; restored by a form reset. |
| `onChange` | `(value: string) => void` | none | Every input event. |
| `type` | `string` | `"text"` | Input only (not on a TextArea). |
| `pattern` | `string` | none | Input only. |
| `name`, `form` | `string` | none | `name` keys the [Form](form.md)'s server errors. |
| `autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck`, `inputMode`, `enterKeyHint` | native values | none | Forwarded to the input. |
| `maxLength`, `minLength` | `number` | none | Native constraints; they feed validation. |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state; an accessor stays live. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated (RA legacy); use `isInvalid`. |
| `validate` | `(value: string) => string \| string[] \| true \| null \| undefined` | none | Custom errors. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the Form's) | |
| `autoFocus` | `boolean` | `false` | |
| `excludeFromTabOrder` | `boolean` | `false` | `tabindex="-1"` on the input. |
| `id` | `string` | generated | Input id; part ids derive from it. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage` | `string` | none | Without a `Label`, pass `aria-label` / `aria-labelledby`. |
| `aria-activedescendant`, `aria-autocomplete`, `aria-haspopup`, `aria-controls` | ARIA values | none | For inputs that drive a popup. |
| `slot` | `string` | none | Slot of an enclosing component's `TextFieldContext`. |
| `class` | `string \| (rp) => string` | `rv-TextField` | A value replaces the default class. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `TextField`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `children` | content `\| (rp) => content` | none | The parts. |
| `ref` | `RefValue<HTMLDivElement>` | none | Root element. |
| global DOM props | `GlobalDOMAttributes` | none | On the root `div` (except `onInput` / `onBeforeInput`, which are input events). |

Props of the parts (`placeholder`, `rows`, `class`, hover events, …) are set on `Input` / `TextArea` / `Label` / `Text` / `FieldError` themselves.

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `isInvalid` | `() => boolean` | `[data-invalid]` |
| `isReadOnly` | `() => boolean` | `[data-readonly]` |
| `isRequired` | `() => boolean` | `[data-required]` |

`Input` / `TextArea` render props: `isHovered`, `isFocused`, `isFocusVisible`, `isDisabled`, `isInvalid` (`[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-disabled]`, `[data-invalid]`).

### Events

| Event | Fires |
| --- | --- |
| `onChange(value)` | The text changed (every input event). |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocused)` | Focus of the input. |
| `onKeyDown(e)`, `onKeyUp(e)` | Keys on the input. |
| `onInput`, `onBeforeInput`, `onCopy`, `onCut`, `onPaste`, `onCompositionStart` / `Update` / `End`, `onSelect` | Native text input events on the input. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | Props of `Input` / `TextArea`. |

## Value

With `value` as a signal, typing writes it and a write updates the input. `defaultValue` starts an internal value (also what a form reset restores).

## HTML forms and input options

`name` submits the value with a native form. `type`, `inputMode`, `enterKeyHint`, `autoComplete`, `maxLength`, `minLength`, `pattern` and `spellCheck` are set on the TextField and land on the input; `placeholder` is a prop of `Input`.

::example{id=text-field-types}

## Labeling, disabled and read only

`Label` links itself with `for` and the input's `aria-labelledby`. Without a visible label, pass `aria-label` or `aria-labelledby` to the TextField.

::example{id=text-field-states}

## Description and error content

`Label`, `Text slot="description"` and `FieldError` take any content; content reading signals stays live. `FieldError` children may be a function of its render props (`isInvalid`, `validationErrors`, `validationDetails`, all accessors).

::example{id=text-field-slots}

## Validation

- **Native** (default): `isRequired`, `type`, `minLength` / `maxLength` / `pattern` and `validate` feed the browser's validity. Errors show on commit (blur after a change, or a submit); a submit is blocked and the first invalid field focused.
- **Aria**: errors show while typing and never block; `aria-required` replaces `required`.
- **Server errors**: the enclosing [Form](form.md)'s `validationErrors` by `name`; committing an edit clears the field's error.
- `FieldError` without children shows the error messages joined by spaces; nothing renders while valid.

::example{id=text-field-validation}

## Events

::example{id=text-field-events}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) set on the `TextField` land on the root `<div>`. Text input events (`onInput`, `onBeforeInput`, clipboard, composition and selection events) set on the `TextField` land on the input; the field owns `onInput` / `onFocus` / `onBlur` and calls yours after its own handler. Other native input attributes go on the `Input` part.

::example{id=text-field-dom-events}

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | When |
| --- | --- |
| `.rv-TextField` | root; `[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]` |
| `.rv-Input` | the input; `[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-invalid]`, `[data-disabled]`, `:user-invalid` |
| `.rv-Label`, `.rv-Text`, `.rv-FieldError` | label, description, error |

A `class` value replaces the default class (RAC `className`); `class={(rp) => …}` computes it from the render props.

### Tailwind

`@rivetjs/cdk/tailwind.css` adds the `focused:` variant (`[data-focused]`); use `data-[invalid]:`, `data-[hovered]:`, `group-data-[disabled]:` for the rest.

::example{id=text-field-tailwind}

### Plain CSS

::example{id=text-field-css}

### Starter theme

`@rivetjs/cdk/theme.css` stacks `.rv-TextField` in a grid and draws `.rv-Input` with the theme border, red while `[aria-invalid=true]` or `:user-invalid`. Its description / error rules target `[data-slot="description"]` / `[data-slot="error"]`, which the parts no longer render (they render `slot="…"`).

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `TextField` (`<div>`), `Input` (`<input>`), `TextArea` (`<textarea>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<TextField render={(props) => <div {...(props as {})} />}>…</TextField>
```

## Accessibility

- A native input labelled by `Label` (`for` + `aria-labelledby`); description and error linked with `aria-describedby` while they render.
- Without a `Label`, a development warning asks for `aria-label` / `aria-labelledby`.

### Keyboard

Native text input keys; :kbd[Enter] submits the enclosing form.

## Resumability

- The server renders the value, the attributes and server errors. Typing works before any code loads; the field's handlers resume on the first input or focus.
- The server keeps both the description and error ids in `aria-describedby`; once code runs, ids of parts that do not render are dropped.
- Native mode renders the custom error as `data-rv-error`, so a `<Form>` can block a submit before the field ran code.

## Hooks

`@rivetjs/cdk/text-field/behaviour` provides helpers for building your own field: `createTextFieldState(props)` (value + validation), `textFieldProps(props, inputRef?, state?)` (label / input / description / error bags with accessors) and the handlers `textFieldInput`, `textFieldChange`, `textFieldInvalid`, `textFieldFocus`, `textFieldBlur`.

::api{symbol="@rivetjs/cdk/text-field/behaviour#textFieldProps"}

## Testing

Render with `render` from `@rivetjs/runtime/testing`, type with `@testing-library/user-event` (`getByLabelText("Email")`), then read the signal, `input.value` or `aria-invalid`. `typeInElement` from `@rivetjs/testing/fake-events` types without user-event.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `TextField`, `TextFieldContext` | RAC `TextField` |
| `Input`, `TextArea`, `Label`, `Text`, `FieldError` | RAC parts of the same names |
| `@rivetjs/cdk/text-field/behaviour` | react-aria `useTextField`, `useFormattedTextField`, `useFormReset` |
| autosize, autofill (`@rivetjs/cdk/text-field/autosize`, also re-exported from `@rivetjs/cdk/text-field`) | Angular CDK `CdkTextareaAutosize`, `AutofillMonitor`, `CdkAutofill` |

Deviations: `className` is `class`; render props are accessors; `value` takes a two-way signal; hooks are prop factories plus free handler functions.

## Not yet supported

- `GroupContext` (a `Group` inside a TextField gets no field props).
- `type="number"`: use [NumberField](number-field.md).

## Common mistakes

- **`placeholder` on the TextField.** It is an `Input` prop.
- **`onChange` for commit.** It fires on every input; use `onBlur` for commit.
- **Server errors without `name`.** The [Form](form.md) maps errors by field name.
- **Selecting `.rv-TextField` after passing `class`.** A class value replaces the default one.
