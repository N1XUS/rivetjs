---
title: FileTree
description: "A file and folder tree with icons, guide lines, sizes, a custom expand indicator and selection."
template: reference
status: experimental
related: [components/list-view, components/sidebar]
---

`FileTree` shows nested folders and files. It is the cdk `Tree`: arrow keys move between rows, ArrowRight / ArrowLeft expand and collapse a folder, and typing jumps to a row. Guide lines are drawn with CSS from each row's level.

## Usage

```tsx
import { FileTree } from "@rivetjs/ui/file-tree";
```

::example{id=file-tree-basic}

## Anatomy

```tsx
import { FileTree } from "@rivetjs/ui/file-tree";

export default function Anatomy() {
  return (
    <FileTree aria-label="Project">
      <FileTree.Item id="src" title="src">
        <FileTree.Item id="index" title="index.ts" />
      </FileTree.Item>
    </FileTree>
  );
}
```

Additional exported parts: `FileTree.Root`.

## Examples

### Sizes

::example{id=file-tree-sizes}

### Guide Lines

::example{id=file-tree-guide-lines}

### Multiple Selection

::example{id=file-tree-selection}

### Custom Indicator

`indicator` replaces the rotating chevron. `icon` and `indicator` can be functions of the row's render props (accessors such as `isExpanded()`).

::example{id=file-tree-custom-indicator}

### Dynamic Collection

::example{id=file-tree-dynamic}

### Not Yet Supported

- Drag and drop to move rows: waits for drag and drop in the cdk `Tree`.
- Sections (`TreeSection` headers): waits for server rendering of cdk tree sections.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `file-tree-item`, `file-tree-item-content`, `file-tree-indicator`, `file-tree-indicator-spacer`, `file-tree-selection-cell`, `file-tree-icon`, `file-tree-title`.

### CSS Classes

- `.file-tree` - The tree, with `.file-tree--sm`, `.file-tree--md` or `.file-tree--lg`.
- `.file-tree__item` - One row.
- `.file-tree__content` - The row's content line.
- `.file-tree__indent` - Indent with one guide line per level.
- `.file-tree__indicator` - Expand button (an empty spacer on files).
- `.file-tree__indicator-icon` - The default chevron.
- `.file-tree__selection-cell` - The selection checkbox cell.
- `.file-tree__icon` - Leading icon.
- `.file-tree__title` - Row label.

### CSS Variables

- `--file-tree-indent` - Indent per level and expand button size.
- `--file-tree-row` - Minimum row height.
- `--file-tree-guide` - Guide line colour.

### Data Attributes

- `[data-size="sm|md|lg"]` and `[data-guide-lines="always|hover|none"]` on the tree.
- `[data-expanded="true"]`, `[data-has-child-items="true"]`, `[data-level]`, `[data-selected="true"]`, `[data-hovered="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]` on a row.

## API Reference

See the [full module API](/api/rivetjs/ui/file-tree/) for every named export and part prop type.

### FileTree

The cdk `Tree`.

| Prop                  | Type                                 | Default  | Description                                           |
| --------------------- | ------------------------------------ | -------- | ----------------------------------------------------- |
| `size`                | `"sm" \| "md" \| "lg"`               | `"md"`   | Row height, text size and indent                      |
| `showGuideLines`      | `boolean \| "hover"`                 | `true`   | Guide lines always, while hovered / focused, or never |
| `selectionMode`       | `"none" \| "single" \| "multiple"`   | `"none"` | Selection; adds a checkbox per row                    |
| `selectedKeys`        | `Signal<Selection> \| Iterable<Key>` | -        | Selected rows (a signal is two-way)                   |
| `expandedKeys`        | `Signal<Set<Key>> \| Iterable<Key>`  | -        | Expanded folders (a signal is two-way)                |
| `defaultExpandedKeys` | `Iterable<Key>`                      | -        | Initially expanded folders                            |
| `onExpandedChange`    | `(keys: Set<Key>) => void`           | -        | Expanded folders changed                              |
| `disabledKeys`        | `Iterable<Key>`                      | -        | Rows that cannot be focused or selected               |
| `onAction`            | `(key: Key) => void`                 | -        | A row was pressed (or Enter)                          |
| `items`               | `Iterable<T>`                        | -        | Items for a dynamic tree (children = render function) |
| `renderEmptyState`    | `() => Content`                      | -        | Content when there are no rows                        |

### FileTree.Item

The cdk `TreeItem` with its content row.

| Prop         | Type                             | Default        | Description                               |
| ------------ | -------------------------------- | -------------- | ----------------------------------------- |
| `id`         | `Key`                            | -              | Row key                                   |
| `title`      | `Content`                        | -              | Row label                                 |
| `textValue`  | `string`                         | `title` (text) | Typeahead and accessible text             |
| `icon`       | `Content \| (values) => Content` | -              | Leading icon                              |
| `indicator`  | `Content \| (values) => Content` | chevron        | Expand button content                     |
| `isDisabled` | `boolean`                        | -              | Disable this row                          |
| `children`   | `Content`                        | -              | Nested `FileTree.Item`s or a `Collection` |

## Accessibility

The cdk Tree supplies treegrid navigation, selection and typeahead. Give the tree an accessible name and each item meaningful `textValue`. Arrow keys navigate the hierarchy; keep expand controls and selection controls available instead of communicating hierarchy only with guide lines.

## Related Components

- [ListView](/components/list-view/)
- [Sidebar](/components/sidebar/)
