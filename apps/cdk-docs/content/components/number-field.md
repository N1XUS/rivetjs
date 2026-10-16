---
title: NumberField
description: NumberField from @rivetjs/cdk edits a number in a locale-formatted text input with stepper buttons, keyboard and wheel stepping, snapping and validation.
template: guide
status: experimental
related: [components/slider, components/text-field, components/group, components/form, foundations/i18n]
---

`NumberField` lets the user type a number, or step it with the arrow keys, the mouse wheel or the increment and decrement buttons. The value is formatted and parsed in the current locale with `formatOptions` (currency, percent, units, decimals). On commit (blur or Enter) it is clamped to `minValue` / `maxValue` and snapped to `step`. The input is `type="text"` so that symbols such as `$` and `%` can be shown.

::example{id=number-field-basic}

## Anatomy

```html
<div class="rv-NumberField">
  <label id="width-label" for="width" class="rv-Label">Width</label>
  <div role="group" class="rv-Group">
    <button slot="decrement" class="rv-Button" tabindex="-1" aria-label="Decrease" aria-controls="width">…</button>
    <input id="width" type="text" inputmode="numeric" value="1,024" aria-roledescription="Number field" class="rv-Input" />
    <button slot="increment" class="rv-Button" tabindex="-1" aria-label="Increase" aria-controls="width">…</button>
  </div>
  <span slot="description" class="rv-Text">Pixels</span>
</div>
<input type="hidden" name="width" value="1024" /> <!-- only with name -->
```

| Part | |
| --- | --- |
| `NumberField` | root `<div>`; owns the state and provides the parts below |
| `Label` (`@rivetjs/cdk/label`) | labels the input (and the steppers) |
| `Group` (`@rivetjs/cdk/group`) | `role="group"` around the input and buttons; wheel stepping while focus is inside |
| `Input` (`@rivetjs/cdk/input`) | the text input (`id` goes here) |
| `Button slot="increment"` / `slot="decrement"` (`@rivetjs/cdk/button`) | stepper buttons; out of the tab order, disabled at the limits |
| `Text slot="description"`, `FieldError` (`@rivetjs/cdk/text`, `@rivetjs/cdk/form`) | description and error message, linked with `aria-describedby` |

## Import

