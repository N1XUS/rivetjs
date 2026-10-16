---
title: AppLayout
description: "AppLayout: application shell of sidebar, sticky navbar, main content, aside panel, toolbar and footer; resizable, persisted, with a mobile aside sheet."
template: reference
status: experimental
related: [components/sidebar, components/drawer, components/toolbar]
---

`AppLayout` composes the frame of an application: a [Sidebar](sidebar.md) on one side, a sticky navbar, the main content, an optional aside panel on the right, a toolbar under the navbar and a footer. It forwards the sidebar options to the `Sidebar.Provider` it renders, owns the aside open state (cookie `aside_state`), resizes both panels (WAI-ARIA window splitter) and turns the aside into a sheet on small screens.

::example{id=app-layout-usage}

## Import

```tsx
import { AppLayout } from "@rivetjs/ui/app-layout";
```

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

### With aside

::example{id=app-layout-aside}

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

## Styling

| CSS variable                  | Default  | What                                        |
| ----------------------------- | -------- | ------------------------------------------- |
| `--app-layout-aside-width`    | `320px`  | aside width (set by `asideDefaultSize`)     |
| `--app-layout-header-height`  | `3.5rem` | navbar min height, sticky offset of aside   |
| `--app-layout-aside-duration` | `200ms`  | aside open / close transition               |
| `--sidebar-width`             | sidebar  | sidebar width (set by `sidebarDefaultSize`) |

`reduceMotion` (or `prefers-reduced-motion`) turns the transitions off. `class` / `style` land on the wrapper.

## API Reference

| Prop                                                         | Type                                                        | Default            |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| `sidebar`, `navbar`, `aside`, `toolbar`, `footer`            | `() => JSX.Element`                                         | —                  |
| `sidebarOpen` / `defaultSidebarOpen` / `onSidebarOpenChange` | `boolean \| Signal<boolean>` / `boolean` / `(open) => void` | `true`             |
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
- `AppLayout.AsideTrigger` has `aria-expanded` + `aria-controls` and a "Show panel" / "Hide panel" label; a closed aside is `inert`.
- Resize handles are focusable window splitters (`role="separator"`, `aria-orientation="vertical"`, value in percent).

## Resumability

Server-rendered with the cookie-picked open states. The aside shortcut listener is registered only when `asideToggleShortcut` is set; restoring persisted sizes runs at idle only with `resizableAutoSaveId`.
