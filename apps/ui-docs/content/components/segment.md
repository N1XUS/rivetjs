---
title: Segment
description: "A segmented control: mutually exclusive options in one track, with a selection indicator that glides between items."
template: reference
status: experimental
related: [components/toggle-button-group, components/radio-group, components/button-group]
---

`Segment` switches between a few mutually exclusive options, like a view mode or a time range. One item is always selected, and a single indicator slides behind the selected item. Behaviour is the [cdk ToggleButtonGroup](site:cdk/components/toggle-button-group/) in single selection with the cdk `SelectionIndicator`.

## Usage

```tsx
import { Segment } from "@rivetjs/ui/segment";
```

::example{id=segment-basic}

## Anatomy

```tsx
import { Segment } from "@rivetjs/ui/segment";

export default function Range() {
  return (
    <Segment aria-label="Range" defaultSelectedKey="week">
      <Segment.Item id="day">Day</Segment.Item>
      <Segment.Separator />
      <Segment.Item id="week">Week</Segment.Item>
    </Segment>
  );
}
```

Each `Segment.Item` needs an `id`: it is the item's key in the selection. The indicator renders inside the selected item and moves with CSS transitions (`translate`, `width`, `height`); with `prefers-reduced-motion` it jumps.

Additional exported parts: `Segment.Root`.

## Examples

### Ghost

::example{id=segment-ghost}

### With Separators

`Segment.Separator` draws a divider between two items; the ones touching the selected item fade out.

::example{id=segment-with-separators}

### Controlled

Pass a two-way `Signal<Key | null>` as `selectedKey`: the Segment writes the new key on selection, and writing the signal moves the selection. A plain key is controlled (only `onSelectionChange` reports the press).

::example{id=segment-controlled}

### Disabled

::example{id=segment-disabled}

### Disabled Item

::example{id=segment-disabled-item}

### Sizes

::example{id=segment-sizes}

### Theme Switcher

::example{id=segment-theme-switcher}

### Two Items

::example{id=segment-two-items}

### With Icons

::example{id=segment-with-icons}

### Icon Expand

A function child receives the item's render props (accessors such as `isSelected()`), so content can change with the selection.

::example{id=segment-icon-expand}

## Styling Reference

### CSS Classes

Rivet-authored, in the vendored format (`@rivetjs/ui/styles` includes them):

- `.segment` - The track. Modifiers `.segment--default` (gray track) / `.segment--ghost` (transparent), `.segment--sm` / `.segment--md` / `.segment--lg`.
- `.segment__item` - One option; muted text, foreground on hover, focus ring on keyboard focus.
- `.segment__indicator` - The selection indicator behind the selected item (`--segment` surface; accent-soft for ghost).
- `.segment__label` - The item content, above the indicator.
- `.segment__separator` - Divider between items; hidden next to the selected item.

### CSS Variables

| Variable              | Default (md) | Description                     |
| --------------------- | ------------ | ------------------------------- |
| `--segment-height`    | `2rem`       | Item height                     |
| `--segment-padding-x` | `0.875rem`   | Item inline padding             |
| `--segment-font-size` | `--text-sm`  | Item text size                  |
| `--segment-gap`       | `0.375rem`   | Gap between an icon and a label |

### Data Attributes

- `[data-slot]`: `segment`, `segment-item`, `segment-indicator`, `segment-label`, `segment-separator`.
- Root: `[data-disabled]`, `[data-orientation]`. Item: `[data-selected]`, `[data-hovered]`, `[data-pressed]`, `[data-focus-visible]`, `[data-disabled]`.
- Indicator: `[data-entering]` / `[data-exiting]` while it moves.

## API Reference

See the [full module API](/api/rivetjs/ui/segment/) for every named export and part prop type.

### Segment

| Prop                   | Type                                     | Default     | Description                                           |
| ---------------------- | ---------------------------------------- | ----------- | ----------------------------------------------------- |
| `variant`              | `"default"` \| `"ghost"`                 | `"default"` | Track style                                           |
| `size`                 | `"sm"` \| `"md"` \| `"lg"`               | `"md"`      | Item size                                             |
| `selectedKey`          | `Key` \| `null` \| `Signal<Key \| null>` | -           | Selected key (controlled; a Signal is two-way)        |
| `defaultSelectedKey`   | `Key`                                    | -           | Initially selected key (uncontrolled)                 |
| `onSelectionChange`    | `(key: Key) => void`                     | -           | Called with the newly selected key                    |
| `allowsEmptySelection` | `boolean`                                | `false`     | Pressing the selected item again clears the selection |
| `isDisabled`           | `boolean`                                | `false`     | Disables every item                                   |
| `class`                | `string` \| render-prop function         | -           | Additional CSS classes                                |

### Segment.Item

| Prop         | Type                                                        | Default | Description                                |
| ------------ | ----------------------------------------------------------- | ------- | ------------------------------------------ |
| `id`         | `Key`                                                       | -       | The item's key (required)                  |
| `isDisabled` | `boolean`                                                   | `false` | Disables this item                         |
| `children`   | `Content` \| `(values: ToggleButtonRenderProps) => Content` | -       | Content, or a function of the render props |
| `class`      | `string` \| render-prop function                            | -       | Additional CSS classes                     |

### Segment.Separator

A decorative `span` (`aria-hidden`); takes `span` props and `class`.

::api{symbol="@rivetjs/ui/segment#SegmentRootProps"}

## Accessibility

the root is a `radiogroup` and each item a `radio` with `aria-checked` (React Aria ToggleButtonGroup, single selection). Tab moves focus into the group, arrow keys move focus between items, Enter / Space select the focused item; disabled items are skipped. Give the root an `aria-label` (or `aria-labelledby`), and icon-only items their own `aria-label`.

## Related Components

- [ToggleButtonGroup](/components/toggle-button-group/): Toggle buttons with single or multiple selection.
- [RadioGroup](/components/radio-group/): Single selection among labelled radio buttons.
