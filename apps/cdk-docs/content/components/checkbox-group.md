---
title: CheckboxGroup
description: CheckboxGroup from @rivetjs/cdk lets a user select several items from a list of checkboxes; the checked values are one signal, with group validation.
template: guide
status: experimental
related: [components/checkbox, components/radio-group, components/form, components/field]
---

A checkbox group allows a user to select multiple items from a list of options. `CheckboxGroup` renders a `role="group"` labelled by its `Label`; each `CheckboxField` inside adds its `value` to the group's checked values. The values are a plain array, a two-way `Signal<string[]>` (`value`) or internal (`defaultValue`). The group carries the description, the error message and validation for the set ("pick at least one").

::example{id=checkbox-group-controlled}

## Anatomy

```tsx
<CheckboxGroup>
  <Label />
  <CheckboxField value="…">
    <CheckboxButton>Label</CheckboxButton>
  </CheckboxField>
  <Text slot="description" />
  <FieldError />
</CheckboxGroup>
```

```html
<div role="group" id="toppings" class="rv-CheckboxGroup" aria-labelledby="toppings-label"
     aria-describedby="toppings-description">
  <span id="toppings-label" class="rv-Label">Toppings</span>
  <div class="rv-CheckboxField" data-selected="true">
    <label class="rv-CheckboxButton" data-selected="true">
      <span style="position:absolute;width:1px;height:1px;clip-path:inset(50%);…">
        <input type="checkbox" name="toppings" value="cheese" checked aria-describedby="toppings-description" />
      </span>
      Cheese
    </label>
  </div>
  <div class="rv-CheckboxField">…</div>
  <span id="toppings-description" slot="description" class="rv-Text">Pick any.</span>
  <!-- FieldError: only while invalid -->
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `CheckboxGroup` | `div[role=group]` | `rv-CheckboxGroup` | State, validation; provides `CheckboxGroupStateContext`, `LabelContext`, `TextContext`, `FieldErrorContext`. Id `id` (generated). |
| `Label` (`@rivetjs/cdk/label`) | `span` | `rv-Label` | A group is not labelable: a `<span>` referenced by `aria-labelledby`. Id `<id>-label`. |
| `CheckboxField` + `CheckboxButton` | `div` + `label` | `rv-CheckboxField`, `rv-CheckboxButton` | One per option, keyed by `value`; see [Checkbox](checkbox.md). `<Checkbox value>` (deprecated) works too. |
| `Text slot="description"` | `span` | `rv-Text` | On the group's `aria-describedby` and on every input's. Id `<id>-description`. |
| `FieldError` (`@rivetjs/cdk/form`) | `span` | `rv-FieldError` | The group's errors (checkboxes in a group show none of their own); renders only while invalid. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-disabled`, `data-disabled` | group | `isDisabled` |
| `data-readonly`, `data-required`, `data-invalid` | group | the matching state |
| `data-selected`, `data-disabled`, `data-readonly`, `data-invalid`… | each field and button | that checkbox's state (disabled / read-only also from the group) |
| `name` | every input | the group's `name` (unless the checkbox sets one) |
| `required` / `aria-required` | every input | group `isRequired` while nothing is checked (native) / always (aria) |
| `aria-invalid`, `aria-describedby` | every input | invalid; the group's error (while invalid) and description ids |

## Import

