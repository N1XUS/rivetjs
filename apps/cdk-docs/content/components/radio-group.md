---
title: RadioGroup
description: RadioGroup from @rivetjs/cdk is a radiogroup of native radios sharing one name; arrow keys, the tab stop and form submission are the browser's.
template: guide
status: experimental
related: [components/checkbox-group, components/checkbox, components/form, components/field]
---

`RadioGroup` renders a `<div role="radiogroup">` with a label and one native radio per item. The radios share a `name`, so the browser handles arrow keys, the single tab stop and form submission without JavaScript. The selected value is a `Signal<string | null>` (`value`) or an internal one (`defaultValue`).

::example{id=radio-group-controlled}

## Anatomy

```html
<div id="size" role="radiogroup" class="rv-RadioGroup" aria-labelledby="size-label"
     aria-orientation="vertical" data-orientation="vertical">
  <span id="size-label" class="rv-Label" data-slot="label">Size</span>
  <label class="rv-Radio" data-selected="true">
    <input type="radio" id="size-s" name="size" value="s" checked />Small
  </label>
  <label class="rv-Radio">
    <input type="radio" id="size-l" name="size" value="l" aria-describedby="size-l-description" />Large
    <span id="size-l-description" class="rv-Text" data-slot="description">Costs more.</span>
  </label>
  <span id="size-description" class="rv-Text" data-slot="description">Pick one.</span>
  <!-- FieldError, only while invalid: -->
  <span id="size-error" slot="errorMessage" class="rv-FieldError">Choose a size.</span>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| Group | `div[role=radiogroup]` | `rv-RadioGroup` | Id `id` (generated). |
| Label | `span[data-slot=label]` | `rv-Label` | Referenced by `aria-labelledby`; id `<id>-label`. |
| Radio | `label` + `input[type=radio]` | `rv-Radio` (`itemClass`), input `inputClass` | One per item; the input id is the item `id` or generated. |
| Radio description | `span[data-slot=description]` | `rv-Text` | With an item `description`; id `<inputId>-description`. |
| Description | `span[data-slot=description]` | `rv-Text` | Id `<id>-description`. |
| Error message | `span[slot=errorMessage]` | `rv-FieldError` (`errorClass`) | The [FieldError](form.md#fielderror-props) part from `@rivetjs/cdk/form`, rendered by the group: nothing while valid; id `<id>-error`. |

| Attribute | Where | Value |
| --- | --- | --- |
| `aria-orientation`, `data-orientation` | group | `vertical` (default) / `horizontal` |
| `aria-disabled` / `data-disabled`, `aria-readonly` / `data-readonly`, `aria-required` / `data-required`, `aria-invalid` / `data-invalid` | group | the matching state |
| `data-selected`, `data-disabled` | radio label | checked; disabled |
| `name` | every input | `name`, or a generated one (the radios need a shared name to be a group) |
| `required` | every input | native validation with `isRequired` |

## Import

```ts
import { RadioGroup, type RadioItem } from "@rivetjs/cdk/radio-group";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `RadioItem[]` | required | `{ value, label?, description?, id?, isDisabled? }` plus focus / key events and global DOM props. |
| `label` | content | none | Visible label; otherwise `aria-label` / `aria-labelledby`. |
| `value` | `Signal<string \| null>` | none | Two-way selected value (controlled). |
| `defaultValue` | `string \| null` | `null` | Uncontrolled start; restored by a form reset. |
| `name`, `form` | `string` | generated, none | The shared radio name. |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | |
| `isInvalid` | `boolean \| () => boolean` | none | |
| `validate` | `(value: string \| null) => string \| string[] \| true \| null \| undefined` | none | |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or the [Form](form.md)'s) | |
| `description` | content | none | |
| `errorMessage` | content, or `(validation) => content` | the validation errors | |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | `aria-orientation` and `data-orientation`; layout is yours. |
| `id` | `string` | generated | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | |
| `class`, `itemClass`, `inputClass`, `labelClass`, `descriptionClass`, `errorClass` | `string` | `rv-RadioGroup`, `rv-Radio`, none, `rv-Label`, `rv-Text`, `rv-FieldError` | |
| `children` | `(item: () => RadioItem) => content` | the item label | Content of each radio. |
| global DOM props | `GlobalDOMAttributes` | none | On the group `div`. |

### Events

