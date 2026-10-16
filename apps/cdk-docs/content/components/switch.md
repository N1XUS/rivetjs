---
title: Switch
description: Switch from @rivetjs/cdk turns a setting on or off; a native checkbox with role=switch in a label, plus SwitchField for help text and validation.
template: guide
status: experimental
related: [components/checkbox, components/toggle-button, components/form, components/field]
---

A switch allows a user to turn a setting on or off. `Switch` renders a `<label>` around a visually hidden native `<input type="checkbox" role="switch">`: keyboard support, focus and the form value come from the browser, and screen readers announce "on" / "off". The state is a plain value, a two-way `Signal<boolean>` or an accessor (`isSelected`), or internal (`defaultSelected`), mirrored as `data-selected`. Being headless, it draws nothing: render the track (and thumb) in the label and style it from its state. `SwitchField` + `SwitchButton` add a description, an error message and validation.

::example{id=switch-controlled}

## Anatomy

```tsx
<Switch>Label</Switch>

<SwitchField>
  <SwitchButton>Label</SwitchButton>
  <Text slot="description" />
  <FieldError />
</SwitchField>
```

```html
<div class="rv-SwitchField" data-required="true">
  <label class="rv-SwitchButton" data-required="true">
    <span style="position:absolute;width:1px;height:1px;clip-path:inset(50%);…">
      <input id="sw-2fa" type="checkbox" role="switch" name="two-factor" required
             aria-describedby="sw-2fa-description sw-2fa-error" />
    </span>
    <span class="track" aria-hidden="true"></span>
    Two-factor authentication
  </label>
  <span id="sw-2fa-description" slot="description" class="rv-Text">Your organisation requires two-factor authentication.</span>
  <!-- FieldError: only while invalid -->
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `Switch` | `label` | `rv-Switch` | All-in-one: state and the clickable area; provides `ToggleStateContext`. Global DOM props land here. |
| `SwitchField` | `div` | `rv-SwitchField` | State, validation, `TextContext` slots and `FieldErrorContext` for the parts inside. |
| `SwitchButton` | `label` | `rv-SwitchButton` | The clickable area of a `SwitchField`: indicator and label content. |
| input | `input[type=checkbox][role=switch]` | none | Inside an inline-styled visually hidden `<span>`. Gets `id` (generated otherwise), `name`, `value`, `form`. |
| `Text slot="description"`, `FieldError` | `span` | `rv-Text`, `rv-FieldError` | Ids `<id>-description`, `<id>-error`; `FieldError` renders only while invalid. |

| Attribute | Where | Value |
| --- | --- | --- |
| `data-selected` | label (and field) | on |
| `data-disabled`, `data-readonly` | label (and field) | the matching state |
| `data-invalid`, `data-required` | `SwitchField` and its `SwitchButton` | validation state |
| `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible` | label | interaction state |
| `checked`, `required` / `aria-required`, `aria-invalid`, `aria-readonly`, `aria-describedby` | input | state, validation, read-only, description and error ids |

## Import

```ts
import { Switch, SwitchField, SwitchButton } from "@rivetjs/cdk/switch";
```

## Props

### Switch

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | Indicator and label. Without children set `aria-label` / `aria-labelledby` (development warns). |
| `isSelected` | `boolean \| Signal<boolean> \| () => boolean` | none | Controlled. A signal is two-way; a plain value or accessor is controlled by you (changes come through `onChange`). |
| `defaultSelected` | `boolean` | `false` | Uncontrolled initial state; restored by a form reset. |
| `onChange` | `(isSelected: boolean) => void` | none | The user changed the state. |
| `name`, `value`, `form` | `string` | none (browser value `"on"`) | Submitted while on. |
| `isDisabled` | `boolean \| () => boolean` | `false` | An accessor stays live. |
| `isReadOnly` | `boolean` | `false` | Focusable by keyboard, the state does not change. |
| `autoFocus`, `excludeFromTabOrder` | `boolean` | `false` | |
| `id` | `string` | generated | Id of the input. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage`, `aria-controls` | `string` | none | On the input. |
| `inputRef` | `Ref<HTMLInputElement>` or callback | none | The native input. |
| `ref` | `RefValue<HTMLLabelElement>` | none | The label. |
| `slot` | `string \| null` | none | Slot name in a parent's `SwitchContext`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-Switch` | A `class` replaces the default class. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<label>` of `Switch`; see [Render](#render). |
| global DOM props | `GlobalDOMAttributes` (minus `onClick`) | none | On the label. |

### SwitchField

The `Switch` props except the hover events, `children` (`SwitchButton`, `Text`, `FieldError`) and `class` default `rv-SwitchField` (`ref`: the `div`), plus:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `isRequired` | `boolean` | `false` | Must be on. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state. |
| `validate` | `(isSelected: boolean) => string \| string[] \| true \| null \| undefined` | none | Custom validation. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the [Form](form.md)'s) | |

