---
title: Sidebar
description: "A composable, themeable and collapsible app sidebar."
template: reference
status: experimental
related: [components/button, components/tooltip, components/separator]
---

`Sidebar` is the app-shell navigation panel: collapsible to an icon rail or off-canvas, a modal sheet on mobile, keyboard shortcut and cookie-persisted state. Behaviour and parts come from the [cdk Sidebar](site:cdk/components/sidebar/), a port of the shadcn/ui Sidebar; this package adds the Rivet UI look.

:::note
API + behaviour = [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar) (`shadcn@4.21.4`, MIT, © 2023 shadcn); styles use the theme tokens (surfaces, separators, radii, focus ring, menu-item states).
:::

Rivet differences from shadcn/ui:

- Compound parts (`Sidebar.Menu`, `Sidebar.MenuButton`, …) next to the named exports (`SidebarMenu`, …). `class`, not `className`; `render` instead of `asChild`.
- `open` takes a value, a two-way signal or an accessor; `onOpenChange` must be an inline arrow or a local function (resumable).
- The mobile sheet is a cdk `Modal` on Rivet's div overlay layer (no Radix Dialog); it slides with a CSS transition. Rivet adds swipe-to-dismiss: a sideways drag follows the pointer and the release velocity decides close vs settle back (`@rivetjs/cdk/motion`, Embla's physics).
- `data-active` is `"true"` or absent (shadcn writes `"false"` too).
- Rivet extensions on the same API: tree items (`expandable` items, `Sidebar.MenuTrigger`, `Sidebar.MenuIndicator`, guide lines), `Sidebar.MenuChip`, `Sidebar.MenuActions`, `isCurrent` / `forceReload` links, `Sidebar.Pages`, a configurable `toggleShortcut`, `reduceMotion`, `closeMobileOnAction`, provider-level `side` / `variant` / `collapsible` defaults, a client router (`navigate`), the sheet `backdrop` and a resize handle (`resizable`).

Accessibility: `Sidebar.Trigger` and `Sidebar.Rail` are labelled "Toggle Sidebar"; Cmd/Ctrl+B toggles (`toggleShortcut`). Tree items follow the WAI-ARIA disclosure navigation pattern: each `Sidebar.MenuTrigger` is a button with `aria-expanded` / `aria-controls`, Tab moves between items, Enter / Space toggles (no `role="tree"`: the menu stays a list of links). On mobile the sheet is a modal dialog titled "Sidebar" (visually hidden) with focus containment and Escape to close. Collapsed icon-mode menu buttons show their `tooltip`. The `resizable` handle is a focusable window splitter (`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` / `-min` / `-max` in px, labelled "Resize sidebar").

## Usage

```tsx
import { Sidebar } from "@rivetjs/ui/sidebar";
```

Styles: `@import "@rivetjs/ui/styles";` (the sidebar CSS ships in the bundle).

Below 768px the sidebar is a sheet: a narrow preview frame shows the mobile layout, where the trigger opens a dialog. Widen the window or open an example on its own page for the desktop panel.

::example{id=sidebar-basic}

## Anatomy

```tsx
import { Sidebar } from "@rivetjs/ui/sidebar";

export default () => (
  <Sidebar.Provider>
    <Sidebar>
      <Sidebar.Header />
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel />
          <Sidebar.GroupAction />
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton />
                <Sidebar.MenuAction />
                <Sidebar.MenuBadge />
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton />
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer />
      <Sidebar.Rail />
    </Sidebar>
    <Sidebar.Inset>
      <Sidebar.Trigger />
    </Sidebar.Inset>
  </Sidebar.Provider>
);
```

## Examples

### Complex app shell

A workspace header with an avatar, a navigation group with a chip, a project tree with guide lines, hover actions, current-page links and a user footer.

::example{id=sidebar-app-shell}

### Compact with user menu

`collapsible="icon"` on the provider (a default every `Sidebar` inside reads); the footer menu button opens a `Dropdown` user menu.

