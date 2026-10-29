---
title: FileTree
description: "A file and folder tree with icons, guide lines, sizes, a custom expand indicator, selection and drag and drop."
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

### Reduced Motion

::example{id=file-tree-reduced-motion}

The tree has no expand animation; its transitions are the chevron turn and the row colours, and they already stop under `prefers-reduced-motion`. `reduceMotion` turns them off for everyone.

### With Icons

::example{id=file-tree-with-icons}

`icon` takes an element or a function of the row's render props (`isExpanded()`, `hasChildItems()`, …), here an open folder while expanded.

### Sizes

::example{id=file-tree-sizes}

### Guide Lines

::example{id=file-tree-guide-lines}

### Multiple Selection

::example{id=file-tree-selection}

### PR File Review

::example{id=file-tree-pr-review}

A code review file list built from ui parts: `title` takes any content, here the name plus a Chip per change status, +/− counts and a comment count, with `textValue` keeping typeahead on the file name. The title is a function (`title={() => …}`): it renders with its row, so a resumed page keeps the server markup; plain JSX works as well, but it is built while the tree collects its items and re-created when the tree first wakes. `selectionMode="single"` with `selectionBehavior="replace"` selects a row without a checkbox; the panel beside the tree reads the selected key, and its "Viewed" Checkbox marks the file (or every file in a selected folder) as reviewed.

### Custom Indicator

`indicator` replaces the rotating chevron. `icon` and `indicator` can be functions of the row's render props (accessors such as `isExpanded()`).

::example{id=file-tree-custom-indicator}

### Drag And Drop

`useFileTreeDrag({ tree })` returns `dragAndDropHooks` for a tree rendered from `createTreeData` (`@rivetjs/cdk/data`). Rows reorder within a level, and a drop on a folder (a node whose `children` is an array) moves the rows into it; `onMove(keys, target)` runs after the move. Each draggable row gets a drag handle, shown on hover: mouse users drag the row, keyboard and screen reader users focus a row, press ArrowRight to reach the handle and Enter to start, then pick a drop target with the arrow keys and press Enter (Escape cancels). `dragIcon` replaces the grip; `dragIcon={false}` hides it visually and keeps it for keyboard drags. For other drag and drop setups pass hooks from the cdk `useDragAndDrop` straight to `dragAndDropHooks`.

::example{id=file-tree-drag-and-drop}

### Dynamic Collection

::example{id=file-tree-dynamic}

### Not Yet Supported

- Sections (`TreeSection` headers): waits for server rendering of cdk tree sections.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `file-tree-item`, `file-tree-item-content`, `file-tree-drag-handle`, `file-tree-indicator`, `file-tree-indicator-spacer`, `file-tree-selection-cell`, `file-tree-icon`, `file-tree-title`.

### CSS Classes

- `.file-tree` - The tree, with `.file-tree--sm`, `.file-tree--md` or `.file-tree--lg`.
- `.file-tree__item` - One row.
- `.file-tree__content` - The row's content line.
- `.file-tree__indent` - Indent with one guide line per level.
- `.file-tree__drag-handle` - Drag handle on draggable rows (shown on hover and keyboard focus).
- `.file-tree__drop-indicator` - Insertion line between rows while it is the drop target.
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

- `[data-size="sm|md|lg"]`, `[data-guide-lines="always|hover|none"]` and `[data-reduce-motion="true"]` on the tree; `[data-drop-target="true"]` while the whole tree is the drop target.
- `[data-expanded="true"]`, `[data-has-child-items="true"]`, `[data-level]`, `[data-selected="true"]`, `[data-hovered="true"]`, `[data-focus-visible="true"]`, `[data-disabled="true"]` on a row.
- `[data-allows-dragging="true"]`, `[data-dragging="true"]` (dimmed) and `[data-drop-target="true"]` (accent background) on a row while dragging; `[data-drop-target="true"]` on the drop indicator.

## API Reference

See the [full module API](/api/rivetjs/ui/file-tree/) for every named export and part prop type.

