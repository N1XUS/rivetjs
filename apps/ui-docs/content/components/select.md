---
title: Select
description: "Displays a list of options for the user to pick from, triggered by a button."
template: reference
status: experimental
related: [components/list-box, components/label, components/popover]
---

`Select` lets users choose one or more options from a collapsible list. It wraps the [cdk Select](site:cdk/components/select/) in its RAC parts form: `Select.Trigger` is a cdk `Button`, `Select.Value` a cdk `SelectValue`, `Select.Popover` a cdk `Popover`, and the options are a [ListBox](/components/list-box/). A hidden native `<select>` carries the form value, so forms post before JavaScript loads.

Notes:

- `class`, not `className`. `value` and `isOpen` take a signal (two-way) or a value; render props are accessors (`({ isPlaceholder }) => isPlaceholder() ? … : …`); `state.selectedItems` → `selectedKeys(state)` from `@rivetjs/cdk/select`.
- Shorthand (Rivet addition): with `label` or `items`, the root renders Label + Trigger (Value + Indicator) + Popover + ListBox around its children; `Select.Item` = `ListBox.Item` + `ListBox.ItemIndicator` with `textValue` from string children.
- The default indicator is a CSS morph chevron (see [Indicator](#indicator)); the clear button icon is lucide `X`. A custom `Select.Indicator` child renders inside a `span.select__indicator` (no element cloning).
- The Backspace / Delete clear shortcut is on whenever a `Select.ClearButton` renders inside the Select (checked at key time).
- The asynchronous demo uses the cdk `createAsyncList` (react-stately `useAsyncList` port).

Accessibility: button trigger with `aria-haspopup="listbox"`, labelled by the value and the `Label`; ARIA `listbox` in a popover; typeahead and ArrowLeft / ArrowRight on the closed trigger, arrow keys and typeahead in the list; focus returns to the trigger on close.

## Usage

```tsx
import { Select } from "@rivetjs/ui/select";
```

::example{id=select-default}

## Anatomy

```tsx
import { Description } from "@rivetjs/ui/description";
import { Header } from "@rivetjs/ui/header";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Separator } from "@rivetjs/ui/separator";

export default () => (
  <Select>
    <Label />
    <Select.Trigger>
      <Select.Value />
      <Select.ClearButton />
      <Select.Indicator />
    </Select.Trigger>
    <Description />
    <Select.Popover>
      <ListBox>
        <ListBox.Item>
          <Label />
          <Description />
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Section>
          <Header />
          <ListBox.Item>
            <Label />
          </ListBox.Item>
        </ListBox.Section>
      </ListBox>
    </Select.Popover>
  </Select>
);
```

## Examples

### Shorthand

Rivet addition: give the root a `label` (or `items`) and only `Select.Item` children; the trigger, value, indicator, popover and list are rendered for you with the compound form's markup. With `items`, `children` is a render function of one item. `Select.Item` adds the selection indicator and takes its `textValue` from string children. Use the compound parts for a custom trigger, sections or a clear button. Unlike the other shorthand components, children do not switch the shorthand off here: in the shorthand form they are the list content (the items, or the render function of one item), so `label` + children is the normal case and never warns.

`items` selects the shorthand form: compound parts next to `items` win and `items` is ignored, with a development warning. `Select.Item` keeps a `{expr}` child live (the option text follows its signals); `items` is live too (appended / removed items update the open list). The form is decided once, at render: adding or removing `label` / `items` later does not switch it.

::example{id=select-shorthand}

### Variants

The Select component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=select-variants}

### Full Width

::example{id=select-full-width}

### With Description

::example{id=select-with-description}

### Required

::example{id=select-required}

### Disabled

::example{id=select-disabled}

### With Disabled Options

::example{id=select-with-disabled-options}

### Multiple Select

::example{id=select-multiple-select}

### With Sections

::example{id=select-with-sections}

### Controlled

::example{id=select-controlled}

### Controlled Multiple

::example{id=select-controlled-multiple}

### Controlled Open State

::example{id=select-controlled-open-state}

### Asynchronous Loading

::example{id=select-asynchronous-loading}

### Indicator

The default `Select.Indicator` is a morph chevron: two CSS bars drawn like lucide `ChevronDown` that flatten into a line and fold up while the list is open (320 ms, the timing of apple.com's navigation chevron). It is CSS on the `data-open` attribute: no JavaScript, nothing plays on page load, and a toggle halfway reverses from the current shape. Reduced motion swaps it at once.

::example{id=select-indicator}

Style hooks, on the Select or any ancestor (Tailwind: `[--select-indicator-size:20px]`):

| Variable | Default | |
| --- | --- | --- |
| `--select-indicator-size` | `1rem` | Box size; the chevron scales with it |
| `--select-indicator-stroke` | size / 12 | Bar thickness |
| `--select-indicator-duration` | `var(--duration-morph-chevron)` (320 ms) | `0s` turns the morph off |

Theme tokens for every morph chevron: `--duration-morph-chevron`, `--ease-morph-chevron-open`, `--ease-morph-chevron-close`. Children replace the morph (next section); a custom indicator rotates 180° while open, or animate it yourself with `.select__indicator[data-open="true"]`.

### Custom Indicator

::example{id=select-custom-indicator}

### With Clear Button

`Select.Trigger` is a button, so a nested `<button>` cannot be used for clear. Compose `Select.ClearButton` inside the trigger instead — it renders as a non-button control and does not open the menu.

::example{id=select-with-clear-button}

Because ARIA treats the children of a button as presentational, the clear control cannot take focus. It is therefore `aria-hidden` and acts as a pointer affordance only. When a `Select.ClearButton` is composed, the trigger also clears on `Backspace` or `Delete`, which is how keyboard and screen reader users clear the selection. Both paths call `onClear`.

### Custom Value

::example{id=select-custom-value}

### Render Function

::example{id=select-render-function}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=select-on-surface}

## Customization

### Tailwind CSS

::example{id=select-custom-styles}

### Global CSS

To customize the Select component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .select {
    @apply flex flex-col gap-1;
  }

  .select__trigger {
    @apply rounded-lg border border-border bg-surface p-2;
  }

  .select__value {
    @apply text-current;
  }

  .select__indicator {
    @apply text-muted;
  }

  .select__popover {
    @apply rounded-lg border border-border bg-surface p-2;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Select component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/select.css)):