::example{id=sidebar-compact-user}

### Groups

Groups split the menu under labels. `closeMobileOnAction={false}` on a group keeps the mobile sheet open when its items are pressed (provider, group, menu and item accept it; the nearest wins).

::example{id=sidebar-groups}

### Collapsible groups (tree)

An `expandable` (or `defaultExpanded` / `isExpanded`) `Sidebar.MenuItem` turns its `Sidebar.MenuTrigger` into the disclosure button and its `Sidebar.MenuSub` into the animated panel; `Sidebar.MenuIndicator` rotates when open. Sub items nest the same way. `showGuideLines` on `Sidebar.Menu`: `true` (default), `"hover"` or `false`.

::example{id=sidebar-collapsible-groups}

```tsx
<Sidebar.Menu showGuideLines="hover">
  <Sidebar.MenuItem defaultExpanded>
    <Sidebar.MenuTrigger>
      <Icon icon={BookOpen} size={16} />
      <span>Guides</span>
      <Sidebar.MenuIndicator />
    </Sidebar.MenuTrigger>
    <Sidebar.MenuSub>
      <Sidebar.MenuSubItem>
        <Sidebar.MenuSubButton href="#start" isCurrent>
          Getting started
        </Sidebar.MenuSubButton>
      </Sidebar.MenuSubItem>
    </Sidebar.MenuSub>
  </Sidebar.MenuItem>
</Sidebar.Menu>
```

### Pages

`Sidebar.Pages` shows one `Sidebar.Page` at a time and slides between them (drill in / back); `value` takes a value, a two-way signal or an accessor, with `defaultValue` / `onValueChange`. `useSidebarPages()` inside returns `{ activeValue, setActiveValue, activeIndex, order }`. Inactive pages are `hidden` + `inert`; focus moves into the entering page. Reduced motion switches instantly.

::example{id=sidebar-pages}

```tsx
const page = signal("main");
<Sidebar.Pages value={page}>
  <Sidebar.Page value="main" aria-label="Main">
    …
  </Sidebar.Page>
  <Sidebar.Page value="settings" aria-label="Settings">
    …
  </Sidebar.Page>
</Sidebar.Pages>;
```

### Keyboard shortcut

`toggleShortcut` sets the toggle chord (`"mod+b"` default; `mod` = Cmd or Ctrl, plus `shift` / `alt`); `false` turns it off.

::example{id=sidebar-shortcut}

```tsx
<Sidebar.Provider toggleShortcut="mod+shift+s">…</Sidebar.Provider>
```

### Reduced motion

`reduceMotion` turns off the collapse, sheet, sub-menu and page transitions for the whole sidebar (`prefers-reduced-motion: reduce` always does). `Sidebar.Menu reduceMotion` scopes it to one menu.

::example{id=sidebar-reduced-motion}

### Right side

`side="right"` on the provider mirrors the panel, sheet and rail; here with `variant="floating"`.

::example{id=sidebar-right}

### Resizable

`resizable` adds a window-splitter handle on the panel's inner edge (Rivet extension; shadcn has none). Drag it to resize between `minWidth` and `maxWidth` (`12rem` / `28rem` default); dragging below half the minimum collapses the sidebar (`collapsible="icon"` or `"offcanvas"`), and dragging back out re-opens it. The handle is a focusable `role="separator"`: arrow keys step 16 px (Shift: 80 px, mirrored in RTL), Home / End jump to the bounds, Enter toggles collapse; double-click resets to `defaultWidth` (or the provider's `--sidebar-width`). The width lives in `--sidebar-width` on the panel; nothing is persisted unless you do it.

::example{id=sidebar-resizable}

```tsx
<Sidebar collapsible="icon" resizable minWidth="12rem" maxWidth="24rem" onWidthChange={(px) => width.set(px)}>
  …
</Sidebar>
```

Persist the width the same way as the open state: save it in `onWidthChangeEnd` (once per drag / key press) and pass it back as `defaultWidth`.