### FileTree

The cdk `Tree`.

| Prop                  | Type                                 | Default  | Description                                               |
| --------------------- | ------------------------------------ | -------- | --------------------------------------------------------- |
| `size`                | `"sm" \| "md" \| "lg"`               | `"md"`   | Row height, text size and indent                          |
| `showGuideLines`      | `boolean \| "hover"`                 | `true`   | Guide lines always, while hovered / focused, or never     |
| `reduceMotion`        | `boolean`                            | `false`  | No transitions, whatever the OS setting                   |
| `selectionMode`       | `"none" \| "single" \| "multiple"`   | `"none"` | Selection; adds a checkbox per row                        |
| `selectedKeys`        | `Signal<Selection> \| Iterable<Key>` | -        | Selected rows (a signal is two-way)                       |
| `expandedKeys`        | `Signal<Set<Key>> \| Iterable<Key>`  | -        | Expanded folders (a signal is two-way)                    |
| `defaultExpandedKeys` | `Iterable<Key>`                      | -        | Initially expanded folders                                |
| `onExpandedChange`    | `(keys: Set<Key>) => void`           | -        | Expanded folders changed                                  |
| `disabledKeys`        | `Iterable<Key>`                      | -        | Rows that cannot be focused or selected                   |
| `onAction`            | `(key: Key) => void`                 | -        | A row was pressed (or Enter)                              |
| `items`               | `Iterable<T>`                        | -        | Items for a dynamic tree (children = render function)     |
| `renderEmptyState`    | `() => Content`                      | -        | Content when there are no rows                            |
| `dragAndDropHooks`    | `DragAndDropHooks`                   | -        | Drag and drop (`useFileTreeDrag` or cdk `useDragAndDrop`) |

### FileTree.Item

The cdk `TreeItem` with its content row.

| Prop         | Type                             | Default        | Description                                    |
| ------------ | -------------------------------- | -------------- | ---------------------------------------------- |
| `id`         | `Key`                            | -              | Row key                                        |
| `title`      | `Content`                        | -              | Row label                                      |
| `textValue`  | `string`                         | `title` (text) | Typeahead and accessible text                  |
| `icon`       | `Content \| (values) => Content` | -              | Leading icon                                   |
| `indicator`  | `Content \| (values) => Content` | chevron        | Expand button content                          |
| `dragIcon`   | `Content \| false`               | grip           | Drag handle content; `false` hides it visually |
| `isDisabled` | `boolean`                        | -              | Disable this row                               |
| `children`   | `Content`                        | -              | Nested `FileTree.Item`s or a `Collection`      |

### useFileTreeDrag

`useFileTreeDrag(options)` returns `{ dragAndDropHooks }`. Other cdk `useDragAndDrop` options (`renderDragPreview`, `getDropOperation`, `onRootDrop`, `isDisabled`, …) pass through.

| Option     | Type                                                   | Default                | Description                                   |
| ---------- | ------------------------------------------------------ | ---------------------- | --------------------------------------------- |
| `tree`     | `TreeData<T>`                                          | -                      | The `createTreeData` manager the tree renders |
| `getItems` | `(keys: Set<Key>, items: TreeNode<T>[]) => DragItem[]` | key as `text/plain`    | Drag data for the dragged rows                |
| `onMove`   | `(keys: Set<Key>, target: ItemDropTarget) => void`     | -                      | Called after the tree data moved the rows     |
| `isFolder` | `(node: TreeNode<T>) => boolean`                       | `children` is an array | Rows that accept drops onto them              |

## Accessibility

The cdk Tree supplies treegrid navigation, selection and typeahead. Give the tree an accessible name and each item meaningful `textValue`. Arrow keys navigate the hierarchy; drag and drop always has the keyboard path through each row's drag handle (screen readers announce the drop targets). Keep expand controls and selection controls available instead of communicating hierarchy only with guide lines.

## Related Components

- [ListView](/components/list-view/)
- [Sidebar](/components/sidebar/)
