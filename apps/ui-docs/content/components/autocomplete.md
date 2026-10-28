---
title: Autocomplete
description: "An autocomplete combines a select with filtering, allowing users to search and select from a list of options."
template: reference
status: experimental
related: [components/select, components/search-field, components/list-box]
---

`Autocomplete` is a select whose popover holds a search field that filters the options. It is built on the [cdk Select](site:cdk/components/select/) parts and the [cdk Autocomplete](site:cdk/components/autocomplete/): `Autocomplete.Trigger` is a cdk `Group`, `Autocomplete.Value` a cdk `SelectValue`, `Autocomplete.Popover` a cdk `Popover` as wide as the trigger, `Autocomplete.Filter` the cdk `Autocomplete`, and the content is a [SearchField](/components/search-field/) plus a [ListBox](/components/list-box/).

Notes:

- `class`, not `className`. `value` / `isOpen` / `inputValue` take a signal (two-way) or a value; render props are accessors (`({ isPlaceholder, state }) => isPlaceholder() ? … : …`), and the selected keys come from `selectedKeys(state)` (`@rivetjs/cdk/select`).
- `useFilter` is the cdk `createFilter` (`@rivetjs/cdk/i18n/filter`), created once at module level; pass the filter as an inline arrow (`filter={(text, input) => contains(text, input)}`) so it resumes.
- The default indicator is a CSS morph chevron (see [Indicator](#indicator)); the clear icon is lucide `X`.
- The asynchronous demo uses the cdk `createAsyncList` (react-stately `useAsyncList` port). The virtualization demo wraps the popover's `ListBox` in the cdk `CollectionVirtualizer` (`ListLayout`, as [ListBox](/components/list-box/#virtualization)): only the visible options render, and filtering re-windows the list.

## Usage

```tsx
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
```

::example{id=autocomplete-default}

## Anatomy

```tsx
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";

export default () => (
  <Autocomplete>
    <Label />
    <Autocomplete.Trigger>
      <Autocomplete.Value />
      <Autocomplete.ClearButton />
      <Autocomplete.Indicator />
    </Autocomplete.Trigger>
    <Description />
    <Autocomplete.Popover>
      <Autocomplete.Filter>
        <SearchField>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input />
          </SearchField.Group>
        </SearchField>
        <ListBox>
          <ListBox.Item>
            <Label />
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Autocomplete.Filter>
    </Autocomplete.Popover>
  </Autocomplete>
);
```

Additional exported parts: `Autocomplete.Root`.

## Examples

### Shorthand

Rivet addition: give the root a `label` (or `items`) and only `Autocomplete.Item` children; the Label, the trigger (value + indicator), the popover with a search field and the filtered list are rendered for you with the compound form's markup. The default filter is a case- and accent-insensitive `contains` (`filter` replaces it); `searchLabel` names the search field (default "Search"). With `items`, `children` is a render function of one item. `Autocomplete.Item` adds the selection indicator and takes its `textValue` from string children. Children do not switch the shorthand off: in the shorthand form they are the list content (the items, or the render function of one item), so `label` + children is the normal case and never warns.

`items` selects the shorthand form: compound parts next to `items` win and `items` is ignored, with a development warning. `Autocomplete.Item` keeps a `{expr}` child live (the option text follows its signals); `items` is live too (appended / removed items update the open list). The form is decided once, at render: adding or removing `label` / `items` later does not switch it.

::example{id=autocomplete-shorthand}

### Variants

The Autocomplete component supports two visual variants:

- **`primary`** (default) - Standard styling with shadow, suitable for most use cases
- **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

::example{id=autocomplete-variants}

### Full Width

::example{id=autocomplete-full-width}

### With Description

::example{id=autocomplete-with-description}

### Required

::example{id=autocomplete-required}

### Disabled

::example{id=autocomplete-disabled}

### With Disabled Options

::example{id=autocomplete-with-disabled-options}

### Allows Empty Collection

The `allowsEmptyCollection` prop enables the autocomplete to function even when there are no items in the collection. This is useful for scenarios where the list might be empty initially or when all items are filtered out.

::example{id=autocomplete-allows-empty-collection}

### With Sections

::example{id=autocomplete-with-sections}

### Multiple Select

::example{id=autocomplete-multiple-select}

:::warning
In multiple mode, a bare `<Autocomplete.Value />` renders a copy of each selected item's
`ListBox.Item` children in the trigger, joined with locale-aware separators. Text-only items read
as plain text, but visual content such as checkboxes or avatars appears once per selected item,
and render function children are always called with `isSelected: false`.
:::

To display selected values as plain text, use the `selectedText` render prop, which joins the
`textValue` of each selected item:

```tsx
<Autocomplete.Value>{({ isPlaceholder, defaultChildren, selectedText }) => (isPlaceholder() ? defaultChildren : selectedText())}</Autocomplete.Value>
```

For richer layouts such as removable tags, render your own content from `selectedKeys(state)`
(`@rivetjs/cdk/select`) as shown in the example above.

### Controlled

::example{id=autocomplete-controlled}

### Controlled Multiple

::example{id=autocomplete-controlled-multiple}

### Controlled Open State

::example{id=autocomplete-controlled-open-state}

### Asynchronous Filtering

::example{id=autocomplete-asynchronous-filtering}

### Indicator

The default `Autocomplete.Indicator` is a morph chevron: two CSS bars drawn like lucide `ChevronDown` that flatten into a line and fold up while the list is open (320 ms, the timing of apple.com's navigation chevron). It is CSS on the `data-open` attribute: no JavaScript, nothing plays on page load, and a toggle halfway reverses from the current shape. Reduced motion swaps it at once.

::example{id=autocomplete-indicator}

Style hooks, on the Autocomplete or any ancestor (Tailwind: `[--autocomplete-indicator-size:20px]`):

| Variable                            | Default                                  |                                      |
| ----------------------------------- | ---------------------------------------- | ------------------------------------ |
| `--autocomplete-indicator-size`     | `1rem`                                   | Box size; the chevron scales with it |
| `--autocomplete-indicator-stroke`   | size / 12                                | Bar thickness                        |
| `--autocomplete-indicator-duration` | `var(--duration-morph-chevron)` (320 ms) | `0s` turns the morph off             |

Theme tokens for every morph chevron: `--duration-morph-chevron`, `--ease-morph-chevron-open`, `--ease-morph-chevron-close`. Children replace the morph (next section); a custom indicator rotates 180° while open, or animate it yourself with `.autocomplete__indicator[data-open="true"]`.

### Custom Indicator

::example{id=autocomplete-custom-indicator}

### Custom Value

You can customize the displayed value using render props:

::example{id=autocomplete-custom-value}

### In Surface

When used inside a [Surface](/components/surface/) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

::example{id=autocomplete-on-surface}

### Virtualization

Place `<ListBox virtualized>` inside the popover to window a large collection. `rowHeight` defaults to **36 px**; set it for a different fixed item height. Give the ListBox a height and `min-h-0`, constrain the popover with `max-height` and a flex column, and match `initialSize` to the list viewport. The list owns scrolling and can shrink when the popover has less room.

::example{id=autocomplete-virtualized}

The example has 10,000 items. Arrow keys, Home and End scroll the focused option into view; selecting key `9999` updates the value. Typing filters the full collection and updates the rendered window. The virtualizer loads only for opted-in lists. This follows [React Aria Virtualizer composition](https://react-aria.adobe.com/Virtualizer).

Autocomplete supports virtualization through [Virtualizer](https://react-aria.adobe.com/Virtualizer), enabling efficient rendering of large datasets by displaying only the rows visible within the viewport.

::example{id=autocomplete-virtualization}

### Advanced Examples

#### User Selection

::example{id=autocomplete-user-selection}

#### User Selection Multiple

::example{id=autocomplete-user-selection-multiple}

#### Location Search

::example{id=autocomplete-location-search}

#### Tag Group Selection

::example{id=autocomplete-tag-group-selection}

#### Email Recipients

::example{id=autocomplete-email-recipients}

## Customization

### Tailwind CSS

::example{id=autocomplete-custom-styles}

### Global CSS

To customize the Autocomplete component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .autocomplete {
    @apply flex flex-col gap-1;
  }

  .autocomplete__trigger {
    @apply rounded-lg border border-border bg-surface p-2;
  }

  .autocomplete__value {
    @apply text-current;
  }

  .autocomplete__clear-button {
    @apply text-muted hover:text-foreground;
  }

  .autocomplete__indicator {
    @apply text-muted;
  }

  .autocomplete__popover {
    @apply rounded-lg border border-border bg-surface p-2;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `autocomplete-clear-button`, `autocomplete-trigger`, `autocomplete-value`, `autocomplete-default-indicator`, `autocomplete-popover`, `autocomplete-filter`, `autocomplete-clear-button-icon`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Autocomplete component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/autocomplete.css)):

#### Base Classes

- `.autocomplete` - Base autocomplete container
- `.autocomplete__trigger` - The button that triggers the autocomplete
- `.autocomplete__value` - The displayed value or placeholder
- `.autocomplete__clear-button` - The clear button that removes the selected value
- `.autocomplete__indicator` - The dropdown indicator icon
- `.autocomplete__popover` - The popover container
- `.autocomplete__filter` - The filter wrapper

#### Variant Classes

- `.autocomplete--primary` - Primary variant with shadow (default)
- `.autocomplete--secondary` - Secondary variant without shadow, suitable for use in surfaces

#### State Classes

- `.autocomplete[data-invalid="true"]` - Invalid state
- `.autocomplete__trigger[data-focus-visible="true"]` - Focused trigger state
- `.autocomplete__trigger[data-disabled="true"]` - Disabled trigger state
- `.autocomplete__value[data-placeholder="true"]` - Placeholder state
- `.autocomplete__clear-button[data-empty="true"]` - Clear button hidden when no selection
- `.autocomplete__indicator[data-open="true"]` - Open indicator state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on trigger
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
- **Disabled**: `:disabled` or `[data-disabled="true"]` on autocomplete
- **Open**: `[data-open="true"]` on indicator

## API Reference

See the [full module API](/api/rivetjs/ui/autocomplete/) for every named export and part prop type.

### Autocomplete

| Prop                    | Type                                                 | Default                             | Description                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `placeholder`           | `string`                                             | `'Select an item'`                  | Temporary text that occupies the autocomplete when it is empty                                                                                                     |
| `selectionMode`         | `"single" \| "multiple"`                             | `"single"`                          | Whether single or multiple selection is enabled                                                                                                                    |
| `allowsEmptyCollection` | `boolean`                                            | `false`                             | Whether the autocomplete allows an empty collection. When true, the autocomplete can function even with no items.                                                  |
| `isOpen`                | `boolean \| Signal<boolean>`                         | -                                   | Sets the open state of the popover (controlled; a signal is two-way)                                                                                               |
| `defaultOpen`           | `boolean`                                            | -                                   | Sets the default open state of the popover (uncontrolled)                                                                                                          |
| `onOpenChange`          | `(isOpen: boolean) => void`                          | -                                   | Handler called when the open state changes                                                                                                                         |
| `disabledKeys`          | `Iterable<Key>`                                      | -                                   | Keys of disabled items                                                                                                                                             |
| `isDisabled`            | `boolean`                                            | -                                   | Whether the autocomplete is disabled                                                                                                                               |
| `value`                 | `Key \| Key[] \| null \| Signal`                     | -                                   | Current value (controlled; a signal is two-way)                                                                                                                    |
| `defaultValue`          | `Key \| Key[] \| null`                               | -                                   | Default value (uncontrolled)                                                                                                                                       |
| `onChange`              | `(value: Key \| Key[] \| null) => void`              | -                                   | Handler called when the value changes                                                                                                                              |
| `isRequired`            | `boolean`                                            | -                                   | Whether user input is required                                                                                                                                     |
| `isInvalid`             | `boolean`                                            | -                                   | Whether the autocomplete value is invalid                                                                                                                          |
| `name`                  | `string`                                             | -                                   | The name of the input, used when submitting an HTML form                                                                                                           |
| `fullWidth`             | `boolean`                                            | `false`                             | Whether the autocomplete should take full width of its container                                                                                                   |
| `variant`               | `"primary" \| "secondary"`                           | `"primary"`                         | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `label`                 | `Content`                                            | -                                   | Rivet shorthand: the Label (with `label` or `items` the root renders the parts)                                                                                    |
| `items`                 | `Iterable<T>`                                        | -                                   | Rivet shorthand: the list items; `children` is then a render function of one item                                                                                  |
| `filter`                | `(textValue: string, inputValue: string) => boolean` | contains, case / accent insensitive | Rivet shorthand: the search filter                                                                                                                                 |
| `searchLabel`           | `string`                                             | `"Search"`                          | Rivet shorthand: accessible name of the search field                                                                                                               |
| `class`                 | `string`                                             | -                                   | Additional CSS classes                                                                                                                                             |
| `children`              | `Content \| RenderFunction`                          | -                                   | Autocomplete content or render function                                                                                                                            |

### Autocomplete.Item

Rivet addition: `ListBox.Item` props (`id`, `textValue`, `isDisabled`, …) plus the item indicator; `textValue` defaults to string children.

### Autocomplete.Trigger

| Prop       | Type                        | Default | Description                        |
| ---------- | --------------------------- | ------- | ---------------------------------- |
| `class`    | `string`                    | -       | Additional CSS classes             |
| `children` | `Content \| RenderFunction` | -       | Trigger content or render function |

### Autocomplete.Value

| Prop       | Type                        | Default | Description                      |
| ---------- | --------------------------- | ------- | -------------------------------- |
| `class`    | `string`                    | -       | Additional CSS classes           |
| `children` | `Content \| RenderFunction` | -       | Value content or render function |

### Autocomplete.Indicator

| Prop       | Type      | Default | Description              |
| ---------- | --------- | ------- | ------------------------ |
| `class`    | `string`  | -       | Additional CSS classes   |
| `children` | `Content` | -       | Custom indicator content |

### Autocomplete.ClearButton

| Prop      | Type                                     | Default | Description                           |
| --------- | ---------------------------------------- | ------- | ------------------------------------- |
| `class`   | `string`                                 | -       | Additional CSS classes                |
| `onClick` | `(e: MouseEvent) => void`                | -       | Handler called when button is clicked |
| `ref`     | `JSX.IntrinsicElements["button"]["ref"]` | -       | Ref to the clear button element       |

### Autocomplete.Popover

| Prop        | Type                                                                                                                                                                                                                                                                                                                     | Default    | Description                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ |
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `class`     | `string`                                                                                                                                                                                                                                                                                                                 | -          | Additional CSS classes                           |
| `children`  | `Content`                                                                                                                                                                                                                                                                                                                | -          | Content children                                 |

### Autocomplete.Filter

| Prop            | Type                                       | Default | Description                              |
| --------------- | ------------------------------------------ | ------- | ---------------------------------------- |
| `filter`        | `(text: string, input: string) => boolean` | -       | Custom filter function                   |
| `inputValue`    | `string`                                   | -       | Controlled input value                   |
| `onInputChange` | `(value: string) => void`                  | -       | Handler called when input value changes  |
| `children`      | `Content`                                  | -       | Filter content (SearchField and ListBox) |

### useFilter Hook

React Aria's `useFilter` is the cdk `createFilter(options, locale?)` (`@rivetjs/cdk/i18n/filter`). Create it once at module level and pass the filter as an inline arrow so the handler resumes.

```tsx
import { createFilter } from "@rivetjs/cdk/i18n/filter";

const { contains } = createFilter({ sensitivity: "base" });

<Autocomplete.Filter filter={(text, input) => contains(text, input)}>
  <SearchField>...</SearchField>
  <ListBox>...</ListBox>
</Autocomplete.Filter>;
```

**Options:**

| Option        | Type                                        | Default  | Description                     |
| ------------- | ------------------------------------------- | -------- | ------------------------------- |
| `sensitivity` | `"base" \| "accent" \| "case" \| "variant"` | `"base"` | Locale sensitivity for matching |

**Returns:**

| Function     | Type                                             | Description                                            |
| ------------ | ------------------------------------------------ | ------------------------------------------------------ |
| `contains`   | `(string: string, substring: string) => boolean` | Returns whether a string contains a given substring    |
| `startsWith` | `(string: string, substring: string) => boolean` | Returns whether a string starts with a given substring |
| `endsWith`   | `(string: string, substring: string) => boolean` | Returns whether a string ends with a given substring   |

### Render Props

When using render functions with Autocomplete.Value, these values are provided:

| Prop              | Type                  | Description                                                                                                                      |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `defaultChildren` | `Content`             | The default rendered value. In multiple mode this is a copy of each selected item's children joined with locale-aware separators |
| `isPlaceholder`   | `() => boolean`       | Whether the value is a placeholder                                                                                               |
| `state`           | `SelectState`         | The state of the autocomplete. Use `selectedKeys(state)` (`@rivetjs/cdk/select`) for the selected keys                           |
| `selectedItems`   | `() => (T \| null)[]` | The values of the currently selected items                                                                                       |
| `selectedText`    | `() => string`        | The `textValue` of the selected items joined with locale-aware separators                                                        |

::api{symbol="@rivetjs/ui/autocomplete#AutocompleteRoot"}

## Accessibility

The Autocomplete component implements the ARIA select pattern with filtering and provides:

- Full keyboard navigation support
- Screen reader announcements for selection changes
- Proper focus management
- Support for disabled states
- Search functionality with filtering
- HTML form integration

For more information, see the [cdk Select page](site:cdk/components/select/).

## Related Components

- [Listbox](/components/list-box/): Scrollable list of selectable items.
- [Popover](/components/popover/): Displays content in context with a trigger.
- [Input](/components/input/): Single-line text input built on React Aria.
- [Label](/components/label/): Accessible label for form controls.
- [FieldError](/components/field-error/): Inline validation messages for form fields.
- [Form](/components/form/): Form validation and submission handling.
- [Surface](/components/surface/): Base container surface.
- [Description](/components/description/): Helper text for form fields.
- [Avatar](/components/avatar/): Display user profile images.
- [Button](/components/button/): Allows a user to perform an action.