```tsx
<Sidebar resizable defaultWidth={data.width ?? "16rem"} onWidthChangeEnd={(px) => (document.cookie = `sidebar_width=${px}; path=/; max-age=604800`)}>
  …
</Sidebar>
```

### Client-side routing

`navigate` on the provider routes menu links in the document (cdk `RouterProvider` for the subtree; with `@rivetjs/router` links already route, so omit it). `isCurrent` sets `aria-current="page"` + `data-active`; `forceReload` makes a link load a full document; external `http(s)` links open in a new tab unless `target` is set.

::example{id=sidebar-routing}

```tsx
<Sidebar.Provider navigate={(href) => router.push(href)}>
  <Sidebar.MenuButton href="/billing" isCurrent={() => path() === "/billing"}>
    Billing
  </Sidebar.MenuButton>
  <Sidebar.MenuButton href="/legacy" forceReload>
    Legacy app
  </Sidebar.MenuButton>
</Sidebar.Provider>
```

### With avatar

Any content goes in a menu button: an `Avatar` in a `size="lg"` header or footer button (see the app shell and compact examples).

```tsx
<Sidebar.Header>
  <Sidebar.Menu>
    <Sidebar.MenuItem>
      <Sidebar.MenuButton size="lg" tooltip="Acme">
        <Avatar size="sm" color="accent">
          <Avatar.Fallback>AC</Avatar.Fallback>
        </Avatar>
        <span>Acme</span>
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  </Sidebar.Menu>
</Sidebar.Header>
```

### Icon only (collapsible to icons)

`collapsible="icon"` shrinks the panel to `--sidebar-width-icon`; menu buttons show their `tooltip` while collapsed.

::example{id=sidebar-icon}

```tsx
<Sidebar collapsible="icon">
  <Sidebar.Content>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton tooltip="Inbox">
          <Icon icon={Inbox} size={16} />
          <span>Inbox</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar>
```

### Contained in a panel

By default the sidebar panel is fixed to the viewport. `contained` on `Sidebar.Provider` keeps it inside the provider instead: the provider becomes the positioning box (`relative`, clipped), the panel fills its height, and the sidebar and inset take the provider's background. Use it for an app shell inside a card or a page section (the mail, music and chat showcases). Give the provider (or its parent) a height. The mobile sheet is unchanged.

::example{id=sidebar-contained}

```tsx
<Card class="h-80 overflow-hidden p-0">
  <Sidebar.Provider contained class="h-full">
    <Sidebar collapsible="icon">…</Sidebar>
    <Sidebar.Inset>…</Sidebar.Inset>
  </Sidebar.Provider>
</Card>
```

### Floating and inset (variants)

`variant="sidebar"` (default, edge panel with a separator border), `"floating"` (raised surface card), `"inset"` (content sits in an inset surface card; use with `Sidebar.Inset`). `side="right"` mirrors.

::example{id=sidebar-variants}

### Menu button sizes and outline

`size="sm" | "default" | "lg"`, `variant="outline"`; `isActive` marks the current page (`data-active="true"`).

::example{id=sidebar-menu-buttons}

### Sub menus, actions, badges and chips

`Sidebar.MenuChip` is a `Chip` (soft, accent by default; `color`, `variant`) in the badge slot; `Sidebar.MenuActions` groups several `Sidebar.MenuAction`s (`showOnHover`).

A badge or chip next to menu actions is never drawn under them: a `showOnHover` action takes the badge's place while the item is hovered, focused or its menu is open (the badge fades out); an action that is always visible (no `showOnHover`, or any action below 768 px, where hover is unavailable) moves the badge before it. Collapsed to icons, badges, chips and actions are hidden.

::example{id=sidebar-submenu}

