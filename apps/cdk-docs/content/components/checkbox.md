---
title: Checkbox
description: Checkbox from @rivetjs/cdk selects one item or marks it as selected; CheckboxField + CheckboxButton add a description, errors and form validation.
template: guide
status: experimental
related: [components/checkbox-group, components/switch, components/form, components/field]
---

A checkbox allows a user to select an item, with support for validation and help text. `CheckboxField` owns the state and validation; `CheckboxButton` is the clickable `<label>` around a visually hidden native `<input type="checkbox">`, so keyboard support, focus and the form value come from the browser. The state is a plain value, a two-way `Signal<boolean>` or an accessor (`isSelected`), or internal (`defaultSelected`), and shows on both parts as `data-*` attributes. Being headless, it draws nothing: render your own box in the button (here a lucide `Check`).

::example{id=checkbox-controlled}

## Anatomy

```tsx
<CheckboxField>
  <CheckboxButton>Label</CheckboxButton>
  <Text slot="description" />
  <FieldError />
</CheckboxField>
```

```html
<div class="rv-CheckboxField" data-selected="true" data-required="true">
  <label class="rv-CheckboxButton" data-selected="true" data-required="true">
    <span style="position:absolute;width:1px;height:1px;clip-path:inset(50%);…">
      <input id="terms" type="checkbox" name="terms" value="accepted" required checked
             aria-describedby="terms-description terms-error" />
    </span>
    <span class="box" aria-hidden="true"><svg …/></span>
    I accept the terms
  </label>
  <span id="terms-description" slot="description" class="rv-Text">Read them first.</span>
  <!-- FieldError: only while invalid -->
  <span id="terms-error" slot="errorMessage" class="rv-FieldError">Accept the terms to continue.</span>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `CheckboxField` | `div` | `rv-CheckboxField` | State, validation, `TextContext` slots and `FieldErrorContext` for the parts inside. Global DOM props land here. |
| `CheckboxButton` | `label` | `rv-CheckboxButton` | The clickable area: indicator and label content. Carries the interaction state (`data-pressed`, `data-hovered`, `data-focus-visible`). |
| input | `input[type=checkbox]` | none | Inside an inline-styled visually hidden `<span>`. Gets `id` (generated otherwise), `name`, `value`, `form`. |
| `Text slot="description"` (`@rivetjs/cdk/text`) | `span` | `rv-Text` | Id `<id>-description`; on the input's `aria-describedby`. |
| `FieldError` (`@rivetjs/cdk/form`) | `span` | `rv-FieldError` | Renders only while invalid; id `<id>-error`. Default content: the validation errors joined. |
| `Checkbox` (deprecated) | `label` | `rv-Checkbox` | All-in-one: `CheckboxField` props on a lone `CheckboxButton`, no description or error parts. |

| Attribute | Where | Value |
| --- | --- | --- |
| `data-selected`, `data-indeterminate` | field and button | checked; mixed (`isIndeterminate`; the input's `indeterminate` property is set as a DOM property) |
| `data-disabled`, `data-readonly`, `data-invalid`, `data-required` | field and button | the matching state |
| `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible` | button | interaction state |
| `required` / `aria-required` | input | `isRequired` with native / aria validation |
| `aria-invalid`, `aria-readonly`, `aria-describedby` | input | invalid; read-only; description and error ids |
| `data-rv-error` | input | the current realtime error, applied by `<Form>` on a submit before the checkbox ran code |

Without `aria-label` / `aria-labelledby`, give the button content: a checkbox without children logs a warning in development.

## Import

```ts
import { CheckboxField, CheckboxButton } from "@rivetjs/cdk/checkbox";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
```

## Props

### CheckboxField

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `isSelected` | `boolean \| Signal<boolean> \| () => boolean` | none | Controlled. A signal is two-way; a plain value or accessor is controlled by you (changes come through `onChange`). |
| `defaultSelected` | `boolean` | `false` | Uncontrolled initial state; restored by a form reset. |
| `onChange` | `(isSelected: boolean) => void` | none | The user changed the state. |
| `isIndeterminate` | `boolean \| () => boolean` | none | Mixed state; overrides the shown state, a press still sets `isSelected`. An accessor stays live. |
| `value` | `string` | none (browser: `"on"`) | Submitted while checked. Inside a [CheckboxGroup](checkbox-group.md): the value this checkbox adds to the group's `value`. |
| `name`, `form` | `string` | none | Form submission (a group passes its own). |
| `isDisabled` | `boolean \| () => boolean` | `false` | An accessor stays live. |
| `isReadOnly` | `boolean` | `false` | Focusable by keyboard, the state does not change. |
| `isRequired` | `boolean` | `false` | Must be checked. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state. |
| `validate` | `(isSelected: boolean) => string \| string[] \| true \| null \| undefined` | none | Custom validation; errors show in `FieldError`. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the enclosing [Form](form.md)'s) | `native`: `required`, blocks submit, errors show on commit. `aria`: realtime, never blocks. |
| `id` | `string` | generated | Id of the input; the description and error ids derive from it. |
| `autoFocus`, `excludeFromTabOrder` | `boolean` | `false` | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-controls` | `string` | none | On the input. |
| `inputRef` | `Ref<HTMLInputElement>` or callback | none | The native input. |
| `ref` | `RefValue<HTMLDivElement>` | none | The field `div`. |
| `slot` | `string \| null` | none | Slot name in a parent's `CheckboxFieldContext`; `null` ignores the context. |
| `children` | content or `(renderProps) => content` | none | `CheckboxButton`, `Text`, `FieldError`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-CheckboxField` | A `class` replaces the default class. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `CheckboxField`; see [Render](#render). |
| global DOM props | `GlobalDOMAttributes` (minus `onClick`) | none | On the field `div`. |

### CheckboxButton

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | Indicator and label; render props are accessors (`isSelected()`). |
| `class`, `style` | value or `(renderProps) => value` | `rv-CheckboxButton` (`rv-Checkbox` inside `Checkbox`) | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<label>` of `CheckboxButton`; see [Render](#render). |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | handlers | none | Mouse hover (not while disabled or read-only). |
| `ref` | `RefValue<HTMLLabelElement>` | none | |
| `slot` | `string \| null` | none | |
| global DOM props | `GlobalDOMAttributes` | none | On the `<label>`, chained after its own press and `onMouseDown` handlers. |

`Checkbox` (deprecated in RAC, kept) takes the `CheckboxField` props plus the `CheckboxButton` ones on one `<label>`.

### Events

| Event | Part | Fires |
| --- | --- | --- |
| `onChange(isSelected)` | field | The user changed the state (not when you write `isSelected`). |
| `onPress`, `onPressStart`, `onPressEnd`, `onPressUp`, `onPressChange`, `onClick` | field | Press on the label (mouse / touch) or the input (keyboard, `pointerType: "keyboard"`). |
| `onFocus`, `onBlur`, `onFocusChange(isFocused)` | field | Focus of the input. |
| `onKeyDown`, `onKeyUp` | field | Keys on the input. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | button | Mouse hover of the label. |

### Render props

| Render prop | Field | Button | Selector |
| --- | --- | --- | --- |
| `isSelected` | yes | yes | `[data-selected]` |
| `isIndeterminate` | yes | yes | `[data-indeterminate]` |
| `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired` | yes | yes | `[data-disabled]`, `[data-readonly]`, `[data-invalid]`, `[data-required]` |
| `isHovered`, `isPressed`, `isFocused`, `isFocusVisible` | | yes | `[data-hovered]`, `[data-pressed]`, `[data-focused]`, `[data-focus-visible]` |

Every render prop is an accessor: call it (`isSelected()`) inside the content or a `class` function.

## Selection

Use `isSelected` or `defaultSelected` to set the state and `onChange` to handle changes. A signal is the state, both ways: the checkbox writes it and a write checks or clears the box (above). An accessor (`isSelected={() => a() && b()}`) is controlled and live: the checkbox only reports through `onChange`.

`isIndeterminate` shows the mixed state of a "select all" box, whatever the selection. Here both are accessors of the child boxes, and the button's render props pick the icon.

::example{id=checkbox-indeterminate}

## Disabled, read-only and invalid

`isDisabled` removes the input from the Tab order and ignores presses. `isReadOnly` keeps it focusable while the state stays. `isInvalid` (here an accessor) sets `aria-invalid` and `data-invalid` without a validation message.

::example{id=checkbox-states}

## Forms and validation

Use `name` and `value` to submit the checkbox. `isRequired` with native validation puts `required` on the input: the browser blocks the submit, the error shows in `FieldError` and the box takes focus. `validate` returns an error string (or several). Server errors come from the enclosing [Form](form.md) by `name`. With `validationBehavior="aria"` errors show at once, `aria-required` replaces `required`, and nothing blocks the submit.

`FieldError` renders nothing while the field is valid. Its children may be a function of its render props (`isInvalid`, `validationErrors`, `validationDetails`) to word a native error.

::example{id=checkbox-validation}

## Events

::example{id=checkbox-events}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`, `data-*`) land on the part you set them on: `CheckboxField` → its `div` (except `onClick`, which is a press prop), `CheckboxButton` → the `<label>`. The label owns the press handlers (`onPointerDown`, `onClick`, …) and `onMouseDown` (it keeps focus off the label); yours run after them. Press handling stops `pointerdown` from bubbling to the field. Focus and key events are field props and land on the `<input>`.

::example{id=checkbox-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-CheckboxField`, `.rv-CheckboxButton` | the parts (unless you pass `class`) |
| `[data-selected]` | checked |
| `[data-indeterminate]` | mixed |
| `[data-disabled]`, `[data-readonly]`, `[data-required]`, `[data-invalid]` | states (both parts) |
| `.rv-CheckboxButton[data-hovered]`, `[data-pressed]`, `[data-focus-visible]` | interaction (button) |
| `.rv-Text[slot=description]`, `.rv-FieldError` | help and error text |

The input is visually hidden by an inline style: draw the box in `CheckboxButton` and style it from the label's state.

### Tailwind

Put `group` on the button and style the box with `group-data-[selected]:`, `group-data-[indeterminate]:`, `group-data-[focus-visible]:`, `group-data-[invalid]:`; `data-[disabled]:` on the button itself.

::example{id=checkbox-tailwind}

### Plain CSS

::example{id=checkbox-css}

### Starter theme

`@rivetjs/cdk/theme.css` lays `.rv-Checkbox` out as a flex row with a gap; it does not target `.rv-CheckboxButton` or draw a box.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `CheckboxField` (`<div>`), `CheckboxButton` (`<label>`), `Checkbox` (`<label>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. A `render` that ignores `children` drops the hidden input and breaks the control.

```tsx
<CheckboxField render={(props) => <div {...(props as {})} />}>…</CheckboxField>
```

## Accessibility

- A native checkbox inside its label: name, role and state come from the browser. Keep the indicator `aria-hidden`.
- `isIndeterminate` sets the native mixed state, announced as "mixed".
- The description and (while it renders) the error message are linked with `aria-describedby`.
- A label press toggles the box and focuses the input (`onMouseDown` keeps focus off the label).

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Space] | Toggle. |
| :kbd[Tab] | Move focus. |

## Resumability

- The server renders the checked state, the `data-*` attributes and the parts; no Checkbox code runs before the first interaction.
- Signals and accessors passed as `isSelected` / `isIndeterminate` / `isInvalid` / `isDisabled` resume with their values.
- Native validation: the realtime error is rendered as `data-rv-error`, so a `<Form>` blocks a submit before the checkbox ever ran code.
- **Known issue:** on some resumed pages (a larger form), a cold :kbd[Space] on a checkbox does not toggle on the first press; a click always does.

## Hooks

`@rivetjs/cdk/checkbox/behaviour` exposes the field behavior: `toggleProps(props, state, inputRef?)` and `checkboxProps(props, state, inputRef?)` return `labelProps`, `inputProps`, `descriptionProps`, `errorMessageProps` bags (accessors inside: spread them) and accessor flags (`isSelected()`, `isPressed()`, `isInvalid()`…). The input handlers are free functions (`toggleChange`, `toggleFocus`, `toggleInvalid`, `toggleLabelPress`); `mergeInputRefs` joins input refs. The state is `createToggleState` from `@rivetjs/cdk/state/toggle` (see [ToggleButton](toggle-button.md#custom-markup)).

::api{symbol="@rivetjs/cdk/checkbox/behaviour#checkboxProps"}

## Testing

Click the `<label>` (the input is visually hidden), or focus the input and press :kbd[Space], with `@testing-library/user-event` after `render` from `@rivetjs/runtime/testing`; then read `input.checked`, `data-selected` or the signal. For groups use the `CheckboxGroup` tester ([CheckboxGroup](checkbox-group.md#testing)).

## Upstream

| Rivet | Upstream |
| --- | --- |
| `CheckboxField`, `CheckboxButton`, `Checkbox`, `CheckboxContext`, `CheckboxFieldContext` | RAC `Checkbox` |
| `@rivetjs/cdk/checkbox/behaviour` | react-aria `useToggle`, `useCheckbox` |
| `@rivetjs/cdk/state/toggle` | react-stately `useToggleState` |
| validation | react-aria `useFormValidation`, react-stately `useFormValidationState` |

Deviations: `className` is `class`; render props are accessors; `isSelected` also takes a two-way signal or an accessor; `inputRef` is a Rivet `ref()` (or callback); a read-only checkbox's native `checked` is restored after the browser toggled it.


## Common mistakes

- **`display: none` on the input.** It is already visually hidden; hiding it removes it from the accessibility tree and the Tab order.
- **`isIndeterminate` as the value.** It is visual only; the value is `isSelected`.
- **A Checkbox for an instant setting.** A [Switch](switch.md) reads as on / off.
- **No `name` in a form.** Without a name nothing is submitted.
