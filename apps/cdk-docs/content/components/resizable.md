---
title: Resizable
description: "Resizable panel groups and split panes (react-resizable-panels port): horizontal, vertical, nested, collapsible, persisted, keyboard."
template: guide
status: experimental
related: [components/separator, components/scroll-area, foundations/focus]
---

`Group`, `Panel` and `Separator` build resizable layouts and split panes. Each separator is a [WAI-ARIA window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), resized by pointer or keyboard. This is a port of [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) 4.14.3: its layout engine runs unchanged, and the parts keep the upstream v4 names and props.

::example{id=resizable-horizontal}

## Features

- Horizontal and vertical groups, nested to any depth.
- Sizes in `%`, `px`, `rem`, `em`, `vh` / `vw`; `minSize`, `maxSize`, `collapsible`, `collapsedSize`.
- Pointer drag on the separator; double click resets a panel to its `defaultSize` (`disableDoubleClick` turns it off).
- Keyboard: arrows resize by 5%, Home / End jump to the limits, Enter collapses / expands, F6 moves between separators.
- `useDefaultLayout` persistence (localStorage or Rivet `cookieStorage`), imperative `usePanelRef` / `useGroupRef` handles.
- Resumable: the server renders each panel at its default (or stored) size, so the layout never shifts. A resumed page runs no resizable code until a separator is hovered, focused or pressed; the first key or drag is replayed.

## Anatomy

```tsx
import { Group, Panel, Separator } from "@rivetjs/cdk/resizable";

<Group orientation="horizontal">
  <Panel id="left" defaultSize="30%">…</Panel>
  <Separator />
  <Panel id="right">…</Panel>
</Group>;
```

A `Panel` renders an outer element that carries the flex size (inline style) and an inner element with `class` (default `rv-ResizablePanel`). Separators must be direct children of their group. Give panels an `id` when the layout is stored or set from code.

## Vertical

`orientation="vertical"` stacks the panels. The separator's `aria-orientation` is then `horizontal` and it resizes with ArrowUp / ArrowDown.

::example{id=resizable-vertical}

## Nested groups

A group can sit inside a panel of another group. Each separator resizes its own group.

::example{id=resizable-nested}

## Collapsible panels

A `collapsible` panel snaps to `collapsedSize` (default 0) when dragged past its `minSize`; Enter on its separator toggles it. `onResize(size)` reports `size.asPercentage` and `size.inPixels`, for example to switch the panel to a compact view.

::example{id=resizable-collapsible}

## Persisted layout

`useDefaultLayout({ id })` saves the layout under `react-resizable-panels:<id>` after each change. With the default `localStorage`, the browser restores it once the page is idle. With `cookieStorage(cookieHeader)` the server reads the stored layout and renders it, so a reload shows the saved sizes with no shift:

```tsx
const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail", storage: cookieStorage(data.cookie) });

<Group id="mail" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
  …
</Group>;
```

::example{id=resizable-persistence}

## Conditional panels

Panels and separators can be added or removed. The group registers its current children again and keeps the sizes valid.

::example{id=resizable-conditional}

## Imperative API

`usePanelRef()` gives `collapse()`, `expand()`, `resize(size)`, `isCollapsed()` and `getSize()`. `useGroupRef()` gives `getLayout()` and `setLayout(layout)`. Calls on a resumed page boot the group first.

::example{id=resizable-imperative}

## Keyboard

| Key | Action |
| --- | --- |
| Arrow keys | Resize by 5% along the group's orientation. |
| Home / End | Give the panel before the separator its smallest / largest allowed size. |
| Enter | Collapse the panel before the separator when it is collapsible, or restore its previous size. |
| F6 / Shift+F6 | Move focus to the next / previous separator of the group. |

## Styling

| Part | Default class | State |
| --- | --- | --- |
| Group | `rv-ResizableGroup` | `data-group` |
| Panel (inner element) | `rv-ResizablePanel` | `data-panel` (outer element) |
| Separator | `rv-ResizableSeparator` | `data-separator` = `inactive` / `hover` / `active` / `focus` / `disabled`; `aria-orientation`, `aria-valuenow` |

The cursor (`col-resize`, `row-resize`, limit cursors) is set on the document while dragging; `disableCursor` turns it off.

## API Reference

::api{symbol="@rivetjs/cdk/resizable#Group"}

::api{symbol="@rivetjs/cdk/resizable#Panel"}

::api{symbol="@rivetjs/cdk/resizable#Separator"}

::api{symbol="@rivetjs/cdk/resizable#useDefaultLayout"}