```tsx
<Sidebar.MenuItem>
  <Sidebar.MenuButton>
    <Icon icon={Folder} size={16} />
    <span>Projects</span>
  </Sidebar.MenuButton>
  <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
  <Sidebar.MenuAction showOnHover aria-label="More">
    <Icon icon={Ellipsis} size={16} />
  </Sidebar.MenuAction>
  <Sidebar.MenuSub>
    <Sidebar.MenuSubItem>
      <Sidebar.MenuSubButton href="#design">Design</Sidebar.MenuSubButton>
    </Sidebar.MenuSubItem>
  </Sidebar.MenuSub>
</Sidebar.MenuItem>
```

```tsx
<Sidebar.MenuItem>
  <Sidebar.MenuButton href="#inbox">Inbox</Sidebar.MenuButton>
  <Sidebar.MenuChip color="danger">3</Sidebar.MenuChip>
  <Sidebar.MenuActions showOnHover aria-label="Inbox actions">
    <Sidebar.MenuAction aria-label="Mark all read">
      <Icon icon={CheckCheck} size={14} />
    </Sidebar.MenuAction>
    <Sidebar.MenuAction aria-label="Archive">
      <Icon icon={Archive} size={14} />
    </Sidebar.MenuAction>
  </Sidebar.MenuActions>
</Sidebar.MenuItem>
```

### Loading skeleton

::example{id=sidebar-skeleton}

```tsx
<Sidebar.Menu>
  {[1, 2, 3].map(() => (
    <Sidebar.MenuItem>
      <Sidebar.MenuSkeleton showIcon />
    </Sidebar.MenuItem>
  ))}
</Sidebar.Menu>
```

### Controlled

::example{id=sidebar-controlled}

```tsx
const open = signal(true);
<Sidebar.Provider open={open}>…</Sidebar.Provider>;
```

### Persisted state (cookie)

Toggling writes the `sidebar_state` cookie (7 days, as shadcn). Read it on the server so the first paint matches:

```ts
// src/routes/_layout.server.ts
import type { RequestEvent } from "@rivetjs/router";
import { sidebarCookieOpen } from "@rivetjs/ui/sidebar";
import { load } from "@rivetjs/router";

export const loader = load(({ cookies }: RequestEvent) => ({ open: sidebarCookieOpen(cookies) ?? true }));
```

```tsx
<Sidebar.Provider defaultOpen={data.open}>…</Sidebar.Provider>
```

### useSidebar

`useSidebar()` returns `{ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }` (accessors / functions) inside a provider.

## Customization

### Width

Set the CSS variables on `Sidebar.Provider` `style`: `--sidebar-width` (16rem), `--sidebar-width-icon` (3rem). The mobile sheet width `--sidebar-width-mobile` (18rem) goes on `Sidebar` `style` (the sheet is portaled out of the wrapper).

```tsx
<Sidebar.Provider style={{ "--sidebar-width": "20rem" }}>…</Sidebar.Provider>
```

### Tailwind CSS

```tsx
<Sidebar class="border-none" variant="floating">
  <Sidebar.MenuButton class="rounded-full">…</Sidebar.MenuButton>
</Sidebar>
```

### Global CSS

```css
@layer components {
  .sidebar__inner {
    @apply bg-surface-secondary;
  }

  .sidebar__menu-button[data-active="true"] {
    @apply bg-accent-soft text-accent-soft-foreground;
  }
}
```

## Styling Reference

BEM classes (Rivet-authored, `libs/ui/styles/components/sidebar.css`).

### CSS Classes

#### Layout

- `.sidebar-wrapper` - Provider wrapper (CSS variables; secondary background when it holds an `inset` sidebar); `.sidebar-wrapper--contained` with `contained` (panel absolute inside it, transparent sidebar / inset backgrounds)
- `.sidebar` - Root (`data-state`, `data-collapsible`, `data-variant`, `data-side`; static panel when `collapsible="none"`)
- `.sidebar__gap` - Space reserved in the layout flow (animates width)
- `.sidebar__container` - Fixed panel
- `.sidebar__inner` - Panel surface (floating: rounded surface + shadow)
- `.sidebar__rail` - Edge hit area that toggles
- `.sidebar__resize-handle` - `resizable` window-splitter handle (`::after` = divider line)
- `.sidebar__inset` - Main content (`inset` variant: rounded surface card)
- `.sidebar__trigger` - Toggle button (ghost icon button)
- `.sidebar__sheet`, `.sidebar__sheet-backdrop`, `.sidebar__sheet-dialog` - Mobile sheet

