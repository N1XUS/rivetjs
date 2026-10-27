---
title: Resizable
description: "Resizable panel groups and split panes: horizontal, vertical, nested, collapsible, persisted layouts and keyboard resizing."
template: guide
status: experimental
related: [components/separator, components/scroll-area, foundations/focus]
---

`Group`, `Panel` and `Separator` build resizable layouts and split panes. Each separator is a [WAI-ARIA window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), resized by pointer or keyboard.

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

`useDefaultLayout({ id })` saves the layout under `react-resizable-panels:<id>` after each change. With the default `localStorage`, the browser restores it once the page is idle. If the storage throws (Safari private mode, blocked cookies, a full quota), the layout stays in memory for the visit and nothing is logged. With `cookieStorage(cookieHeader)` the server reads the stored layout and renders it, so a reload shows the saved sizes with no shift:

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

## Props

### Group

| Prop | Default | Behavior |
| --- | --- | --- |
| `orientation` | `"horizontal"` | `"horizontal"` or `"vertical"`. |
| `defaultLayout` | Auto-assigned | Map of panel ids to percentages; also accepts an accessor. |
| `disabled`, `disableCursor` | `false` | Disable resizing or the document resize cursor; both accept accessors. |
| `resizePreviewMode` | `"panel"` | `"panel"` resizes during dragging; `"separator"` shows a preview and commits on release. |
| `resizeTargetMinimumSize` | `{ coarse: 20, fine: 10 }` | Minimum hit-target size in pixels for coarse and fine pointers. |
| `onLayoutChange` | None | Called during layout changes, including each pointer move. |
| `onLayoutChanged` | None | Called after a layout change; use for persistence. Receives layout and metadata with `isUserInteraction` and `requestedLayout`. |
| `groupRef` | None | Imperative `getLayout()` / `setLayout(layout)` handle. |
| `elementRef` | None | Root `HTMLDivElement` ref. |
| `id` | Generated | String or number; also used for `data-testid`. |
| `class`, `style`, `children` | `rv-ResizableGroup`, no style, no children | Root presentation and panel/separator content. Layout styles are protected except `overflow`. |

### Panel

| Prop | Default | Behavior |
| --- | --- | --- |
| `defaultSize` | Auto-assigned | Numbers are pixels; strings without units are percentages. Explicit `%`, `px`, `em`, `rem`, `vh`, `vw` are supported. |
| `minSize`, `maxSize` | `"0%"`, `"100%"` | Size constraints, using the same units. |
| `collapsible`, `collapsedSize` | `false`, `"0%"` | Allow collapsing to the specified size. |
| `collapsedThreshold` | Half the distance between collapsed and minimum size | Distance past the relevant boundary needed to collapse or expand. |
| `disabled` | `false` | Boolean/accessor; blocks direct and indirect resizing. |
| `groupResizeBehavior` | `"preserve-relative-size"` | Or `"preserve-pixel-size"`; a group needs at least one relative-size panel. |
| `onResize` | None | Reports percentage/pixel size, panel id and previous size. |
| `panelRef` | None | Imperative `collapse`, `expand`, `getSize`, `isCollapsed`, `resize` handle. |
| `elementRef`, `id` | No ref, generated id | Ref to the outer element; use stable ids for persisted layouts. |
| `class`, `style`, `children` | `rv-ResizablePanel`, no style, no children | Presentation and content of the inner element. |

### Separator

| Prop | Default | Behavior |
| --- | --- | --- |
| `disabled` | `false` | Boolean/accessor; disables this handle, not indirect panel resizing. |
| `disableDoubleClick` | `false` | Disables resetting the panel on double-click. |
| `preview` | Group preview | Function returning preview content or `SeparatorOverlay` when `resizePreviewMode="separator"`. |
| `elementRef`, `id` | No ref, generated id | Root element ref and identifier. |
| `class`, `style`, `children` | `rv-ResizableSeparator`, no style, no children | Handle presentation; flex-grow and flex-shrink are protected. |

`SeparatorOverlay` customizes the resize preview with `class` and `style`. The parts also accept their supported div attributes.

## Accessibility

Separators expose the window-splitter role, orientation and value. Keep their focus indicator visible and label the surrounding panels so users can identify the regions they are resizing.

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
