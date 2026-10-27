---
title: Sidebar
description: SidebarProvider, Sidebar and their parts build collapsible, cookie-persisted navigation with a mobile sheet.
template: guide
status: experimental
related: [components/disclosure, components/tooltip, components/modal, components/menu]
---

A sidebar is the app's main navigation panel. `SidebarProvider` holds the open state, the :kbd[Ctrl+B] / :kbd[Cmd+B] shortcut and the `sidebar_state` cookie. `Sidebar` is the panel: it collapses off canvas or to icons on desktop, and becomes a modal sheet below 768px. `SidebarInset` is the page next to it. The parts (`SidebarHeader`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton`, …) match the shadcn/ui Sidebar one to one. They are headless: each renders upstream's element and `data-slot` / `data-sidebar` attributes with a default `rv-Sidebar*` class. The look comes from `@rivetjs/cdk/theme.css` or your CSS. The styled HeroUI version is `@rivetjs/ui/sidebar`.

::example{id=sidebar-07}

:::note
Below 768px the sidebar is a sheet, so a narrow preview frame shows the mobile layout: the trigger opens a dialog. Widen the window or open the example on its own page to see the desktop panel.
:::

## Anatomy

```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Application</SidebarGroupLabel>
        <SidebarGroupAction />
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#">Home</SidebarMenuButton>
              <SidebarMenuAction />
              <SidebarMenuBadge>24</SidebarMenuBadge>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#">Overview</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter />
    <SidebarRail />
  </Sidebar>
  <SidebarInset>
    <SidebarTrigger />
  </SidebarInset>
</SidebarProvider>
```

