---
title: Toolbar
description: "A container for interactive controls with arrow key navigation."
template: reference
status: experimental
related: [components/button-group, components/toggle-button-group, components/separator]
---

`Toolbar` groups interactive controls with arrow-key navigation between them. It is the [cdk Toolbar](site:cdk/components/toolbar/) and passes its orientation down: nested `ToggleButtonGroup`s take it, and a `Separator` inside runs perpendicular.

Notes:

- `class`, not `className`; render props are accessors (`orientation()`).
- `orientation` is read once (it picks the ARIA attributes and arrow keys); `isAttached` and `class` update live.

Accessibility: `role="toolbar"` with `aria-orientation`; Tab enters the toolbar once and the arrow keys move between its controls.

## Usage

```tsx
import { Toolbar } from "@rivetjs/ui/toolbar";
```

::example{id=toolbar-basic}

## Examples

### Vertical

::example{id=toolbar-vertical}

### Attached

::example{id=toolbar-attached}

### With ButtonGroup

::example{id=toolbar-with-button-group}

## Customization

### Tailwind CSS

::example{id=toolbar-custom-styles}

### Global CSS

To customize the Toolbar component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .toolbar {
    @apply gap-4 rounded-lg bg-surface p-3;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Toolbar component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/toolbar.css)):

- `.toolbar` - Base container
- `.toolbar--horizontal` - Horizontal orientation (default)
- `.toolbar--vertical` - Vertical orientation
- `.toolbar--attached` - Attached variant with surface background and full rounding

## API Reference

### Toolbar

Inherits from [cdk Toolbar](site:cdk/components/toolbar/).

| Prop              | Type                                                 | Default        | Description                                                     |
| ----------------- | ---------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `isAttached`      | `boolean`                                            | `false`        | Whether the toolbar has a surface background with full rounding |
| `orientation`     | `"horizontal" \| "vertical"`                         | `"horizontal"` | The orientation of the toolbar                                  |
| `aria-label`      | `string`                                             | -              | An accessible label for the toolbar                             |
| `aria-labelledby` | `string`                                             | -              | The id of an element that labels the toolbar                    |
| `children`        | `Content \| (values: ToolbarRenderProps) => Content` | -              | Content or render prop                                          |
| `class`           | `string \| (values: ToolbarRenderProps) => string`   | -              | Additional CSS classes                                          |

### Render Props

When using the render prop pattern, these values are provided:

| Prop          | Type                         | Description                            |
| ------------- | ---------------------------- | -------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | The current orientation of the toolbar |

::api{symbol="@rivetjs/ui/toolbar#ToolbarRootProps"}

## Related Components

- [ButtonGroup](/components/button-group/): Group related buttons together.
- [ToggleButtonGroup](/components/toggle-button-group/): Group multiple toggle buttons into a unified control.
- [Separator](/components/separator/): Visual divider between content.
- [Button](/components/button/): Allows a user to perform an action.
