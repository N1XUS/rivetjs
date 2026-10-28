---
title: AppLayout
description: "AppLayout: application shell of sidebar, sticky navbar, main content, aside panel, toolbar and footer; resizable, persisted, with a mobile aside sheet."
template: reference
status: experimental
related: [components/sidebar, components/drawer, components/toolbar]
---

`AppLayout` composes the frame of an application: a [Sidebar](sidebar.md) on one side, a sticky navbar, the main content, an optional aside panel on the right, a toolbar under the navbar and a footer. It forwards the sidebar options to the `Sidebar.Provider` it renders, owns the aside open state (cookie `aside_state`), resizes both panels (WAI-ARIA window splitter) and turns the aside into a sheet on small screens.

::example{id=app-layout-usage}

## Usage

```tsx
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export default function App() {
  return (
    <AppLayout
      sidebar={() => (
        <Sidebar>
          <Sidebar.Content>…</Sidebar.Content>
        </Sidebar>
      )}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger />
          <span class="flex-1">Overview</span>
          <AppLayout.AsideTrigger />
        </>
      )}
      aside={() => <div class="p-4">Details</div>}
    >
      <p>Main content</p>
    </AppLayout>
  );
}
```

- Slots (`sidebar`, `navbar`, `aside`, `toolbar`, `footer`) are render functions (`() => …`): they render inside the layout's providers, so the triggers and `useAppLayout()` find the layout.
- `children` is the main content.

## Anatomy

| Part                     | Element                                                                           | `data-slot`                                             |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `AppLayout` / `.Root`    | sidebar wrapper `div`, class `app-layout` (`data-app-layout`, `data-scroll-mode`) | `sidebar-wrapper`                                       |
| `sidebar` slot           | your `<Sidebar>`                                                                  | `sidebar`                                               |
| body                     | `div.sidebar__inset.app-layout__body`                                             | `app-layout-body`                                       |
| `navbar` slot            | sticky `header`                                                                   | `app-layout-header`                                     |
| `toolbar` slot           | `div` under the header                                                            | `app-layout-toolbar`                                    |
| content row              | `div` holding main + aside                                                        | `app-layout-content`                                    |
| `children`               | `main`                                                                            | `app-layout-main`                                       |
| `aside` slot             | `aside` (`data-state` open / closed, `inert` when closed)                         | `app-layout-aside`                                      |
| `footer` slot            | `div`                                                                             | `app-layout-footer`                                     |
| `AppLayout.MenuToggle`   | icon button (below 768px: opens the sidebar sheet)                                | `sidebar-trigger`, class `app-layout__menu-toggle`      |
| `AppLayout.AsideTrigger` | icon button (`aria-expanded`, `aria-controls`)                                    | `app-layout-aside-trigger`                              |
| `AppLayout.MobileAside`  | renders its children only in the mobile aside sheet                               | —                                                       |
| resize handles           | `div role=separator` (`aria-valuenow` / `-min` / `-max` in %)                     | `app-layout-sidebar-handle` / `app-layout-aside-handle` |

Additional exported parts: `AppLayout.Root`.

## Examples

### Collapsible

`sidebarCollapsible` defaults to `"icon"`: a collapsed sidebar keeps its icons (tooltips on the menu buttons).

::example{id=app-layout-collapsible}

### Off-canvas

::example{id=app-layout-offcanvas}

### Inset

::example{id=app-layout-inset}

### Floating

::example{id=app-layout-floating}

### Inset dashboard

A dashboard on the inset sidebar with off-canvas collapse, KPIs in the page and a user menu in the sidebar footer.

::example{id=app-layout-inset-dashboard}

### Docs site

A documentation layout: search and a theme segment in the navbar, grouped page navigation in the sidebar.

::example{id=app-layout-docs-site}

### With breadcrumbs

A multi-level breadcrumb trail in the navbar shows the current depth.

::example{id=app-layout-breadcrumbs}

### With aside

The aside column shows from 1024px. The aside demos set `asideMobile="sheet"`, so in a narrower frame `AppLayout.AsideTrigger` opens the panel as a sheet.

::example{id=app-layout-aside}

### Contained layout

Set `contained` to keep the desktop sidebar inside a card or panel instead of the viewport. Give the layout a height with `class` or `style` (for example `class="h-[820px]"`); combine with `scrollMode="content"` to keep the main content and aside within that height. This forwards `Sidebar.Provider`’s contained mode without adding another provider. Mobile navigation and aside sheets keep their overlay behavior. The [AI chat showcase](/showcase/chat/) combines a contained, resizable history sidebar with an aside drawer.

### Content scroll mode

`scrollMode="page"` (default) scrolls the document with a sticky header and aside; `"content"` fixes the layout to the viewport height and scrolls the main area.

::example{id=app-layout-scroll-content}

### Resizable

Sizes are numbers (percent of the layout width) or CSS lengths. Keys on a focused handle: :kbd[ArrowLeft] / :kbd[ArrowRight] (1 %, with :kbd[Shift] 10 %), :kbd[Home] / :kbd[End] (min / max), :kbd[Enter] (default size).

::example{id=app-layout-resizable}

### Persisted sizes

`resizableAutoSaveId` saves the panel sizes in `localStorage` (restored in the browser after load). The sidebar (`sidebar_state`) and aside (`aside_state`) open states are cookies: pass them back for the server render, `defaultSidebarOpen={sidebarCookieOpen(cookies) ?? true}` and `defaultAsideOpen={asideCookieOpen(cookies) ?? true}`.

::example{id=app-layout-persisted}

### Aside shortcut