| Event | Fires |
| --- | --- |
| `onChange(value)` | The selection changed through a radio. |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocusWithin)` | Focus entered / left the group (not moves inside it). |
| item `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp` | On that radio's input. |

## Controlled and uncontrolled

`value` holds the selected value, or `null` for none. Write it to select from code. `defaultValue` starts an internal signal.

## Orientation

Arrow keys are native: both axes move the selection whatever the orientation. `orientation` sets `aria-orientation` and `data-orientation` for assistive technology and your CSS.

::example{id=radio-group-orientation}

## Disabled, read-only and per-radio state

An item's `isDisabled` disables one radio (arrow keys skip it); the group's disables all. Read-only keeps the radios focusable but the selection fixed.

::example{id=radio-group-states}

## Validation

`isRequired` with native validation renders `required` on every radio: the browser blocks a submit with nothing selected and shows the error. `validate` receives the value; server errors come from the [Form](form.md) by `name`.

:::note
The error message is the `FieldError` part of `@rivetjs/cdk/form` (formerly part of `@rivetjs/cdk/label`). RadioGroup renders it itself, inside its own `FieldErrorContext`: `errorMessage` becomes its children (a function receives the `ValidationResult`) and `errorClass` its class. It renders nothing while the group is valid (no `hidden` placeholder).
:::

:::warning
Known issue: the group's `FieldError` currently renders nothing even while the group is invalid (server and resumed page); `aria-invalid`, `data-invalid` and the radios' `data-rv-error` are correct, and `aria-describedby` points at the missing `<id>-error`.
:::

::example{id=radio-group-validation}

## Radio content and descriptions

`children` renders each radio's content from its item accessor; an item `description` renders inside its label and is linked with `aria-describedby`.

::example{id=radio-group-slots}

## Events

::example{id=radio-group-events}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) set on `RadioGroup` land on the group `div`; set on an item they land on that radio's `<label>`. The group's focus events use `focusin` / `focusout` on the group, so `onFocusChange` fires once when focus enters or leaves.

::example{id=radio-group-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-RadioGroup` | group; `[data-orientation]`, `[data-disabled]`, `[data-invalid]`, `[data-readonly]`, `[data-required]` |
| `.rv-Radio[data-selected]`, `input:checked` | selected radio |
| `.rv-Radio[data-disabled]` | disabled radio |
| `.rv-Radio:has(input:focus-visible)` | keyboard focus |
| `.rv-Text`, `.rv-FieldError` | help and error text |

### Tailwind

`@rivetjs/cdk/tailwind.css` adds `orientation-horizontal:` / `orientation-vertical:` for the layout; `peer-checked:` styles a drawn dot.

::example{id=radio-group-tailwind}

### Plain CSS

::example{id=radio-group-css}

### Starter theme

`@rivetjs/cdk/theme.css` makes a horizontal `.rv-RadioGroup` a flex row with a gap and lays each `.rv-Radio` out as a row.

## Animated selection indicator

A `<SelectionIndicator />` (`@rivetjs/cdk/selection-indicator`) in the radio content renders in the checked radio only and moves between radios, animating the properties in its `transition-property` (as in [Tabs](tabs.md#animated-selection-indicator)). The group is the `SharedElementTransition` scope.

```tsx
<RadioGroup items={sizes}>{(item) => <>{item().label}<SelectionIndicator /></>}</RadioGroup>
```

## Accessibility

- `role="radiogroup"` named by its label; native radios inside their labels.
- One tab stop: Tab reaches the selected radio, or the first when none is selected.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Tab] | Into / out of the group. |
| :kbd[ArrowDown], :kbd[ArrowRight] | Select the next radio (wraps). |
| :kbd[ArrowUp], :kbd[ArrowLeft] | Select the previous radio (wraps). |
| :kbd[Space] | Select the focused radio. |

## Resumability

- The server renders the checked radio; arrow keys and submission work before any code loads.
- Item callbacks must be inline arrows or local functions; `children` is a slot, write it inline.
- **Known issue:** the error message (`FieldError`) does not render while invalid; see [Validation](#validation).

## Testing

`@rivetjs/testing/user` ships the ported `RadioGroupTester`: `user.createTester("RadioGroup", { root, interactionType? })`, then `getRadioGroup()`, `getRadios()`, `getSelectedRadio()`, `findRadio({ indexOrText })` and `triggerRadio({ radio, interactionType? })` (`"keyboard"` moves with arrow keys).

```tsx
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { User } from "@rivetjs/testing/user";
import { RadioGroup } from "@rivetjs/cdk/radio-group";

const size = signal<string | null>(null);
render(() => <RadioGroup id="size" label="Size" items={[{ value: "s", label: "Small" }, { value: "l", label: "Large" }]} value={size} />);
const group = new User({ interactionType: "mouse" }).createTester("RadioGroup", { root: document.getElementById("size")! });
await group.triggerRadio({ radio: "Large" });
expect(size()).toBe("l");
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `RadioGroup` | RAC `RadioGroup` + `Radio` children |
| `@rivetjs/cdk/radio-group/behaviour` | react-aria `useRadioGroup`, `useRadio` |
| `@rivetjs/cdk/state/radio-group` | react-stately `useRadioGroupState` |

Deviations: data-driven `items` with a `children` slot; arrow keys are the browser's (no roving focus manager); native inputs stay visible by default.

## Not yet supported

- `<Radio>` children and render props; `data-hovered`, `data-pressed`, `data-focus-visible`.
- RTL-aware arrow keys beyond what the browser does.

## Common mistakes

- **Two groups with the same `name`.** The browser treats them as one group.
- **`display: none` on the input.** It breaks arrow keys; use a visually hidden class.
- **Expecting `orientation` to restrict arrow keys.** Native radios move on both axes.
