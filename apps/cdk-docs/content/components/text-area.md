---
title: TextArea
description: TextArea from @rivetjs/cdk is the multi-line part of a TextField (native textarea with state attributes), plus the Angular CDK textarea autosize.
template: guide
status: experimental
related: [components/text-field, components/form, components/field]
---

`TextArea` is the RAC part that renders a native `<textarea>`. Inside a [TextField](text-field.md) it replaces `Input`: the field provides the label link, value, validation and `aria-describedby`, and the textarea adds `rows`, `cols`, `wrap` and its own hover / focus state. Angular CDK's textarea autosize grows it with its content.

::example{id=text-area-controlled}

## Anatomy

```html
<div class="rv-TextField">
  <label id="note-label" for="note" class="rv-Label">Note</label>
  <textarea id="note" class="rv-TextArea" rows="3" aria-labelledby="note-label" aria-describedby="note-description"></textarea>
  <span id="note-description" slot="description" class="rv-Text">Markdown works.</span>
  <!-- FieldError: only while invalid -->
</div>
```

```tsx
<TextField>
  <Label />
  <TextArea />
  <Text slot="description" />
  <FieldError />
</TextField>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `TextField` | `div` | `rv-TextField` | Value, validation, root state attributes ([TextField anatomy](text-field.md#anatomy)). |
| `TextArea` (`@rivetjs/cdk/text-area`) | `textarea` | `rv-TextArea` | Id = the field `id`; `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-invalid`. |
| `Label`, `Text slot="description"`, `FieldError` | | | As in TextField. |

## Import

```ts
import { TextField } from "@rivetjs/cdk/text-field";
import { TextArea } from "@rivetjs/cdk/text-area";
import { Label } from "@rivetjs/cdk/label";
```

`TextArea` is its own module (`@rivetjs/cdk/text-area`); `@rivetjs/cdk/text-field` no longer exports it.

## Props

Field props (value, validation, `name`, `maxLength`, …) are the [TextField props](text-field.md#props); `type` and `pattern` are not passed to a textarea. `TextArea` props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `rows`, `cols` | `number` | browser | Visible size. |
| `wrap` | `"soft" \| "hard" \| "off"` | `"soft"` | `hard` submits the visual line breaks. |
| other textarea attributes | `HTMLProps<"textarea">` | none | `placeholder`, `dirName`, …; values may be accessors. |
| `autoFocus` | `boolean` | `false` | |
| `class` | `string \| (rp) => string` | `rv-TextArea` | A value replaces the default class. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<textarea>` of `TextArea`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `slot` | `string \| null` | none | `null` opts out of the field's `TextAreaContext`. |
| `ref` | `RefValue<HTMLTextAreaElement>` | none | |
| `onHoverStart`, `onHoverEnd`, `onHoverChange` | handlers | none | |

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `isHovered` | `() => boolean` | `[data-hovered]` |
| `isFocused` | `() => boolean` | `[data-focused]` |
| `isFocusVisible` | `() => boolean` | `[data-focus-visible]` |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `isInvalid` | `() => boolean` | `[data-invalid]` |

Hover is not turned off by `disabled` (as RAC).

### Events

The TextField's: `onChange(value)` on every input, `onFocus` / `onBlur` / `onFocusChange`, `onKeyDown` / `onKeyUp`, and the native text input events on the textarea.

## Autosize

`@rivetjs/cdk/text-field` (also `@rivetjs/cdk/text-field/autosize`) exports the Angular CDK text-field utilities:

- **CSS** (no JavaScript): `autosizeProps({ native: true })` returns `{ class: "cdk-textarea-autosize cdk-textarea-autosize-native", rows: 1 }`; import `@rivetjs/cdk/text-field.css`. It uses `field-sizing: content` clamped between `--cdk-autosize-min-rows` and `--cdk-autosize-max-rows`. With `minRows` / `maxRows` it also returns a `style` object of those variables (`{ "--cdk-autosize-min-rows": 2 }`), so the result spreads onto the `TextArea` part or a plain `<textarea>`.
- **Script**: `autosizeTextarea(textarea, { minRows, maxRows, enabled, placeholder })` attaches the ported `CdkTextareaAutosize` (measures on input and resize) and returns its controller (`setMinRows`, `setMaxRows`, `setEnabled`, `resizeToFitContent(force)`, `reset()`, `destroy()`); `textareaAutosize(textarea)` returns the attached one. `autosizeProps()` without `native` gives `class="cdk-textarea-autosize"` + `rows=1`.
- **Autofill**: `onAutofill(input, fn)` (`cdkAutofill`) and `autofillMonitor()` / `createAutofillMonitor()` (`AutofillMonitor`).

::example{id=text-area-autosize}

## Validation

The same as TextField: `isRequired`, `minLength` / `maxLength` and `validate`, native or aria, server errors from the [Form](form.md), messages in `FieldError`.

::example{id=text-area-validation}

## Events

::example{id=text-area-events}

## DOM events and attributes

Global DOM events and attributes set on the `TextField` land on its root `<div>`; text input events set on the `TextField` land on the `<textarea>` (the field owns `onInput` and calls yours after it). Textarea attributes go on `TextArea`.

::example{id=text-area-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-TextField` | root; `[data-invalid]`, `[data-disabled]`, `[data-readonly]`, `[data-required]` |
| `.rv-TextArea` | the textarea; `[data-hovered]`, `[data-focused]`, `[data-focus-visible]`, `[data-invalid]`, `[data-disabled]` |

### Tailwind

::example{id=text-area-tailwind}

### Plain CSS

::example{id=text-area-css}

### Starter theme

`@rivetjs/cdk/theme.css` styles `.rv-TextArea` alongside `.rv-Input`, including its border, padding, background and invalid state. `.rv-TextField` supplies the grid layout around the parts. Its `:where()` selectors let your own classes override the starter look.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `TextArea` (`<textarea>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<TextArea render={(props) => <textarea {...(props as {})} />}>…</TextArea>
```

## Accessibility

- A native textarea labelled by `Label`; description and error via `aria-describedby`.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter] | New line (does not submit). |
| :kbd[Tab] | Leaves the textarea (it does not insert a tab). |

## Resumability

- Typing works before code loads; the field's handlers resume on the first input or focus.
- The CSS autosize needs no code; the script autosize runs once `autosizeTextarea` is called (in a client effect or an event).
- The server writes `value` or `defaultValue` as escaped textarea content, so the initial text is visible before code loads.

## Testing

As [TextField](text-field.md#testing), with `getByRole("textbox")` on the textarea.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `TextArea`, `TextAreaContext` | RAC `TextArea` (used in RAC `TextField`) |
| autosize, autofill | Angular CDK `CdkTextareaAutosize`, `AutofillMonitor`, `CdkAutofill` |

Deviations: `className` is `class`; render props are accessors.

## Common mistakes

- **Importing `TextArea` from `@rivetjs/cdk/text-field`.** It lives in `@rivetjs/cdk/text-area`.
- **Script and CSS autosize together.** Pick one: the CSS path (`cdk-textarea-autosize-native`) needs no `autosizeTextarea` call.
- **`display: none` measurements.** Script autosize measures the textarea; call `resizeToFitContent(true)` once it becomes visible.
