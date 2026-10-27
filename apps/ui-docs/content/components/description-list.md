---
title: DescriptionList
description: "Key / value rows for order summaries, totals and specs: a description list with muted terms, end-aligned values and an emphasized total row."
template: reference
status: experimental
related: [components/surface, components/separator, components/item-card-group]
---

`DescriptionList` lays out label / value pairs (an order summary, totals, a spec sheet) as a native `dl`: the term at the start in the muted colour, the value at the end with tabular figures, rows that wrap on narrow widths. `DescriptionList.Item isEmphasized` marks a total row. Pure markup: no script.

:::note
Rivet addition: no HeroUI counterpart.
:::

## Usage

```tsx
import { DescriptionList } from "@rivetjs/ui/description-list";
```

::example{id=description-list-basic}

## Anatomy

```tsx
import { DescriptionList } from "@rivetjs/ui/description-list";

export default function Anatomy() {
  return (
    <DescriptionList>
      <DescriptionList.Item>
        <DescriptionList.Term>…</DescriptionList.Term>
        <DescriptionList.Details>…</DescriptionList.Details>
      </DescriptionList.Item>
      <DescriptionList.Item isEmphasized>…</DescriptionList.Item>
    </DescriptionList>
  );
}
```

Accessibility: a native `dl` (each `div` row groups one `dt` + `dd`, as HTML allows). Name a list with `aria-label` when a page has several.

## Styling Reference

### CSS Classes

- `.description-list` - The `dl` (column of rows, `text-sm`).
- `.description-list__item` - One row; `.description-list__item--emphasized` = total row (bold, term in the foreground colour).
- `.description-list__term` - The `dt` (muted).
- `.description-list__details` - The `dd` (end-aligned, tabular figures).

### Data Attributes

- `[data-slot]`: `description-list`, `description-list-item`, `description-list-term`, `description-list-details`.
- `[data-emphasized]` on an emphasized row.

## API Reference

### DescriptionList.Item

| Prop           | Type      | Default | Description            |
| -------------- | --------- | ------- | ---------------------- |
| `isEmphasized` | `boolean` | `false` | A total row            |
| `class`        | `string`  | -       | Additional CSS classes |

Also takes `div` props.

### Other parts

`DescriptionList` takes `dl` props and `class`; `DescriptionList.Term` (`dt`) and `DescriptionList.Details` (`dd`) take their element's props and `class`.

## Related Components

- [Surface](/components/surface/): A tinted box around a summary.
- [Separator](/components/separator/): A line between item rows and totals.
- [ItemCardGroup](/components/item-card-group/): Rows with an icon, title and action.