```ts
import { NumberField } from "@rivetjs/cdk/number-field";
import { Label } from "@rivetjs/cdk/label";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Button } from "@rivetjs/cdk/button";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `number \| null \| Signal<number \| null>` | none | A signal is two-way; a plain value is controlled (only `onChange` fires). `null` = empty. |
| `defaultValue` | `number` | empty | |
| `onChange` | `(value: number) => void` | none | Fires on commit (blur, Enter, step), not on every keystroke. `NaN` when cleared. |
| `minValue` / `maxValue` | `number \| () => number` | none | Values are clamped on commit; the steppers are disabled at the limits. |
| `step` | `number \| () => number` | `1` (`0.01` for percent) | Typed values snap to `minValue + n * step`. |
| `formatOptions` | `Intl.NumberFormatOptions \| () => …` | none | Formats and parses the text in the current locale ([I18nProvider](../foundations/i18n.md)). |
| `commitBehavior` | `"snap" \| "validate"` | `"snap"` | `"validate"` keeps out-of-range or off-step text and reports it as invalid instead of snapping it. |
| `isDisabled` / `isReadOnly` | `boolean \| () => boolean` | `false` | |
| `isRequired`, `isInvalid`, `validate`, `validationBehavior` | | `validationBehavior: "native"` | See [Form](form.md); errors come from `minValue` / `maxValue` / `step`, `isRequired` and `validate`. |
| `isWheelDisabled` | `boolean` | `false` | Turns off wheel stepping. |
| `incrementAriaLabel` / `decrementAriaLabel` | `string` | `"Increase"` / `"Decrease"` (localized) | |
| `name`, `form` | `string` | none | Submits the raw number with a hidden input. |
| `id` | `string` | generated id | Lands on the `<input>`. |
| `autoFocus` | `boolean` | `false` | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details`, `aria-errormessage` | `string` | none | |
| `onFocus`, `onBlur`, `onFocusChange`, `onKeyDown`, `onKeyUp`, `onCopy`, `onCut`, `onPaste`, `onSelect`, `onBeforeInput`, `onInput`, `onComposition*` | handlers | none | Input events (the field's own handler runs first). |
| `slot` | `string` | none | |
| `class` / `style` / `children` | value or `(rp) => value` | `rv-NumberField` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `NumberField`; see [Render](#render). |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the root `<div>`. |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `isReadOnly` | `() => boolean` | `[data-readonly]` |
| `isRequired` | `() => boolean` | `[data-required]` |
| `isInvalid` | `() => boolean` | `[data-invalid]` |
| `state` | `NumberFieldState` | |

## Formatting, step and hidden input

`formatOptions` decides what the user sees and what the parser accepts. Typing characters that are not part of a valid partial number is blocked. On commit the text is parsed, clamped and snapped, then formatted again (`13.26` becomes `13.5 cm` with `step={0.5}`). With `name`, a hidden input submits the plain number.

::example{id=number-field-format}

## DOM events and attributes

Global DOM props land on the root `<div>`. Input event props (`onKeyDown`, `onFocus`, `onPaste`, …) are chained after the field's own handlers on the `<input>`. Set props of the `Group`, `Input` and `Button` parts on those components.

## Styling

| Selector | When |
| --- | --- |
| `.rv-NumberField` | root (unless you pass `class`) |
| `.rv-NumberField[data-disabled]`, `[data-readonly]`, `[data-required]`, `[data-invalid]` | state |
| `.rv-Group[data-focus-within]`, `[data-invalid]`, `[data-disabled]` | the group around input and buttons |
| `.rv-Button[slot=increment]`, `[slot=decrement]`, `[data-disabled]`, `[data-pressed]` | steppers |

### Tailwind

The first two examples on this page use Tailwind utilities; the stepper icons are lucide `Minus` / `Plus`.

### Plain CSS

::example{id=number-field-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `NumberField` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<NumberField render={(props) => <div {...(props as {})} />}>…</NumberField>
```

## Accessibility

- The input has `aria-roledescription="Number field"` (not on iOS, where it would hide the required state), and the `inputmode` follows the format so mobile keyboards show digits.
- :kbd[ArrowUp] / :kbd[ArrowDown] step by `step`; :kbd[PageUp] / :kbd[PageDown] step too; :kbd[Home] / :kbd[End] jump to `minValue` / `maxValue`; :kbd[Enter] commits.
- The value is announced (assertive live region) when it changes while the field is focused.
- The steppers are out of the tab order (`tabindex="-1"`) and labelled "Increase Width" / "Decrease Width". Pressing one keeps focus in the input. Holding one repeats after 400 ms (600 ms for touch).

## Resumability

- The server renders the formatted value, the hidden input and the stepper disabled states. No script runs before the first interaction.
- The handlers load on the first focus, key press, wheel or press. The state is plain data (signals + JSON), so a resumed field continues from the server value.
- Pass a signal as `value` for two-way binding.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `NumberField`, `NumberFieldContext`, `NumberFieldStateContext` | RAC `NumberField` |
| `numberFieldProps` + `numberField*` handlers (`@rivetjs/cdk/number-field/behaviour`) | react-aria `useNumberField` |
| `spinButtonProps` + `spinButton*` handlers (`@rivetjs/cdk/spinbutton/behaviour`) | react-aria `useSpinButton` |
| `createNumberFieldState`, `NumberFormatter`, `NumberParser` (`@rivetjs/cdk/number`) | react-stately `useNumberFieldState`, `@internationalized/number` |

Deviations: `className` is `class`; render props are accessors; `value` takes a two-way signal; hooks are prop factories plus free handler functions.

## Not yet supported

- A stepper button that becomes disabled while it is held keeps spinning until release (Button does not yet cancel a press on disable).