The sidebar toggles with :kbd[Mod+B] (`toggleShortcut`, forwarded to the provider). The aside has no shortcut by default: set `asideToggleShortcut`.

::example{id=app-layout-aside-shortcut}

### Mobile sheet

Below 1024px the aside column is hidden (`asideMobile="hidden"`, default) or opens as a right-side sheet from `AppLayout.AsideTrigger` (`"sheet"`).

::example{id=app-layout-mobile-sheet}

### Toolbar and footer

::example{id=app-layout-toolbar-footer}

### Controlled

`sidebarOpen` / `asideOpen` take a two-way Signal, a value or an accessor (+ `onSidebarOpenChange` / `onAsideOpenChange`). `useAppLayout()` returns `{ isAsideOpen, setAsideOpen, toggleAside }` inside a layout (`null` outside); `useSidebar()` covers the sidebar.

::example{id=app-layout-controlled}

### Client-side routing

`navigate(href)` on AppLayout reaches the internal sidebar provider, so every `Sidebar.MenuButton` with an `href` routes through it; mark the current page with `isCurrent`. Inside a `@rivetjs/router` app, links already route client-side: pass `navigate` only for another router.

::example{id=app-layout-routing}

### Import

```tsx
import { AppLayout } from "@rivetjs/ui/app-layout";
```

### Resumability

Server-rendered with the cookie-picked open states. The aside shortcut listener is registered only when `asideToggleShortcut` is set; restoring persisted sizes runs at idle only with `resizableAutoSaveId`.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `sidebar-gap`, `app-layout-aside-inner`, `app-layout-menu-toggle`, `app-layout-menu-toggle-icon`, `app-layout-aside-trigger-icon`.

### Styling

| CSS variable                  | Default  | What                                        |
| ----------------------------- | -------- | ------------------------------------------- |
| `--app-layout-aside-width`    | `320px`  | aside width (set by `asideDefaultSize`)     |
| `--app-layout-header-height`  | `3.5rem` | navbar min height, sticky offset of aside   |
| `--app-layout-aside-duration` | `200ms`  | aside open / close transition               |
| `--sidebar-width`             | sidebar  | sidebar width (set by `sidebarDefaultSize`) |

`reduceMotion` (or `prefers-reduced-motion`) turns the transitions off. `class` / `style` land on the wrapper.

## API Reference

See the [full module API](/api/rivetjs/ui/app-layout/) for every named export and part prop type.

| Prop                                                         | Type                                                        | Default            |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| `sidebar`, `navbar`, `aside`, `toolbar`, `footer`            | `() => JSX.Element`                                         | —                  |
| `sidebarOpen` / `defaultSidebarOpen` / `onSidebarOpenChange` | `boolean \| Signal<boolean>` / `boolean` / `(open) => void` | `true`             |
| `contained` | `boolean` | `false` |
| `sidebarSide`                                                | `"left" \| "right"`                                         | `"left"`           |
| `sidebarVariant`                                             | `"sidebar" \| "floating" \| "inset"`                        | `"sidebar"`        |
| `sidebarCollapsible`                                         | `"icon" \| "offcanvas" \| "none"`                           | `"icon"`           |
| `toggleShortcut`                                             | `string \| false`                                           | `"mod+b"`          |
| `asideOpen` / `defaultAsideOpen` / `onAsideOpenChange`       | `boolean \| Signal<boolean>` / `boolean` / `(open) => void` | `true`             |
| `asideToggleShortcut`                                        | `string \| false`                                           | off                |
| `asideMobile`                                                | `"hidden" \| "sheet"`                                       | `"hidden"`         |
| `asideLabel`                                                 | `string`                                                    | `"Details"`        |
| `sidebarResizable` / `asideResizable`                        | `boolean`                                                   | `false`            |
| `sidebarDefaultSize` / `MinSize` / `MaxSize`                 | `number \| string`                                          | `18` / `12` / `30` |
| `asideDefaultSize` / `MinSize` / `MaxSize`                   | `number \| string`                                          | `20` / `15` / `40` |
| `sidebarResizeBehavior` / `asideResizeBehavior`              | `"preserve-relative-size" \| "preserve-pixel-size"`         | relative           |
| `resizableAutoSaveId`                                        | `string`                                                    | —                  |
| `scrollMode`                                                 | `"page" \| "content"`                                       | `"page"`           |
| `reduceMotion`, `navigate`, `useHref`                        | forwarded to `Sidebar.Provider`                             | —                  |

::api{symbol="@rivetjs/ui/app-layout#AppLayoutRootProps"}

## Accessibility

- Landmarks: `header`, `main`, `aside` (labelled by `asideLabel`); the sidebar is the `Sidebar` landmark.
- `AppLayout.AsideTrigger` has `aria-expanded` + `aria-controls` and a "Show panel" / "Hide panel" label and tooltip. At 1024px and wider they follow the desktop aside; below 1024px with `asideMobile="sheet"` they follow the sheet (closed = "Show panel", open = "Hide panel"). CSS selects the visible trigger without starting client JavaScript. A supplied trigger `id` belongs to the desktop button; the mobile button uses `<id>-mobile`. In sheet mode, pass custom icon children as inline JSX or a render function, since each viewport has its own button; avoid hoisted eager JSX nodes and fixed child IDs. A closed desktop aside is `inert`.
- Resize handles are focusable window splitters (`role="separator"`, `aria-orientation="vertical"`, value in percent).

## Related Components

- [Sidebar](/components/sidebar/)
- [Drawer](/components/drawer/)
- [Toolbar](/components/toolbar/)