```html
<div data-slot="sidebar-wrapper" class="rv-SidebarProvider" style="--sidebar-width:16rem;--sidebar-width-icon:3rem">
  <div class="rv-Sidebar" data-slot="sidebar" data-state="expanded" data-collapsible="" data-variant="sidebar" data-side="left">
    <div data-slot="sidebar-gap" class="rv-Sidebar-gap"></div>
    <div data-slot="sidebar-container" data-side="left" class="rv-Sidebar-container">
      <div data-sidebar="sidebar" data-slot="sidebar-inner" class="rv-Sidebar-inner">
        <div data-slot="sidebar-content" data-sidebar="content" class="rv-SidebarContent">…</div>
        <button data-sidebar="rail" data-slot="sidebar-rail" aria-label="Toggle Sidebar" tabindex="-1" title="Toggle Sidebar" class="rv-SidebarRail"></button>
      </div>
    </div>
  </div>
  <main data-slot="sidebar-inset" class="rv-SidebarInset">…</main>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `SidebarProvider` | `<div>` | `rv-SidebarProvider` | `data-slot="sidebar-wrapper"`; sets `--sidebar-width` (16rem) and `--sidebar-width-icon` (3rem); `style` overrides them. |
| `Sidebar` | `<div>` root > gap `<div>` + container `<div>` > inner `<div>` | `rv-Sidebar`, `rv-Sidebar-gap`, `rv-Sidebar-container`, `rv-Sidebar-inner` | Root: `data-state` (`expanded` / `collapsed`), `data-collapsible` (`""` while expanded, else the mode), `data-variant`, `data-side`. `class`, `id` and DOM props land on the container. `collapsible="none"`: one `<div>`. |
| `Sidebar` (mobile) | ModalOverlay > Modal > Dialog | `rv-Sidebar-overlay`, `rv-Sidebar-sheet`, `rv-Sidebar-dialog` | Sheet: `data-mobile="true"`, `data-slot="sidebar"`, `--sidebar-width: var(--sidebar-width-mobile, 18rem)`; a visually hidden title "Sidebar" and description. |
| `SidebarTrigger` | Button | `rv-SidebarTrigger` | Toggles; children = the icon, followed by a visually hidden "Toggle Sidebar" (always rendered, as shadcn; `aria-label` renames it). |
| `SidebarRail` | `<button>` | `rv-SidebarRail` | Thin hit area on the panel edge, `tabindex="-1"`, `aria-label` / `title` "Toggle Sidebar". |
| `SidebarInset` | `<main>` | `rv-SidebarInset` | The page beside the sidebar. |
| `SidebarHeader`, `SidebarFooter`, `SidebarContent` | `<div>` | `rv-SidebarHeader`, `rv-SidebarFooter`, `rv-SidebarContent` | Content scrolls. |
| `SidebarSeparator`, `SidebarInput` | Separator, Input | `rv-SidebarSeparator`, `rv-SidebarInput` | |
| `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent` | `<div>`, `<div>`, `<button>`, `<div>` | `rv-SidebarGroup`, … | |
| `SidebarMenu`, `SidebarMenuItem` | `<ul>`, `<li>` | `rv-SidebarMenu`, `rv-SidebarMenuItem` | |
| `SidebarMenuButton` | Link (with `href`) or Button | `rv-SidebarMenuButton` | `data-size`, `data-variant`, `data-active="true"` when active. |
| `SidebarMenuAction` | Button | `rv-SidebarMenuAction` | `data-show-on-hover="true"` with `showOnHover`. |
| `SidebarMenuBadge`, `SidebarMenuSkeleton` | `<div>` | `rv-SidebarMenuBadge`, `rv-SidebarMenuSkeleton` | Skeleton: `-icon` / `-text` parts, `--skeleton-width`. |
| `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` | `<ul>`, `<li>`, Link or Button | `rv-SidebarMenuSub`, … | Sub button: `data-size` (`sm` / `md`), `data-active`. |

Every part also carries upstream's `data-slot` (`sidebar-header`, `sidebar-menu-button`, …) and `data-sidebar` attributes.

## Import

```tsx
import { Sidebar, SidebarContent, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@rivetjs/cdk/sidebar";
import { sidebarCookieOpen, SIDEBAR_COOKIE_NAME } from "@rivetjs/cdk/sidebar/state";
```

## Props

### SidebarProvider

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `defaultOpen` | `boolean` | `true` | Uncontrolled initial state; pass the cookie value here for SSR ([Persisted state](#persisted-state)). |
| `open` | `boolean \| Signal<boolean> \| () => boolean` | none | Controlled: a plain value or accessor (only `onOpenChange` runs), or a two-way Signal. |
| `onOpenChange` | `(open: boolean) => void` | none | Every change the sidebar makes (trigger, rail, shortcut, `setOpen`). |
| `onKeyDown` | `(event: KeyboardEvent) => void` | none | Runs for keydown inside the wrapper before the toggle shortcut check. |
| `toggleShortcut` | `string \| false` | `"mod+b"` | Rivet: the toggle chord. `mod` = Cmd or Ctrl; `shift` / `alt` must match exactly; the key matches `event.key` or `event.code`. `false` turns it off. |
| `reduceMotion` | `boolean` | `false` | Rivet: no collapse, sheet, sub-menu or page transitions (`data-reduce-motion="true"`). `prefers-reduced-motion: reduce` always applies. |
| `closeMobileOnAction` | `boolean` | `false` | Rivet: pressing a menu button closes the mobile sheet (off = upstream: the sheet stays open; `@rivetjs/ui` turns it on). Group, menu and item levels override it (nearest wins). |
| `side`, `variant`, `collapsible` | as `Sidebar` | none | Rivet: defaults for every `Sidebar` inside; its own props win. |
| `navigate`, `useHref` | `(href, routerOptions) => void`, `(href) => string` | none | Rivet: a [RouterProvider](link.md) for the subtree's links (inline arrow or local function). Not needed with `@rivetjs/router`. |
| `class`, `style`, `children`, `id`, DOM props | | | On the wrapper `<div>`; `style` merges over the width variables. |
| `render` | `(props) => element` | none | Replaces the wrapper `<div>` (upstream `asChild`). |

### Sidebar

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `side` | `"left" \| "right"` or accessor | `"left"` | `data-side`. |
| `variant` | `"sidebar" \| "floating" \| "inset"` or accessor | `"sidebar"` | `data-variant`; `inset` pairs with `SidebarInset`. |
| `collapsible` | `"offcanvas" \| "icon" \| "none"` or accessor | `"offcanvas"` | Collapsed mode, in `data-collapsible`. `none` is read once and renders a plain panel. |
| `backdrop` | `"blur" \| "opaque" \| "transparent"` | `"blur"` | Rivet: the mobile sheet's overlay, `data-backdrop`. |
| `class`, `style`, `id`, DOM props | | | On the container (desktop) or the sheet (mobile). Set `--sidebar-width-mobile` here: the sheet is outside the provider. |
| `rootClass`, `gapClass`, `innerClass` | `string` | `rv-Sidebar`, `rv-Sidebar-gap`, `rv-Sidebar-inner` | Desktop parts. |
| `overlayClass`, `sheetClass`, `dialogClass` | `string` | `rv-Sidebar-overlay`, `rv-Sidebar-sheet`, `rv-Sidebar-dialog` | Mobile parts. |
| `render` | `(props) => element` | none | Replaces the container (desktop) or the `collapsible="none"` panel. |
| `resizable` | `boolean` | `false` | Rivet: a window-splitter resize handle on the panel's inner edge (see Resizing). |
| `width` | `number \| string`, `Signal` or accessor | none | Rivet: controlled width (px number or CSS length; signal = two-way). Undefined = the provider's `--sidebar-width`. |
| `defaultWidth` | `number \| string` | none | Rivet: initial width; double-click on the handle resets to it (else to the provider's `--sidebar-width`). |
| `onWidthChange` / `onWidthChangeEnd` | `(px: number) => void` | none | Rivet: every change (live, during a drag) / once per drag or key press. |
| `minWidth` / `maxWidth` | `number \| string` | `"12rem"` / `"28rem"` | Rivet: bounds (px, `rem`, `em`, `vw`, `%`). |
| `collapseBelowMin` | `boolean` | `true` | Rivet: dragging below half `minWidth` collapses (`setSidebarOpen(false)`), dragging back out re-opens. |
| `resizeStep` | `number` | `16` | Rivet: arrow-key step in px (Shift: ×5). |
| `resizeHandleClass`, `resizeHandleLabel` | `string` | `rv-SidebarResizeHandle`, `"Resize sidebar"` | Rivet: handle class / `aria-label`. |

### Menu buttons

| Prop | Part | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `href` | `SidebarMenuButton`, `SidebarMenuSubButton` | `string` | none | Renders a cdk Link; without it, a cdk Button (`onPress`, `slot`, `isDisabled`, …). |
| `isActive` | both | `boolean` or accessor | `false` | `data-active="true"`. |
| `isCurrent` | both | `boolean` or accessor | none | Rivet: `aria-current="page"`, and `data-active` when `isActive` is unset. |
| `forceReload` | both (links) | `boolean` | `false` | Rivet: `data-rivet-reload` and the native router: the link loads a full document. External `http(s)` hrefs get `target="_blank"` + `rel="noopener noreferrer"` unless `target` is set. |
| `closeMobileOnAction` | both | `boolean` | inherited | Rivet: close the mobile sheet on press. |
| `size` | `SidebarMenuButton` | `"default" \| "sm" \| "lg"` | `"default"` | `data-size`. |
| `size` | `SidebarMenuSubButton` | `"sm" \| "md"` | `"md"` | `data-size`. |
| `variant` | `SidebarMenuButton` | `"default" \| "outline"` | `"default"` | `data-variant`. |
| `tooltip` | `SidebarMenuButton` | `string \| TooltipProps` | none | A [Tooltip](tooltip.md) on the right, shown only while collapsed on desktop. |
| `showOnHover` | `SidebarMenuAction` | `boolean` | `false` | `data-show-on-hover="true"`: CSS hides it until the item is hovered or focused. |
| `showIcon`, `iconClass`, `textClass` | `SidebarMenuSkeleton` | | `false` | Icon placeholder and part classes; the text width is random (50–90%). |
| `showOnHover` | `SidebarMenuActions` | `boolean` | `false` | Rivet: a `role="group"` of several `SidebarMenuAction`s at the item's end. |

### Tree items (Rivet)

| Prop | Part | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `expandable` | `SidebarMenuItem`, `SidebarMenuSubItem` | `boolean` | `false` | The item is a [Disclosure](disclosure.md) `<li>` (`data-expandable="true"`): its `SidebarMenuTrigger` toggles its `SidebarMenuSub`. |
| `defaultExpanded`, `isExpanded`, `onExpandedChange`, `isDisabled` | same | | | Disclosure state; any of the first two implies `expandable`. `isExpanded` takes a value, a two-way Signal or an accessor. |
| `showGuideLines` | `SidebarMenu` | `boolean \| "hover"` | `true` | The line along nested sub menus: always, on menu hover / focus, or never (`data-guide-lines`). |
| `closeMobileOnAction`, `reduceMotion` | `SidebarMenu` (`SidebarGroup`: the first) | `boolean` | inherited | For the items inside. |
| `panelClass` | `SidebarMenuSub` | `string` | `rv-SidebarMenuSub-panel` | Inside an expandable item the sub menu sits in the animated panel (`--disclosure-panel-height`). |

`SidebarMenuTrigger` takes the `SidebarMenuButton` props without `href` (it is the `slot="trigger"` button and never closes the sheet). `SidebarMenuIndicator` is an `aria-hidden` `<span>` for your chevron; `theme.css` rotates it 90° while `[aria-expanded="true"]`.

### Pages (Rivet)

| Prop | Part | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `value` | `SidebarPages` | `string`, Signal or accessor | none | The active page (Signal = two-way). |
| `defaultValue`, `onValueChange` | `SidebarPages` | | first page | Uncontrolled start; called on every switch. |
| `reduceMotion` | `SidebarPages` | `boolean` | inherited | Switch without the slide. |
| `value` | `SidebarPage` | `string` | required | The page key; `data-value`, `data-active`. |

`useSidebarPages()` (inside `SidebarPages`) returns `{ activeValue(), setActiveValue(value), activeIndex(), order() }`. The pages share one grid cell; a switch slides both with `@rivetjs/cdk/motion` (Embla's physics), then the leaving page gets `hidden`. Inactive pages are `inert` + `aria-hidden`; focus moves into the entering page.

`SidebarTrigger` and `SidebarMenuAction` take [Button](button.md) props, `SidebarInput` Input props, `SidebarSeparator` [Separator](separator.md) props. The structural parts take `class` (string or function), `style`, `children`, `id`, `ref`, `render`, `aria-*` and the global DOM props.

### useSidebar

`useSidebar()` (inside a provider; throws outside) returns accessors and setters:

| Member | Type | Notes |
| --- | --- | --- |
| `state()` | `"expanded" \| "collapsed"` | |
| `open()`, `setOpen(value)` | `boolean` | `setOpen` takes a value or an updater; writes the cookie. |
| `openMobile()`, `setOpenMobile(value)` | `boolean` | The mobile sheet. |
| `isMobile()` | `boolean` | Viewport below 768px; `false` on the server and until the page loads. |
| `toggleSidebar()` | | The sheet on mobile, else the sidebar. |

## Grouped navigation

Labelled groups of links, a version menu in the header and a search input (shadcn block sidebar-01).

::example{id=sidebar-01}

## Submenus

`SidebarMenuSub` nests a list under an item (sidebar-03).

::example{id=sidebar-03}

## Tree menu

Rivet extension: an `expandable` item makes its `SidebarMenuTrigger` the disclosure button and its `SidebarMenuSub` the animated panel; sub items nest the same way. `showGuideLines="hover"` shows the guide line only while the menu is hovered. The example also has a badge, a `SidebarMenuActions` group and a client router through the provider's `navigate`, with `isCurrent` links.

::example{id=sidebar-tree}

```tsx
<SidebarMenuItem defaultExpanded>
  <SidebarMenuTrigger>
    <span>Projects</span>
    <SidebarMenuIndicator>
      <Icon icon={ChevronRight} />
    </SidebarMenuIndicator>
  </SidebarMenuTrigger>
  <SidebarMenuSub>…</SidebarMenuSub>
</SidebarMenuItem>
```

## Pages and shortcut

Rivet extension: `SidebarPages` shows one `SidebarPage` and slides between them (drill in / back). `toggleShortcut="alt+s"` replaces Cmd/Ctrl+B; `backdrop="opaque"` sets the mobile overlay.

::example{id=sidebar-pages}

## Collapsible groups

Without the tree props the parts also compose with a [Disclosure](disclosure.md): give the menu button (or a `SidebarMenuAction`, or a `SidebarGroupLabel` rendered as a Button) `slot="trigger"` and wrap the sub menu in a `DisclosurePanel`. The sidebar-07 example at the top does this with tooltips; sidebar-08 below toggles from an action and renders the `Disclosure` as the `<li>`:

```tsx
<Disclosure render={(props) => <li {...(props as {})} data-slot="sidebar-menu-item" />}>…</Disclosure>
```

## Inset

`variant="inset"` lays the page out as a raised `SidebarInset` panel (sidebar-08).

::example{id=sidebar-08}

## In a dialog

A provider can live anywhere, here inside a [Modal](modal.md) with `collapsible="none"` (sidebar-13).

::example{id=sidebar-13}

## Controlled

A Signal as `open` is two-way: the trigger, the rail and the shortcut write it, and your code can set it. `side` and `variant` accept accessors.

::example{id=sidebar-controlled}

## Persisted state

Every change writes `sidebar_state=<open>; path=/; max-age=604800`. To render the saved state on the server, read the cookie in a route loader and pass it as `defaultOpen`:

```ts
// src/routes/index.server.ts
import type { RequestEvent } from "@rivetjs/router";
import { sidebarCookieOpen } from "@rivetjs/cdk/sidebar/state";
import { load } from "@rivetjs/router";

export const loader = load(({ cookies }: RequestEvent) => ({ open: sidebarCookieOpen(cookies) ?? true }));
```

```tsx
<SidebarProvider defaultOpen={data.open}>…</SidebarProvider>
```

`sidebarCookieOpen` accepts a cookie map (`get(name)`), a `Cookie` header string or the raw value, and returns `undefined` when the cookie is missing.

## Mobile

Below 768px (`MOBILE_BREAKPOINT`) the `Sidebar` content moves into a dismissable modal sheet on the shared overlay layer. The trigger and the shortcut toggle the sheet; :kbd[Escape] or a press outside closes it. The sheet opens and closes with the overlay `data-entering` / `data-exiting` transition. A sideways drag on the sheet follows the pointer and, on release, the throw decides: a flick towards the closed edge or a drag past half the sheet width dismisses it, otherwise it settles back. The physics are `@rivetjs/cdk/motion` (Embla's), `prefers-reduced-motion` jumps. A vertical move scrolls the content, and a drag never presses the item it started on.

## Resizing

Rivet extension (shadcn has no resize handle). `resizable` renders `[data-slot="sidebar-resize-handle"]` inside the root: a pointer drag sets `--sidebar-width` on `.rv-Sidebar` (gap and container follow it; `data-resizing` turns their transition off while the width follows the pointer), clamped to `minWidth` / `maxWidth`. Below half the minimum the sidebar collapses with its normal transition and re-opens when dragged back out. Double-click resets. The handle is mirrored for `side="right"` and RTL. Nothing is persisted: save `onWidthChangeEnd` (cookie, storage) and pass it back as `defaultWidth`.

## DOM events and attributes

`id`, `class`, `style` and the DOM props of `Sidebar` land on the desktop container or on the mobile sheet. On every other part they land on its root. `SidebarTrigger` runs your `onPress` first, then toggles. `SidebarRail` toggles, then runs your `onClick`.

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-Sidebar[data-state="collapsed"]` | A collapsed sidebar (Tailwind `group-data-[state=collapsed]:` with `group` on the root). |
| `.rv-Sidebar[data-collapsible="offcanvas" \| "icon"]` | The collapsed mode while collapsed. |
| `.rv-Sidebar[data-variant]`, `[data-side]` | Variant and side. |
| `.rv-Sidebar[data-variant="inset"] ~ .rv-SidebarInset` | The inset page. |
| `[data-slot="sidebar-menu-button"][data-active="true"]` | The current item. |
| `[data-mobile="true"]` | The mobile sheet. |
| `.rv-SidebarResizeHandle`, `[data-dragging="true"]`, `.rv-Sidebar[data-resizing="true"]` | The resize handle, during a drag, and the root while the width follows the pointer. |

`@rivetjs/cdk/theme.css` has the full layout of upstream's Tailwind classes: widths, the off-canvas slide, icon mode, floating and inset variants, the rail, the menus and the sheet slide. Without it (or your own rules) the state attributes change but nothing moves. The examples use it with Tailwind for the content.

## Accessibility

- The trigger and the rail are named "Toggle Sidebar". The rail is out of the tab order, because the trigger is the keyboard path.
- The mobile sheet is a modal dialog named "Sidebar" and described as "Displays the mobile sidebar.". Focus is trapped inside it.
- Menu buttons are links or buttons in `<ul>` / `<li>` lists. Tooltips repeat the label while only icons show.
- Tree items follow the WAI-ARIA disclosure navigation pattern (not `role="tree"`): each `SidebarMenuTrigger` is a button with `aria-expanded` / `aria-controls` pointing at its panel. `isCurrent` sets `aria-current="page"`.
- Pages are `role="group"` with your `aria-label`; the inactive one is `inert`.
- The `resizable` handle is a focusable window splitter: `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` / `aria-valuemin` / `aria-valuemax` in px, named "Resize sidebar".

| Key | Action |
| --- | --- |
| :kbd[Ctrl+B] / :kbd[Cmd+B] | Toggles the sidebar (the sheet on mobile); `toggleShortcut` changes it. |
| :kbd[Tab] | Moves through the trigger, menu buttons and actions. |
| :kbd[Enter], :kbd[Space] | Activates the focused button or link; on a tree trigger, expands / collapses. |
| :kbd[Escape] | Closes the mobile sheet. |
| :kbd[ArrowLeft], :kbd[ArrowRight] | On the resize handle: narrower / wider by `resizeStep` (Shift: ×5; mirrored for the right side and RTL). |
| :kbd[Home], :kbd[End] | On the resize handle: `minWidth` / `maxWidth`. |
| :kbd[Enter] | On the resize handle: collapses / expands. |

## Resumability

- The server renders the final `data-state` / `data-collapsible`, from `defaultOpen` (the cookie) or `open`.
- Nothing runs at load. The viewport width is read on every toggle and by a `(max-width: 767px)` media listener attached once the runtime runs. Before the first toggle, CSS hides the desktop sidebar below 768 px.
- :kbd[Cmd]+:kbd[B] / :kbd[Ctrl]+:kbd[B] works on a cold page while focus is inside the provider. With focus on `<body>`, it works once the runtime runs.
- The provider's handler code, and the code of every binding that reads the sidebar state, is fetched when the provider is visible. It runs only on an interaction, so the first click needs no further download.
- Tree items resume as Disclosures (the panel height animates once the runtime runs); pages resume with their active value. Nothing extra runs before the first interaction, and a page without `SidebarPages` loads no pages code.
- The resize handle renders the server width (`width` / `defaultWidth`, else no inline variable) and runs nothing until a pointer down, key or focus on it.
- Callbacks (`onOpenChange`, `onPress`, `onExpandedChange`, `onValueChange`, `onWidthChange`, `onWidthChangeEnd`, `navigate`) are inline arrows or local consts; `render` is an inline arrow.

## Upstream

Ports the shadcn/ui Sidebar (release `shadcn@4.21.4`, MIT): `registry/new-york-v4/ui/sidebar.tsx` and `hooks/use-mobile.ts`, with the button / link / tooltip / sheet parts of the React Aria base (`registry/bases/aria/ui/sidebar.tsx`). The examples port the blocks sidebar-01, -03, -07, -08 and -13.

Deviations:

- `render` replaces `asChild`.
- `data-active` / `data-show-on-hover` are `"true"` or absent.
- `SidebarMenuButton` `variant` and `SidebarMenuAction` `showOnHover` set attributes instead of classes.
- `useSidebar()` returns accessors.
- On mobile the empty desktop root stays in the DOM.
- The mobile sheet focuses its dialog when it opens (React Aria `Dialog`; upstream Radix focuses the first tabbable) and gives focus back to the trigger on close.
- Rivet additions (no upstream counterpart): swipe-to-dismiss on the sheet, tree items, `SidebarMenuActions`, `isCurrent` / `forceReload`, pages, `toggleShortcut`, `reduceMotion`, `closeMobileOnAction`, provider-level `side` / `variant` / `collapsible`, `navigate`, `backdrop`.
