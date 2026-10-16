---
title: Resizable
description: "Resizable panel groups and split panes: horizontal, vertical, nested, collapsible, persisted layouts, keyboard support."
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export default function Split() {
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel>One</ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>Two</ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

The compound form `Resizable.Group` / `Resizable.Panel` / `Resizable.Handle` is the same set of parts. Handles must be direct children of their group.

## Examples

### Vertical

Use `orientation="vertical"` for vertical resizing.

::example{id=resizable-vertical}

### Handle

Use `withHandle` on `ResizableHandle` to show a visible grip.

::example{id=resizable-handle}

### Sizes and collapsing

Sizes take a number (pixels) or a string with a unit: `"30%"`, `"240px"`, `"16rem"`, `"20vw"`. Set `minSize` / `maxSize` to limit a panel, `collapsible` + `collapsedSize` to let it snap closed when dragged past its minimum. `onResize(size)` reports `size.asPercentage` and `size.inPixels`.

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

`useDefaultLayout` saves the layout after each change and restores it. With `cookieStorage(request cookie header)` the server renders the stored sizes, so the page never shifts; the default (`localStorage`) restores it in the browser once the page is idle.

```tsx
import { ResizablePanelGroup, cookieStorage, useDefaultLayout } from "@rivetjs/ui/resizable";

const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "mail", storage: cookieStorage(data.cookie) });

<ResizablePanelGroup id="mail" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
  {/* panels with ids */}
</ResizablePanelGroup>;
```

### Imperative API

`usePanelRef()` / `useGroupRef()` give handles: `collapse()`, `expand()`, `resize(size)`, `isCollapsed()`, `getSize()` on a panel; `getLayout()` / `setLayout(layout)` on a group.

```tsx
const nav = usePanelRef();

<Button onPress={() => (nav.current?.isCollapsed() ? nav.current.expand() : nav.current?.collapse())}>Toggle</Button>;
```

## Styling

| Part | Class | `data-slot` |
| --- | --- | --- |
| Group | `resizable` | `resizable-panel-group` |
| Panel (inner element) | `resizable__panel` | `resizable-panel` (outer element) |
| Handle | `resizable__handle` | `resizable-handle` |
| Grip | `resizable__grip` | `resizable-handle-grip` |

The handle carries `data-separator` (`inactive`, `hover`, `active`, `focus`, `disabled`) and `aria-orientation`; the default styles show `col-resize` / `row-resize`, the accent colour while hovered or dragged and the focus ring. Panel flex sizes are inline styles of the cdk parts.

## Resumability

The server renders every panel at its default (or stored) size. A resumed page runs no resizable code until a handle is hovered, focused or pressed; the first key or drag is not lost.

## API Reference

::api{symbol="@rivetjs/ui/resizable#ResizablePanelGroup"}

::api{symbol="@rivetjs/ui/resizable#ResizablePanel"}

::api{symbol="@rivetjs/ui/resizable#ResizableHandle"}
