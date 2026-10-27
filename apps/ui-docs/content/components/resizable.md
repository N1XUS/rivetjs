---
title: Resizable
description: "Resizable panel groups and split panes: horizontal, vertical, nested, collapsible, persisted layouts, handle types and variants, keyboard support."
template: reference
status: experimental
related: [components/separator, components/app-layout, showcase/mail]
---

Accessible resizable panel groups and layouts with keyboard support. The API is the [shadcn/ui Resizable](https://ui.shadcn.com/docs/components/resizable) one; behaviour is the [cdk Resizable](site:cdk/components/resizable/), a port of react-resizable-panels.

Accessibility: each handle is a WAI-ARIA window splitter (`role="separator"`, `aria-valuenow` / `aria-valuemin` / `aria-valuemax`, `aria-controls`). Arrow keys resize by 5%, Home / End jump to the limits, Enter collapses or expands a collapsible panel, F6 moves between handles. Give a handle an `aria-label` when the panes have no visible headings.

## Usage

```tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";
```

::example{id=resizable-demo}

## Anatomy

```tsx
import { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export default function Split() {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel>One</ResizablePanel>
      <ResizableHandle>
        <ResizableIndicator />
      </ResizableHandle>
      <ResizablePanel>Two</ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

The compound form `Resizable.Group` / `Resizable.Panel` / `Resizable.Handle` / `Resizable.Indicator` is the same set of parts. Handles must be direct children of their group; `ResizableIndicator` is the optional affordance inside a handle.

## Examples

### Vertical

Use `orientation="vertical"` for vertical resizing.

::example{id=resizable-vertical}

### Handle

Use `withHandle` on `ResizableHandle` to show a visible grip (the same grip chip as `type="drag"`).

::example{id=resizable-handle}

### Handle types

`type` picks the affordance; match it to how important the boundary is.

- `line` (default): the 1px separator.
- `drag`: the line with a grip chip, for boundaries users may not know they can move.
- `pill`: the line with a rounded pill, the strongest affordance; use it sparingly.
- `handle`: a standalone pill with no line between the panels.

::example{id=resizable-handle-types}

### Variants

`variant` colours the handle with a separator token so it blends into its surface: `primary` (`separator`, the default, for the page background), `secondary` (`separator-secondary`, for `surface`) and `tertiary` (`separator-tertiary`, for darker surfaces).

::example{id=resizable-variants}

### With indicator

`withIndicator` puts the drag dots on a `line` handle. For full control, compose `ResizableIndicator` inside the handle: `type="pill"` (default) or `type="drag"`, or your own children.

::example{id=resizable-with-indicator}

### Size units

Sizes take a number (pixels) or a string with a unit: `"30%"`, `"240px"`, `"16rem"`, `"20vw"`; a unitless string is a percentage. Set `minSize` / `maxSize` to limit a panel. `groupResizeBehavior="preserve-pixel-size"` keeps a panel's pixel size when the group or the window resizes; keep at least one panel on the default `"preserve-relative-size"` so the remaining space has somewhere to go. `onResize(size)` reports `size.asPercentage` and `size.inPixels`.

::example{id=resizable-size-units}

### Nested groups

A panel can hold another group; use the other orientation for editor-style layouts. Give every group an `id`.

::example{id=resizable-nested}

### Collapsible panels

`collapsible` + `collapsedSize` let a panel snap closed when it is dragged past its minimum (Enter on the handle toggles it too).

```tsx
<ResizablePanelGroup>
  <ResizablePanel id="nav" defaultSize="20%" minSize="180px" collapsible collapsedSize="64px" onResize={(size) => rail.set(size.inPixels < 120)}>
    {/* folders */}
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel id="main">{/* content */}</ResizablePanel>
</ResizablePanelGroup>
```

### Persisted layout

`useDefaultLayout` saves the layout after each change and restores it. With `cookieStorage(request cookie header)` the server renders the stored sizes, so the page never shifts; the default (`localStorage`) restores it in the browser once the page is idle. The cookie / storage key is `react-resizable-panels:<id>`.

```tsx
import { ResizablePanelGroup, cookieStorage, useDefaultLayout } from "@rivetjs/ui/resizable";

const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail", storage: cookieStorage(data.cookie) });

<ResizablePanelGroup id="mail" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
  {/* panels with ids */}
</ResizablePanelGroup>;
```

A complete page with the loader that reads the cookie:

::example{id=resizable-persisted}

### Imperative API

`usePanelRef()` / `useGroupRef()` give handles: `collapse()`, `expand()`, `resize(size)`, `isCollapsed()`, `getSize()` on a panel; `getLayout()` / `setLayout(layout)` on a group.

```tsx
const nav = usePanelRef();

<Button onPress={() => (nav.current?.isCollapsed() ? nav.current.expand() : nav.current?.collapse())}>Toggle</Button>;
```

::example{id=resizable-collapsible}

## Styling

| Part | Class | `data-slot` |
| --- | --- | --- |
| Group | `resizable` | `resizable-panel-group` |
| Panel (inner element) | `resizable__panel` | `resizable-panel` (outer element) |
| Handle | `resizable__handle` | `resizable-handle` |
| Grip | `resizable__grip` | `resizable-handle-grip` |
| Indicator | `resizable__indicator`, `resizable__indicator--pill` / `--drag` | `resizable-indicator` |

The handle carries `resizable__handle--<type>` and `resizable__handle--<variant>`, `data-type`, `data-separator` (`inactive`, `hover`, `active`, `focus`, `disabled`) and `aria-orientation`; the default styles show `col-resize` / `row-resize`, the accent colour while hovered or dragged and the focus ring. Panel flex sizes are inline styles of the cdk parts.

The group (`.resizable`) sets these variables; override them on a group or any ancestor (nested groups inherit them):

| Variable | Default | |
| --- | --- | --- |
| `--resizable-handle-size` | `1px` | Line thickness. |
| `--resizable-handle-hit-area` | `8px` | Grab area around the line (cursor). |
| `--resizable-handle-color` | `var(--color-separator)` | Line colour (set by `variant`). |
| `--resizable-handle-color-hover` | `var(--color-accent)` | While hovered. |
| `--resizable-handle-color-active` | `var(--color-accent)` | While dragged or focused. |
| `--resizable-indicator-pill-width` | `6px` | Pill short axis. |
| `--resizable-indicator-pill-height` | `32px` | Pill long axis. |
| `--resizable-indicator-drag-size` | `12px` | Drag dots icon size. |

## Resumability

The server renders every panel at its default (or stored) size. A resumed page runs no resizable code until a handle is hovered, focused or pressed; the first key or drag is not lost.

## API Reference

::api{symbol="@rivetjs/ui/resizable#ResizablePanelGroup"}

::api{symbol="@rivetjs/ui/resizable#ResizablePanel"}

::api{symbol="@rivetjs/ui/resizable#ResizableHandle"}

::api{symbol="@rivetjs/ui/resizable#ResizableIndicator"}
