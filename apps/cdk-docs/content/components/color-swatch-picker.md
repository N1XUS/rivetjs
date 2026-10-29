---
title: ColorSwatchPicker
description: ColorSwatchPicker from @rivetjs/cdk lists color swatches as a listbox; click or arrow keys and Enter select a color.
template: guide
status: experimental
related: [components/color-swatch, components/color-picker, components/listbox]
---

`ColorSwatchPicker` is a single-select [ListBox](listbox.md) of `ColorSwatchPickerItem`s, each holding a `ColorSwatch`. The selected item is the one whose color equals the value; a value no item matches selects nothing.

::example{id=color-swatch-picker-basic}

## Anatomy

```html
<div role="listbox" class="rv-ColorSwatchPicker" aria-label="Color swatches" data-layout="grid">
  <div role="option" class="rv-ColorSwatchPickerItem" data-key="#3B82F6FF" aria-selected="true" data-selected>
    <div role="img" class="rv-ColorSwatch" aria-label="…"></div>
  </div>
</div>
```

## Import

```ts
import { ColorSwatchPicker, ColorSwatchPickerItem } from "@rivetjs/cdk/color-swatch-picker";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
```

## Props

### ColorSwatchPicker

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string \| Color \| Signal \| accessor` | | |
| `defaultValue` | `string \| Color` | `"#000000"` | |
| `layout` | `"grid" \| "stack"` | `"grid"` | Arrow-key layout, `[data-layout]`. |
| `aria-label` | `string` | `"Color swatches"` (localized) | Not set when `aria-labelledby` is given. |
| `aria-labelledby`, `aria-describedby`, `aria-details`, `id`, `slot` | `string` | | |
| `class` | `string \| (rp) => string` | `rv-ColorSwatchPicker` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ColorSwatchPicker`; see [Render](#render). |
| `style`, `children`, `ref`, global DOM props | | | |

Event: `onChange(color: Color)`. Render props: ListBox's (`isEmpty()`, `isFocused()`, `isFocusVisible()`, `layout`, `orientation`, `state`).

### ColorSwatchPickerItem

| Prop | Type | Notes |
| --- | --- | --- |
| `color` | `string \| Color` | required; key = `toString("hexa")` |
| `isDisabled` | `boolean` | |
| `class` | `string \| (rp) => string` | default `rv-ColorSwatchPickerItem` |
| `style`, `children` | value or `(rp) => …` | render props add `color()` |
| hover / press events, global DOM props | | |

Item render props: `color()`, `isSelected()` `[data-selected]`, `isFocused()`, `isFocusVisible()` `[data-focus-visible]`, `isHovered()`, `isPressed()`, `isDisabled()` `[data-disabled]`.

## Layout, events, render props, plain CSS

::example{id=color-swatch-picker-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ColorSwatchPicker` (`<div>`), `ColorSwatchPickerItem` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ColorSwatchPicker render={(props) => <div {...(props as {})} />}>…</ColorSwatchPicker>
```

## Accessibility

- `role="listbox"` + `role="option"` (`aria-selected`); typeahead uses the color name.

| Key | |
| --- | --- |
| arrows | move focus (grid: 2D) |
| :kbd[Enter] / :kbd[Space] | select |
| :kbd[Home] / :kbd[End] | first / last |

## Resumability

- The selection is derived from the color value (no copy), so it stays in sync with a ColorPicker or a Signal on a resumed page.
- Item colors are kept as strings (the picker keeps each item's color space when selecting).

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ColorSwatchPicker`, `ColorSwatchPickerItem`, `ColorSwatchPickerContext` | RAC `ColorSwatchPicker`, `ColorSwatchPickerItem` |

## Not yet supported

- Drag and drop.