#### Base Classes

- `.select` - Base select container
- `.select__trigger` - The button that triggers the select
- `.select__value` - The displayed value or placeholder
- `.select__clear-button` - The optional clear control inside the trigger
- `.select__indicator` - The dropdown indicator; the default one also has `.morph-chevron` (CSS bars)
- `.select__popover` - The popover container

#### Variant Classes

- `.select--primary` - Primary variant with shadow (default)
- `.select--secondary` - Secondary variant without shadow, suitable for use in surfaces

#### State Classes

- `.select[data-invalid="true"]` - Invalid state
- `.select__trigger[data-focus-visible="true"]` - Focused trigger state
- `.select__trigger[data-disabled="true"]` - Disabled trigger state
- `.select__value[data-placeholder="true"]` - Placeholder state
- `.select__clear-button[data-empty="true"]` - Clear button hidden when no selection
- `.select__indicator[data-open="true"]` - Open indicator state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on trigger
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
- **Disabled**: `:disabled` or `[data-disabled="true"]` on select
- **Open**: `[data-open="true"]` on indicator

## API Reference

### Select

| Prop            | Type                                    | Default            | Description                                              |
| --------------- | --------------------------------------- | ------------------ | -------------------------------------------------------- |
| `placeholder`   | `string`                                | `'Select an item'` | Temporary text that occupies the select when it is empty |
| `selectionMode` | `"single" \| "multiple"`                | `"single"`         | Whether single or multiple selection is enabled          |
| `isOpen`        | `boolean \| Signal<boolean>`            | -                  | Sets the open state of the menu (controlled; a signal is two-way) |
| `defaultOpen`   | `boolean`                               | -                  | Sets the default open state of the menu (uncontrolled)   |
| `onOpenChange`  | `(isOpen: boolean) => void`             | -                  | Handler called when the open state changes               |
| `disabledKeys`  | `Iterable<Key>`                         | -                  | Keys of disabled items                                   |
| `isDisabled`    | `boolean`                               | -                  | Whether the select is disabled                           |
| `value`         | `Key \| Key[] \| null` or a `Signal`     | -                  | Current value (controlled; a signal is two-way)          |
| `defaultValue`  | `Key \| Key[] \| null`                  | -                  | Default value (uncontrolled)                             |
| `onChange`      | `(value: Key \| Key[] \| null) => void` | -                  | Handler called when the value changes                    |
| `onClear`       | `() => void`                            | -                  | Handler called when the selection is cleared             |
| `isRequired`    | `boolean`                               | -                  | Whether user input is required                           |
| `isInvalid`     | `boolean`                               | -                  | Whether the select value is invalid                      |
| `name`          | `string`                                | -                  | The name of the input, used when submitting an HTML form |
| `autoComplete`  | `string`                                | -                  | Describes the type of autocomplete functionality         |
| `fullWidth`     | `boolean`                               | `false`             | Whether the select should take full width of its container |
| `variant`       | `"primary" \| "secondary"`             | `"primary"`         | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `class`     | `string`                                | -                  | Additional CSS classes                                   |
| `children`      | `Content \| RenderFunction`           | -                  | Select content or render function                        |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, SelectRenderProps>` | - | Overrides the default DOM element with a custom render function.|
| `label` | `Content` | - | Shorthand: the Label content; the root renders Trigger + Popover + ListBox around its children |
| `items` | `Iterable<T>` | - | Shorthand: the ListBox items; `children` is then `(item: T) => Content` |

### Select.Item

Rivet addition: `ListBox.Item` props (`id`, `textValue`, `isDisabled`, …) plus the item indicator; `textValue` defaults to string children.

### Select.Trigger

| Prop        | Type                          | Default | Description                        |
| ----------- | ----------------------------- | ------- | ---------------------------------- |
| `class` | `string`                      | -       | Additional CSS classes             |
| `children`  | `Content \| RenderFunction` | -       | Trigger content or render function |

### Select.Value

| Prop        | Type                          | Default | Description                      |
| ----------- | ----------------------------- | ------- | -------------------------------- |
| `class` | `string`                      | -       | Additional CSS classes           |
| `children`  | `Content \| RenderFunction` | -       | Value content or render function |
| `render` | `DOMRenderFunction<keyof JSX.IntrinsicElements, SelectValueRenderProps>` | - | Overrides the default DOM element with a custom render function.|

### Select.Indicator

| Prop        | Type        | Default | Description              |
| ----------- | ----------- | ------- | ------------------------ |
| `class` | `string`    | -       | Additional CSS classes   |
| `children`  | `Content` | -       | Custom indicator content |

### Select.ClearButton

| Prop        | Type                      | Default | Description                                |
| ----------- | ------------------------- | ------- | ------------------------------------------ |
| `class` | `string`                  | -       | Additional CSS classes                     |
| `children`  | `Content`               | -       | Custom content, replacing the default icon |
| `onClick`   | `(e: MouseEvent) => void` | -       | Handler called when the control is clicked |

`Select.ClearButton` renders as a `span` so it can live inside `Select.Trigger` (a button) without nesting buttons. It is visually hidden when the selection is empty.

### Select.Popover

| Prop        | Type                                                                                                                                                                                                                                                                                                                     | Default    | Description                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ |
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `class` | `string`                                                                                                                                                                                                                                                                                                                 | -          | Additional CSS classes                           |
| `children`  | `Content`                                                                                                                                                                                                                                                                                                              | -          | Content children                                 |

### Render Props

When using render functions with Select.Value, these values are provided:

| Prop              | Type          | Description                        |
| ----------------- | ------------- | ---------------------------------- |
| `defaultChildren` | `Content`   | The default rendered value         |
| `isPlaceholder`   | `() => boolean` | Whether the value is a placeholder |
| `state`           | `SelectState` | The state of the select            |
| `selectedItems`   | `() => unknown[]` | The item objects of the selected keys (dynamic `ListBox` `items`; `null` for static items) |
| `selectedText`    | `() => string` | The text of the selected items     |

## Accessibility

The Select component implements the ARIA listbox pattern and provides:

- Full keyboard navigation support
- Screen reader announcements for selection changes
- Proper focus management
- Support for disabled states
- Typeahead search functionality
- HTML form integration

For more information, see the [cdk Select page](site:cdk/components/select/).

## Related Components

- [Listbox](/components/list-box/): Scrollable list of selectable items.
- [Popover](/components/popover/): Displays content in context with a trigger.
- [Label](/components/label/): Accessible label for form controls.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
- [Description](/components/description/): Helper text for form fields.
- [Spinner](/components/spinner/): Loading indicator.
- [Button](/components/button/): Allows a user to perform an action.
- [Separator](/components/separator/): Visual divider between content.
- [Avatar](/components/avatar/): Display user profile images.
- [ComboBox](/components/combo-box/): Text input with searchable dropdown list.