```ts
import { CheckboxGroup, CheckboxField, CheckboxButton } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string[] \| Signal<string[]>` | none | Checked values (controlled). A signal is two-way. |
| `defaultValue` | `string[]` | `[]` | Uncontrolled initial values; restored by a form reset. |
| `onChange` | `(value: string[]) => void` | none | The checked values changed through a checkbox. |
| `name`, `form` | `string` | none | Every checkbox submits `name=value` while checked. |
| `isDisabled` | `boolean` | `false` | Disables every checkbox. |
| `isReadOnly` | `boolean` | `false` | Focusable, the values do not change. |
| `isRequired` | `boolean` | `false` | At least one checkbox must be checked. |
| `isInvalid` | `boolean \| () => boolean` | none | Controlled invalid state. |
| `validate` | `(value: string[]) => string \| string[] \| true \| null \| undefined` | none | Custom validation of the set. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the [Form](form.md)'s) | A checkbox's own `validationBehavior` wins for that checkbox. |
| `validationState` | `"valid" \| "invalid"` | none | Deprecated (react-stately): use `isInvalid`. |
| `builtinValidation` | `ValidationResult \| () => ValidationResult` | none | Low-level (react-stately): a native validity result merged into the group's. |
| `id` | `string` | generated | On the group; label and description ids derive from it. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | On the group. Without a `Label`, name it with `aria-label` / `aria-labelledby`. |
| `onFocus`, `onBlur`, `onFocusChange(isFocused)` | handlers | none | Focus entering / leaving the group (focus within). |
| `ref` | `RefValue<HTMLDivElement>` | none | |
| `slot` | `string \| null` | none | Slot name in a parent's `CheckboxGroupContext`. |
| `children` | content or `(renderProps) => content` | none | `Label`, checkboxes, `Text`, `FieldError`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-CheckboxGroup` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `CheckboxGroup`; see [Render](#render). |
| global DOM props | `GlobalDOMAttributes` | none | On the group `div`. |

Each `CheckboxField` in the group takes its own `value` (required in a group), `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `validate`, `onChange(isSelected)`, focus, key and press events (see [Checkbox](checkbox.md#props)); `isSelected` / `defaultSelected` are ignored (the group owns the selection).

### Events

| Event | Fires |
| --- | --- |
| `onChange(value)` | The checked values changed through a checkbox (not when you write `value`). |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocused)` | Focus entered or left the group. |
| checkbox `onChange(isSelected)`, `onFocus`, `onKeyDown`, … | On that checkbox (its input). |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `isReadOnly` | `() => boolean` | `[data-readonly]` |
| `isRequired` | `() => boolean` | `[data-required]` |
| `isInvalid` | `() => boolean` | `[data-invalid]` |
| `state` | `CheckboxGroupState` | |

## Value

Use `value` or `defaultValue` to set the checked values and `onChange` to handle changes. Write a new array to change a signal (`picked.set([...])`): mutating the array notifies nobody.

## Content

The group `Label` takes markup. Each `CheckboxButton` may render its content from its render props, and a `CheckboxField` may hold its own `Text slot="description"` (on that input's `aria-describedby`). The group's `state` render prop reads the checked values (`state.value()`).

::example{id=checkbox-group-slots}

## Disabled and read-only

A checkbox's `isDisabled` disables that one; the group's disables all (`aria-disabled` on the group). `isReadOnly` keeps every checkbox focusable while the values stay.

::example{id=checkbox-group-states}

## Forms and validation

Use `name` to submit the checked values. `isRequired` on the group puts `required` on every enabled checkbox while none is checked, so the browser blocks the submit; checking one clears it on all. `validate` receives the checked values. Server errors come from the [Form](form.md) by `name`. A checkbox in the group may be required on its own (`isRequired` on the `CheckboxField`, RAC "Agree to the following"). The errors render in the group's `FieldError`.

::example{id=checkbox-group-validation}

:::warning
A checkbox's own `isRequired` inside a group currently renders no native `required` (only the group's does), so the browser does not block the submit for it.
:::

## Events

::example{id=checkbox-group-events}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) set on `CheckboxGroup` land on the group `div`; set on a `CheckboxField` they land on its `div`, on a `CheckboxButton` on its `<label>` (which owns the press handlers and `onMouseDown` and calls yours after its own). Checkbox focus and key events land on its input.

::example{id=checkbox-group-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-CheckboxGroup` | the group; `[data-disabled]`, `[data-invalid]`, `[data-required]`, `[data-readonly]` |
| `.rv-CheckboxGroup > .rv-Label` | the group label |
| `.rv-CheckboxButton[data-selected]`, `[data-disabled]`, `[data-focus-visible]` | a checkbox (see [Checkbox](checkbox.md#styling)) |
| `.rv-Text[slot=description]`, `.rv-FieldError` | help and error text |

### Tailwind

::example{id=checkbox-group-tailwind}

### Plain CSS

::example{id=checkbox-group-css}

### Starter theme

`@rivetjs/cdk/theme.css` has no rules for `.rv-CheckboxGroup` or `.rv-CheckboxButton`.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `CheckboxGroup` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<CheckboxGroup render={(props) => <div {...(props as {})} />}>…</CheckboxGroup>
```

## Accessibility

- `role="group"` named by the label; each option is a native checkbox in its own `<label>`.
- The description is on the group's and every input's `aria-describedby`; while invalid, each input also points at the error message.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Tab] | Next checkbox (each is a tab stop). |
| :kbd[Space] | Toggle the focused checkbox. |

## Resumability

- The server renders every checkbox with its checked state; nothing runs before the first interaction.
- The group state (values, validation) is plain data and resumes with the page.

## Hooks

`@rivetjs/cdk/checkbox/behaviour` exposes group and item behavior: `checkboxGroupProps(props, state)` returns `groupProps`, `labelProps`, `descriptionProps`, `errorMessageProps` and accessor flags; `checkboxGroupItemProps(props, state, inputRef?)` returns the checkbox bags of one option. `@rivetjs/cdk/state/checkbox-group` is react-stately `useCheckboxGroupState`: `createCheckboxGroupState(options)`, `isSelected(state, value)`, `setValue`, `addValue`, `removeValue`, `toggleValue`, `isRequiredNow`, `isGroupInvalid`, `setInvalid`.

::api{symbol="@rivetjs/cdk/checkbox/behaviour#checkboxGroupProps"}

## Testing

`@rivetjs/testing/user` ships the ported `CheckboxGroupTester`: `user.createTester("CheckboxGroup", { root, interactionType? })`, then `getCheckboxGroup()`, `getCheckboxes()`, `getSelectedCheckboxes()`, `findCheckbox({ indexOrText })` and `toggleCheckbox({ checkbox, interactionType? })`.

```tsx
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";

const picked = signal<string[]>([]);
render(() => (
  <CheckboxGroup id="pets" value={picked}>
    <Label>Pets</Label>
    <CheckboxField value="dog"><CheckboxButton>Dog</CheckboxButton></CheckboxField>
    <CheckboxField value="cat"><CheckboxButton>Cat</CheckboxButton></CheckboxField>
  </CheckboxGroup>
));
const group = new User({ interactionType: "mouse" }).createTester("CheckboxGroup", { root: document.getElementById("pets")! });
await group.toggleCheckbox({ checkbox: "Cat" });
expect(picked()).toEqual(["cat"]);
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `CheckboxGroup`, `CheckboxGroupContext`, `CheckboxGroupStateContext` | RAC `CheckboxGroup` |
| `@rivetjs/cdk/checkbox/behaviour` | react-aria `useCheckboxGroup`, `useCheckboxGroupItem` |
| `@rivetjs/cdk/state/checkbox-group` | react-stately `useCheckboxGroupState` |
| `CheckboxGroupTester` (`@rivetjs/testing/user`) | `@react-aria/test-utils` |

Deviations: `className` is `class`; render props are accessors; `value` also takes a two-way signal; native group validation is applied to every checkbox of the group at once.


## Common mistakes

- **Mutating the array.** `picked().push("x")` notifies nobody; set a new array.
- **Duplicate values.** Checkboxes are keyed by `value`.
- **No name.** Without `name` the checkboxes submit nothing.
