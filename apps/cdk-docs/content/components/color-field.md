---
title: ColorField
description: ColorField from @rivetjs/cdk edits a color as hex text, or one channel as a number field, with validation, keyboard increments and form support.
template: guide
status: experimental
related: [components/color-picker, components/number-field, components/text-field, components/form]
---

`ColorField` edits a color as text. Without `channel` it is a hex field (Enter or blur commits; arrows / wheel increment the hex value). With `channel` it is a localized number field over one channel (e.g. hue in degrees), with a hidden input carrying the number.

::example{id=color-field-basic}

## Anatomy

```html
<div class="rv-ColorField" data-channel="hex">
  <label class="rv-Label" for="…">Hex</label>
  <input class="rv-Input" role="textbox" value="#3366CC" />
  <span slot="description">…</span>
  <span class="rv-FieldError">…</span>
</div>
```

Parts: `Label`, `Input` (`@rivetjs/cdk/input`), `Text slot="description"`, `FieldError` (`@rivetjs/cdk/form`).

## Import

```ts
import { ColorField } from "@rivetjs/cdk/color-field";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string \| Color \| null \| Signal \| accessor` | none | |
| `defaultValue` | `string \| Color \| null` | | |
| `channel` | `ColorChannel` | none (hex) | Channel field. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | | Channel field: the space of `channel`. |
| `isDisabled`, `isReadOnly`, `isRequired` | `boolean` | `false` | |
| `isInvalid` | `boolean \| accessor` | | |
| `validate` | `(color: Color \| null) => string \| string[] \| true \| null \| undefined` | | |
| `validationBehavior` | `"native" \| "aria"` | `"native"` (or Form's) | |
| `isWheelDisabled` | `boolean` | `false` | Wheel increments while focused. |
| `name`, `form` | `string` | | |
| `placeholder`, `autoFocus` | | | Via the field. |
| `id`, `slot`, `aria-*` | `string` | | |
| `class` | `string \| (rp) => string` | `rv-ColorField` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorField`; see [Render](#render). |
| `style`, `children`, `ref`, global DOM props | | | |

### Events

| Event | Type |
| --- | --- |
| `onChange` | `(color: Color \| null) => void` |
| `onFocus`, `onBlur` | `(e: FocusEvent) => void` |
| `onFocusChange` | `(isFocused: boolean) => void` |
| `onKeyDown`, `onKeyUp` | `(e: KeyboardEvent) => void` |
| `onInput`, `onBeforeInput`, `onPaste`, `onCopy`, `onCut`, `onSelect`, `onComposition*` | DOM events on the input |

### Render props

`isDisabled()` `[data-disabled]`, `isInvalid()` `[data-invalid]`, `isReadOnly()` `[data-readonly]`, `isRequired()` `[data-required]`, `channel` `[data-channel]`, `state`.

## Events, states, render props

::example{id=color-field-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-ColorField` | root |
| `[data-channel="hex" \| "<channel>"]` | always |
| `[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]` | states |
| `.rv-Input[data-focused]`, `[data-invalid]` | input |

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorField` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ColorField render={(props) => <div {...(props as {})} />}>…</ColorField>
```

## Accessibility

| Key | |
| --- | --- |
| :kbd[Enter] | commit the typed value |
| :kbd[ArrowUp] / :kbd[ArrowDown] | increment / decrement (hex: by 1; channel: by the channel step) |
| :kbd[PageUp] / :kbd[PageDown] | channel field: page step |
| :kbd[Home] / :kbd[End] | min / max |

- The `<Label>` labels the input; a channel field without a label uses the channel name as `aria-label`.

## Resumability

- Typing, commit and increments work on a resumed page; values stay plain strings in signals.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorField`, `ColorFieldContext`, `ColorFieldStateContext` | RAC `ColorField` |
| `colorFieldProps` + `colorField*` handlers | react-aria `useColorField` |
| `colorChannelFieldProps` | react-aria `useColorChannelField` |
| `createColorFieldState`, `createColorChannelFieldState` | react-stately `useColorFieldState`, `useColorChannelFieldState` |