### SwitchButton

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | |
| `class`, `style` | value or `(renderProps) => value` | `rv-SwitchButton` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<label>` of `SwitchButton`; see [Render](#render). |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | handlers | none | |
| `ref`, `slot` | | none | |
| global DOM props | `GlobalDOMAttributes` | none | On the label. |

### Events

| Event | Fires |
| --- | --- |
| `onChange(isSelected)` | The user changed the state (not when you write `isSelected`). |
| `onPress`, `onPressStart`, `onPressEnd`, `onPressUp`, `onPressChange`, `onClick` | Press on the label (mouse / touch) or the input (keyboard). |
| `onFocus`, `onBlur`, `onFocusChange(isFocused)`, `onKeyDown`, `onKeyUp` | On the input. |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | Mouse hover of the label (`Switch`, `SwitchButton`). |

### Render props

| Render prop | `Switch` / `SwitchButton` | `SwitchField` | Selector |
| --- | --- | --- | --- |
| `isSelected`, `isDisabled`, `isReadOnly` | yes | yes | `[data-selected]`, `[data-disabled]`, `[data-readonly]` |
| `isInvalid`, `isRequired` | `SwitchButton` | yes | `[data-invalid]`, `[data-required]` |
| `isHovered`, `isPressed`, `isFocused`, `isFocusVisible` | yes | | `[data-hovered]`, `[data-pressed]`, `[data-focused]`, `[data-focus-visible]` |
| `state` | yes | yes | the `ToggleState` (`state.selected()`) |

## Selection

Use `isSelected` or `defaultSelected` to set the state and `onChange` to handle changes. A signal is two-way: the switch writes it and a write flips the switch (above).

## Disabled, read-only and invalid

`isDisabled` removes the input from the Tab order. `isReadOnly` keeps it focusable while the state stays. `excludeFromTabOrder` keeps an enabled switch out of the Tab order. `isInvalid` is a `SwitchField` prop.

::example{id=switch-states}

## Forms and validation

Use `name` and `value` to submit the switch: `name=value` while on, nothing while off. `SwitchField` with `isRequired` puts `required` on the input: the browser blocks the submit and the error shows in `FieldError`. `validate` and server errors (by `name`, from the [Form](form.md)) work like [Checkbox](checkbox.md#forms-and-validation).

::example{id=switch-form}

## Events

::example{id=switch-events}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) set on `Switch` or `SwitchButton` land on the `<label>`; on `SwitchField` on its `div` (except `onClick`, a press prop). The label owns the press handlers and `onMouseDown` (it keeps focus off the label); yours run after them. Focus and key events land on the `<input>`.

::example{id=switch-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Switch`, `.rv-SwitchField`, `.rv-SwitchButton` | the parts (unless you pass `class`) |
| `[data-selected]` | on |
| `[data-pressed]`, `[data-hovered]`, `[data-focus-visible]` | interaction |
| `[data-disabled]`, `[data-readonly]`, `[data-invalid]`, `[data-required]` | states |

### Tailwind

Put `group` on the label and style the track with `group-data-[selected]:`, `group-data-[pressed]:`, `group-data-[focus-visible]:`; its `after:` pseudo-element is the thumb.

::example{id=switch-tailwind}

### Plain CSS

::example{id=switch-css}

### Starter theme

`@rivetjs/cdk/theme.css` lays `.rv-Switch` out as a flex row with a gap; it does not draw a track.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Switch` (`<label>`), `SwitchField` (`<div>`), `SwitchButton` (`<label>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable. A `render` that ignores `children` drops the hidden input and breaks the control.

```tsx
<Switch render={(props) => <label {...(props as {})} />}>…</Switch>
```

## Accessibility

- A native checkbox with `role="switch"`: announced as a switch, "on" or "off". Keep the track `aria-hidden`.
- Use it for settings that take effect at once; for a choice submitted later, a [Checkbox](checkbox.md) reads better.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Space] | Toggle. |
| :kbd[Tab] | Move focus. |

## Resumability

- The server renders the state and the attributes; no Switch code runs before the first interaction.
- Signals and accessors passed as `isSelected` / `isDisabled` resume with their values; callbacks must be inline arrows or local consts.
- `ToggleStateContext` is resumable: a child reading it keeps the state after resume.

## Hooks

`@rivetjs/cdk/switch/behaviour` ports react-aria `useSwitch`: `switchProps(props, state, inputRef?)` = `toggleProps` (from `@rivetjs/cdk/checkbox/behaviour`) plus `role="switch"`. The state is `createToggleState` from `@rivetjs/cdk/state/toggle`.

::api{symbol="@rivetjs/cdk/switch/behaviour#switchProps"}

## Testing

Click the `<label>` (the input is visually hidden), or focus the input and press :kbd[Space], with `@testing-library/user-event`; `getByRole("switch")` finds the input.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Switch`, `SwitchField`, `SwitchButton`, `SwitchContext`, `SwitchFieldContext`, `ToggleStateContext` | RAC `Switch` |
| `@rivetjs/cdk/switch/behaviour` | react-aria `useSwitch` |
| `@rivetjs/cdk/state/toggle` | react-stately `useToggleState` |

Deviations: `className` is `class`; render props are accessors; `isSelected` also takes a two-way signal or an accessor; `inputRef` is a Rivet `ref()` (or callback).


## Common mistakes

- **Changing the label with the state.** The switch already announces on / off.
- **A switch that needs a submit.** Users expect a switch to apply at once.
- **No `name` in a form.** Without a name nothing is submitted.
