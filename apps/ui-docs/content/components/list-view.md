---
title: ListView
description: "A single-column interactive list with selection, row actions, variants, an empty state and virtualization."
template: reference
status: experimental
related: [components/list-box, components/action-bar, components/table]
---

`ListView` is a list of rich rows that users can navigate with the arrow keys, select, and act on. It is the cdk `GridList` in its stack layout: every row is a grid row, and buttons or menus inside a row are reachable with Tab. Turn on selection with `selectionMode` and each row gets a checkbox.

## Usage

```tsx
import { ListView } from "@rivetjs/ui/list-view";
```

::example{id=list-view-basic}

## Anatomy

```tsx
import { ListView } from "@rivetjs/ui/list-view";

export default function Anatomy() {
  return (
    <ListView aria-label="Files">
      <ListView.Item id="report" textValue="Q3 report">
        <ListView.ItemContent>
          <div>
            <ListView.Title>Q3 report</ListView.Title>
            <ListView.Description>1.2 MB</ListView.Description>
          </div>
        </ListView.ItemContent>
        <ListView.ItemAction>{/* buttons, menus */}</ListView.ItemAction>
      </ListView.Item>
    </ListView>
  );
}
```

## Selection Modes

`selectionMode="multiple"` or `"single"` adds a selection checkbox to each row. Bind `selectedKeys` to a signal for two-way selection, or use `defaultSelectedKeys` and `onSelectionChange`.

::example{id=list-view-selection}

## Variants

::example{id=list-view-variants}

## Disabled Items

::example{id=list-view-disabled}

## With Action Bar

Combine a multiple-selection list with an [ActionBar](/components/action-bar/) for bulk actions. Per-row actions go in `ItemAction`.

::example{id=list-view-action-bar}

## Empty State

::example{id=list-view-empty}

## Virtualized

`virtualized` renders only the rows in view (cdk `CollectionVirtualizer` with a list layout). Give the list a fixed height and set `rowHeight` to the row height in pixels; `initialSize` sets the window the server renders.

::example{id=list-view-virtualized}

## Styling Reference

### CSS Classes

- `.list-view` - The list, with `.list-view--primary` or `.list-view--secondary`.
- `.list-view__item` - One row.
- `.list-view__selection-cell` - The selection checkbox cell.
- `.list-view__item-content` - Leading content: icon or avatar plus text.
- `.list-view__title` - Row title.
- `.list-view__description` - Secondary row text.
- `.list-view__item-action` - Trailing actions.
- `.list-view__empty-state` - Empty state wrapper.

### Data Attributes

- `[data-variant="primary|secondary"]` on the list.
- `[data-selected="true"]`, `[data-hovered="true"]`, `[data-pressed="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]` on a row.
- `[data-empty]` and `[data-focus-visible]` on the list.

## API Reference

### ListView

The cdk `GridList` (stack layout).

| Prop                  | Type                                    | Default     | Description                                              |
| --------------------- | --------------------------------------- | ----------- | -------------------------------------------------------- |
| `variant`             | `"primary" \| "secondary"`              | `"primary"` | Card of surface rows, or flat rows with separators       |
| `selectionMode`       | `"none" \| "single" \| "multiple"`      | `"none"`    | Selection; adds a checkbox per row                       |
| `selectedKeys`        | `Signal<Selection> \| Iterable<Key>`    | -           | Selected rows (a signal is two-way)                      |
| `defaultSelectedKeys` | `Iterable<Key> \| "all"`                | -           | Initial selection                                        |
| `onSelectionChange`   | `(keys: Selection) => void`             | -           | Selection changed                                        |
| `disabledKeys`        | `Iterable<Key>`                         | -           | Rows that cannot be focused or selected                  |
| `onAction`            | `(key: Key) => void`                    | -           | A row was pressed (or Enter)                             |
| `items`               | `Iterable<T>`                           | -           | Items for a dynamic list (children = render function)    |
| `renderEmptyState`    | `() => Content`                         | -           | Content when there are no rows                           |
| `virtualized`         | `boolean`                               | `false`     | Render only the rows in view                             |
| `rowHeight`           | `number`                                | `48`        | Row height in px when virtualized                        |
| `initialSize`         | `{ width: number; height: number }`     | -           | Server-rendered window when virtualized                  |
| `class`               | `string \| (values) => string`          | -           | Class, or a function of the render props                 |

### ListView.Item

The cdk `GridListItem`: `id`, `textValue`, `isDisabled`, `onAction`, `href`, `class`; children may be a function of the row's render props.

### ListView.ItemContent / Title / Description / ItemAction / EmptyState

Plain parts (`div` / `span` props and `class`).
