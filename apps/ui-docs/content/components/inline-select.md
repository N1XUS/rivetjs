---
title: InlineSelect
description: "A minimal dropdown that flows with the surrounding text: team switchers, sentence pickers and breadcrumb item switchers."
template: reference
status: experimental
related: [components/select, components/cell-select, components/breadcrumbs]
---

`InlineSelect` is a select without the form field around it: a ghost trigger that keeps the font of the text around it, a truncated value and up / down chevrons. Use it for contextual choices such as a workspace switcher, a sort order inside a sentence or the project in a breadcrumb trail. It is built on the [cdk Select](site:cdk/components/select/) parts, so single and multiple selection, `value` / `defaultValue`, `onChange`, `disabledKeys`, `name`, keyboard and typeahead work as in [Select](/components/select/); the options are a [ListBox](/components/list-box/).

Accessibility: the trigger is a button with `aria-haspopup="listbox"`, named by its value. Give the root an `aria-label` (there is no visible label), or put a [Label](/components/label/) inside the root. The root is a `span`, so an InlineSelect is valid inside a paragraph.

## Usage

```tsx
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";
```

::example{id=inline-select-team-switcher}

## Anatomy

```tsx
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export default function SortOrder() {
  return (
    <InlineSelect defaultValue="recent" aria-label="Sort by">
      <InlineSelect.Trigger>
        <InlineSelect.Value />
        <InlineSelect.Indicator />
      </InlineSelect.Trigger>
      <InlineSelect.Popover>
        <ListBox>
          <ListBox.Item id="recent" textValue="Most recent">
            Most recent
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="name" textValue="Name">
            Name
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </InlineSelect.Popover>
    </InlineSelect>
  );
}
```

## Examples

### Shorthand

Give the root `items` and a render function of one item returning `InlineSelect.Item`: the trigger (Value + Indicator), the popover and the list are rendered for you with the compound form's markup. `InlineSelect.Item` adds the selection indicator and takes its `textValue` from string children. Use the parts for a custom trigger (avatar, team switcher) or static options.

`items` selects the shorthand form: compound parts next to `items` win and `items` is ignored, with a development warning. `InlineSelect.Item` keeps a `{expr}` child live (the option text follows its signals); `items` is live too (appended / removed items update the open list). The form is decided once, at render: adding or removing `items` later does not switch it.

::example{id=inline-select-shorthand}

### Team Switcher

::example{id=inline-select-team-switcher}

### Custom Indicator

::example{id=inline-select-custom-indicator}

### Multi Select

With `selectionMode="multiple"` the value is an array (a two-way `Signal` here) and the list stays open while you pick. The value lists the picked items.

::example{id=inline-select-multi-select}

### Placements

::example{id=inline-select-placements}

### Breadcrumb Switcher

A [Breadcrumbs](/components/breadcrumbs/) item with a function child renders whatever you return instead of its link (a plain child would put the trigger inside the link). The function gets `{ isCurrent, isDisabled, separator }`: call `separator()` to keep the item separator.

::example{id=inline-select-breadcrumbs}

### In a Sentence

::example{id=inline-select-sentence}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.inline-select` - The root (`inline-flex`, baseline aligned).
- `.inline-select__trigger` - Ghost button: inherits font size and line height, `--default` background on hover and while open, focus ring, disabled. In Breadcrumbs it takes the link text size.
- `.inline-select__value` - The value (truncated; `[data-placeholder]`).
- `.inline-select__indicator` - The chevrons.
- `.inline-select__popover` - Added to the vendored `.select__popover` look.

### CSS Variables

| Variable                          | Default    | Description                    |
| --------------------------------- | ---------- | ------------------------------ |
| `--inline-select-value-max-width` | `16rem`    | Width at which the value clips |
| `--inline-select-indicator-size`  | `0.875rem` | Chevron size                   |

### Data Attributes

- `[data-slot]`: `inline-select`, `inline-select-trigger`, `inline-select-value`, `inline-select-default-indicator` (or `inline-select-indicator` with children), `inline-select-popover`.
- Trigger: `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`, `[aria-expanded]`. Indicator: `[data-open]`. Value: `[data-placeholder]`.

## API Reference

### InlineSelect

| Prop            | Type                                       | Default    | Description                                                                                         |
| --------------- | ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| `value`         | `Key` \| `Signal<Key \| null>` (or arrays) | -          | Selection (controlled; Signal two-way)                                                              |
| `defaultValue`  | `Key` \| `Key[]`                           | -          | Initial selection                                                                                   |
| `onChange`      | `(value) => void`                          | -          | Called when the selection changes                                                                   |
| `selectionMode` | `"single"` \| `"multiple"`                 | `"single"` | Selection mode                                                                                      |
| `placeholder`   | `string`                                   | -          | Text while nothing is selected                                                                      |
| `disabledKeys`  | `Iterable<Key>`                            | -          | Options that cannot be picked                                                                       |
| `isDisabled`    | `boolean`                                  | `false`    | Disables the select                                                                                 |
| `name`          | `string`                                   | -          | Form field name (hidden select)                                                                     |
| `aria-label`    | `string`                                   | -          | Accessible name                                                                                     |
| `items`         | `Iterable<T>`                              | -          | Shorthand: the list items (the root renders the parts); `children` is a render function of one item |
| `class`         | `string` \| render-prop function           | -          | Additional CSS classes                                                                              |

::api{symbol="@rivetjs/ui/inline-select#InlineSelectRootProps"}

### InlineSelect.Item

`ListBox.Item` props (`id`, `textValue`, `isDisabled`, …) plus the item indicator; `textValue` defaults to string children.

### InlineSelect.Popover

| Prop        | Type        | Default        | Description                  |
| ----------- | ----------- | -------------- | ---------------------------- |
| `placement` | `Placement` | `"bottom end"` | Position against the trigger |

Takes the cdk `Popover` props.

### InlineSelect.Indicator

`children` replace the chevrons (rendered in a `span` with the indicator class).

### InlineSelect.Trigger / .Value

Take the cdk `Button` / `SelectValue` props.

## Related Components

- [Select](/components/select/): A full form field select.
- [CellSelect](/components/cell-select/): A settings-row select.
- [Breadcrumbs](/components/breadcrumbs/): Navigation trail.