#### Content

- `.sidebar__header`, `.sidebar__footer`, `.sidebar__content`, `.sidebar__separator`, `.sidebar__input`
- `.sidebar__group`, `.sidebar__group-label`, `.sidebar__group-action`, `.sidebar__group-content`
- `.sidebar__menu`, `.sidebar__menu-item`, `.sidebar__menu-button` (+ `--sm`, `--lg`, `--outline`), `.sidebar__menu-action`, `.sidebar__menu-badge`
- `.sidebar__menu-skeleton` (+ `-icon`, `-text`), `.sidebar__menu-sub`, `.sidebar__menu-sub-item`, `.sidebar__menu-sub-button` (+ `--sm`)
- `.sidebar__menu-indicator` - Tree indicator (rotates on `[aria-expanded="true"]`), `.sidebar__menu-sub-panel` - Animated sub-menu panel
- `.sidebar__menu-actions` - Action group, `.sidebar__menu-chip` - Chip in the badge slot
- `.sidebar__pages`, `.sidebar__page` - Pages container / page
- `.sidebar__tooltip` - Collapsed menu-button tooltip (tooltip classes + this)

### Interactive States

- **Collapsed**: `.sidebar[data-state="collapsed"]` with `[data-collapsible="icon" | "offcanvas"]`
- **Active**: `[data-active="true"]` on menu / sub buttons
- **Hover / Pressed**: `:hover` / `[data-hovered="true"]`, `[data-pressed="true"]` (scale 0.98)
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` / `[aria-disabled="true"]`
- **Sheet**: `[data-entering]` / `[data-exiting]` slide transitions; `[data-mobile="true"]` on the sheet root; `.sidebar__sheet-backdrop[data-backdrop="blur" | "opaque" | "transparent"]`
- **Tree**: `[data-expandable="true"]` items, `[aria-expanded]` triggers; guide lines off / on hover: `.sidebar__menu[data-guide-lines="none" | "hover"]`
- **Badge next to actions**: `.sidebar__menu-badge` / `.sidebar__menu-chip` fade out (`opacity: 0`) while a `showOnHover` action shows; before an always-visible action they move to `calc(var(--sidebar-menu-actions-width) + 0.5rem)` from the end (set per `Sidebar.MenuActions` count)
- **Reduced motion**: `[data-reduce-motion="true"]` on the wrapper / menu
- **Resizing**: `.sidebar[data-resizing="true"]` while a drag follows the pointer (gap / container transitions off); `.sidebar__resize-handle[data-dragging="true"]` during a drag

## API Reference

### Sidebar.Provider

| Prop                               | Type                                            | Default   | Description                                                           |
| ---------------------------------- | ----------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `defaultOpen`                      | `boolean`                                       | `true`    | Initial open state (uncontrolled)                                     |
| `open`                             | `boolean \| Signal<boolean> \| (() => boolean)` | -         | Controlled open state (signal = two-way)                              |
| `onOpenChange`                     | `(open: boolean) => void`                       | -         | Called when the open state changes                                    |
| `toggleShortcut`                   | `string \| false`                               | `"mod+b"` | Toggle chord (`mod` = Cmd/Ctrl, `shift`, `alt`); `false` = off        |
| `reduceMotion`                     | `boolean`                                       | `false`   | No sidebar transitions (collapse, sheet, sub menus, pages)            |
| `closeMobileOnAction`              | `boolean`                                       | `true`    | Close the mobile sheet when a menu item is pressed                    |
| `contained`                        | `boolean`                                       | `false`   | Panel inside the provider (not the viewport); read once               |
| `side` / `variant` / `collapsible` | as `Sidebar`                                    | -         | Defaults for every `Sidebar` inside (its own props win)               |
| `navigate`                         | `(href, routerOptions) => void`                 | -         | Client router for the subtree's links (inline arrow / local function) |
| `useHref`                          | `(href) => string`                              | -         | Maps router hrefs to DOM hrefs (with `navigate`)                      |
| `class`                            | `string`                                        | -         | Additional CSS classes                                                |
| `style`                            | `StyleObject`                                   | -         | Merged after `--sidebar-width` variables                              |

### Sidebar

| Prop                    | Type                                                                     | Default                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| `side`                  | `"left" \| "right"`                                                      | `"left"`                   | Edge of the viewport                                         |
| `variant`               | `"sidebar" \| "floating" \| "inset"`                                     | `"sidebar"`                | Visual variant                                               |
| `collapsible`           | `"offcanvas" \| "icon" \| "none"`                                        | `"offcanvas"`              | Collapse behaviour                                           |
| `backdrop`              | `"blur" \| "opaque" \| "transparent"`                                    | `"blur"`                   | Mobile sheet backdrop                                        |
| `class`                 | `string`                                                                 | -                          | Classes of the panel                                         |
| `resizable`             | `boolean`                                                                | `false`                    | Window-splitter resize handle (Rivet extension)              |
| `width`                 | `number \| string \| Signal<number \| string \| undefined> \| (() => …)` | -                          | Controlled width (px number or CSS length; signal = two-way) |
| `defaultWidth`          | `number \| string`                                                       | provider `--sidebar-width` | Initial width; double-click resets to it                     |
| `onWidthChange`         | `(px: number) => void`                                                   | -                          | Every width change (live, during a drag)                     |
| `onWidthChangeEnd`      | `(px: number) => void`                                                   | -                          | Once per drag / key press (persist here)                     |
| `minWidth` / `maxWidth` | `number \| string`                                                       | `"12rem"` / `"28rem"`      | Bounds (px, `rem`, `em`, `vw`, `%`)                          |
| `collapseBelowMin`      | `boolean`                                                                | `true`                     | Dragging below half `minWidth` collapses                     |
| `resizeStep`            | `number`                                                                 | `16`                       | Arrow-key step in px (Shift: ×5)                             |
| `resizeHandleLabel`     | `string`                                                                 | `"Resize sidebar"`         | Handle `aria-label`                                          |

### Sidebar.MenuButton

| Prop                  | Type                         | Default     | Description                                                      |
| --------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------- |
| `isActive`            | `boolean \| (() => boolean)` | `false`     | Current page (`data-active="true"`)                              |
| `isCurrent`           | `boolean \| (() => boolean)` | -           | `aria-current="page"` (+ `data-active` unless `isActive` is set) |
| `forceReload`         | `boolean`                    | `false`     | The link loads a full document (no client routing)               |
| `closeMobileOnAction` | `boolean`                    | inherited   | Close the mobile sheet on press                                  |
| `size`                | `"default" \| "sm" \| "lg"`  | `"default"` | Height + text size                                               |
| `variant`             | `"default" \| "outline"`     | `"default"` | Outline adds a border ring                                       |
| `tooltip`             | `string \| TooltipProps`     | -           | Shown while collapsed to icons (desktop only)                    |
| `href`                | `string`                     | -           | Renders a link                                                   |
| `onPress`             | `(e: PressEvent) => void`    | -           | Press handler (inline arrow on resumed pages)                    |
| `render`              | `DOMRenderFunction`          | -           | Custom element                                                   |

### Sidebar.MenuSubButton

| Prop          | Type                         | Default | Description           |
| ------------- | ---------------------------- | ------- | --------------------- |
| `size`        | `"sm" \| "md"`               | `"md"`  | Text size             |
| `isActive`    | `boolean \| (() => boolean)` | `false` | Current page          |
| `isCurrent`   | `boolean \| (() => boolean)` | -       | `aria-current="page"` |
| `forceReload` | `boolean`                    | `false` | Full document load    |
| `href`        | `string`                     | -       | Link target           |

### Sidebar.Menu

| Prop                  | Type                 | Default   | Description                          |
| --------------------- | -------------------- | --------- | ------------------------------------ |
| `showGuideLines`      | `boolean \| "hover"` | `true`    | Tree guide lines next to sub menus   |
| `closeMobileOnAction` | `boolean`            | inherited | For the items inside                 |
| `reduceMotion`        | `boolean`            | inherited | No sub-menu transitions in this menu |

### Sidebar.MenuItem / Sidebar.MenuSubItem

| Prop                  | Type                                            | Default   | Description                                                    |
| --------------------- | ----------------------------------------------- | --------- | -------------------------------------------------------------- |
| `expandable`          | `boolean`                                       | `false`   | Tree item: `Sidebar.MenuTrigger` toggles its `Sidebar.MenuSub` |
| `defaultExpanded`     | `boolean`                                       | `false`   | Initially open (implies `expandable`)                          |
| `isExpanded`          | `boolean \| Signal<boolean> \| (() => boolean)` | -         | Controlled open state (implies `expandable`)                   |
| `onExpandedChange`    | `(expanded: boolean) => void`                   | -         | Called when toggled                                            |
| `isDisabled`          | `boolean`                                       | `false`   | Trigger disabled                                               |
| `closeMobileOnAction` | `boolean`                                       | inherited | For the buttons inside                                         |

### Sidebar.MenuTrigger / Sidebar.MenuIndicator

`Sidebar.MenuTrigger` takes the `Sidebar.MenuButton` props (no `href`) and is the disclosure button of its expandable item (it never closes the mobile sheet). `Sidebar.MenuIndicator` renders a chevron by default (any `children` replace it), `aria-hidden`.

### Sidebar.MenuChip

| Prop      | Type           | Default    | Description  |
| --------- | -------------- | ---------- | ------------ |
| `color`   | Chip `color`   | `"accent"` | Chip color   |
| `variant` | Chip `variant` | `"soft"`   | Chip variant |

### Sidebar.MenuActions

| Prop          | Type      | Default | Description                                 |
| ------------- | --------- | ------- | ------------------------------------------- |
| `showOnHover` | `boolean` | `false` | Visible on item hover / focus / active only |

### Sidebar.Pages / Sidebar.Page

| Prop            | Type                                         | Default    | Description                                        |
| --------------- | -------------------------------------------- | ---------- | -------------------------------------------------- |
| `value`         | `string \| Signal<string> \| (() => string)` | -          | `Pages`: controlled active page (signal = two-way) |
| `defaultValue`  | `string`                                     | first page | `Pages`: initial page                              |
| `onValueChange` | `(value: string) => void`                    | -          | `Pages`: called on page change                     |
| `reduceMotion`  | `boolean`                                    | inherited  | `Pages`: switch without the slide                  |
| `value`         | `string`                                     | -          | `Page`: its key                                    |

### Sidebar.MenuAction

| Prop          | Type      | Default | Description                                 |
| ------------- | --------- | ------- | ------------------------------------------- |
| `showOnHover` | `boolean` | `false` | Visible on item hover / focus / active only |

### Sidebar.MenuSkeleton

| Prop       | Type      | Default | Description      |
| ---------- | --------- | ------- | ---------------- |
| `showIcon` | `boolean` | `false` | Leading icon box |

`Sidebar.Group` also takes `closeMobileOnAction`. Other parts (`Header`, `Footer`, `Content`, `Separator`, `Input`, `Group*`, `MenuBadge`, `MenuSub`, `Rail`, `Inset`, `Trigger`) take `class`, `style`, `render`, global DOM props and `children`.

::api{symbol="@rivetjs/ui/sidebar#SidebarMenuButtonProps"}

## Related Components

- [Button](/components/button/): `Sidebar.Trigger` uses its ghost icon style.
- [Tooltip](/components/tooltip/): collapsed menu-button tooltips.
- [Separator](/components/separator/): `Sidebar.Separator`.
