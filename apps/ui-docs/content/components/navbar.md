---
title: Navbar
description: "A responsive top bar: brand, links with the current page, a mobile menu toggle, zero-JS hide on scroll and router integration."
template: reference
status: experimental
related: [components/sidebar, components/app-layout, components/link, components/dropdown]
---

`Navbar` is the top bar of a site or app: brand, links (the current one marked), actions, and a menu toggle that opens a full-width menu on small screens. It is server markup with delegated handlers: nothing runs at load, hide on scroll is a CSS scroll-state query, and the handler chunks prefetch while the bar is in view.

## Usage

```tsx
import { Navbar } from "@rivetjs/ui/navbar";
```

::example{id=navbar-basic}

## Anatomy

```tsx
import { Navbar } from "@rivetjs/ui/navbar";

export default function Anatomy() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.MenuToggle />
        <Navbar.Brand>Acme</Navbar.Brand>
        <Navbar.Content>
          <Navbar.Item href="/docs" isCurrent>
            <Navbar.Label>Docs</Navbar.Label>
          </Navbar.Item>
          <Navbar.Separator />
          <Navbar.Item onPress={() => {}}>Action</Navbar.Item>
        </Navbar.Content>
        <Navbar.Spacer />
      </Navbar.Header>
      <Navbar.Menu>
        <Navbar.MenuItem href="/docs">Docs</Navbar.MenuItem>
      </Navbar.Menu>
    </Navbar>
  );
}
```

`Navbar.Item` / `Navbar.MenuItem` render a cdk `Link` with `href` and a cdk `Button` without. A pressed `Navbar.MenuItem` closes the menu.

Additional exported parts: `Navbar.Root`.

## Examples

### Docs Site

::example{id=navbar-docs-site}

### With Dropdowns

::example{id=navbar-with-dropdowns}

### Dashboard

::example{id=navbar-dashboard}

### Compact

::example{id=navbar-compact}

### With Menu

::example{id=navbar-with-menu}

### Menu Toggle

The default `Navbar.MenuToggle` icon is a morph burger: three CSS bars drawn like lucide `Menu`; the outer two slide to the middle (the middle one fades), then turn into lucide's `X` (240 ms, the timing of apple.com's navigation burger). It is CSS on the toggle's state: no JavaScript, nothing plays on page load, and a press halfway reverses from the current shape. Reduced motion swaps it at once. Children replace it: swap your own lucide icons on the toggle's `aria-expanded` (third toggle below).

::example{id=navbar-menu-toggle}

| Variable                   | Default                                 |                                  |
| -------------------------- | --------------------------------------- | -------------------------------- |
| `--navbar-toggle-size`     | `1.25rem`                               | Icon box; the bars scale with it |
| `--navbar-toggle-stroke`   | size / 12                               | Bar thickness                    |
| `--navbar-toggle-duration` | `var(--duration-morph-burger)` (240 ms) | `0s` turns the morph off         |

Theme tokens: `--duration-morph-burger`, `--ease-morph-burger`.

### Hide on Scroll

`hideOnScroll` hides the bar while the page scrolls down and reveals it on scroll up. In browsers with CSS scroll-state container queries this is pure CSS (no JavaScript). The JavaScript path (a document `scroll` listener, attached on the first pointer or key press after the page resumed, never at load) writes `data-hidden`; it also drives `parentRef` (a scroll container instead of the window) and browsers without scroll-state queries.

::example{id=navbar-hide-on-scroll}

### Responsive Mobile Menu

The bar has no built-in breakpoint: hide the toggle and show the links with your own responsive classes (`md:hidden` / `hidden md:flex`).

::example{id=navbar-responsive-mobile-menu}

### Compact Density

::example{id=navbar-compact-density}

### Client-Side Routing

Item links are cdk `Link`s, so they follow the cdk router: a click on a same-origin link calls the router's `navigate` instead of loading a document.

#### Option 1 — Global RouterProvider (recommended)

Wrap the app in the cdk `RouterProvider` (`@rivetjs/cdk/link`) once; every Navbar, Sidebar and Link in it routes client-side. With `@rivetjs/router` the app's router fills this in.

::example{id=navbar-routing-provider}

#### Option 2 — navigate callback (per Navbar)

`navigate` (and optionally `useHref`) on one Navbar routes only its items.

::example{id=navbar-routing-navigate}

#### Option 3 — render prop for a custom link

`Navbar.Item` passes `render` to the cdk `Link`: return your own element from the props it receives.

```tsx
import { Navbar } from "@rivetjs/ui/navbar";

export default function CustomLink() {
  return (
    <Navbar aria-label="Main">
      <Navbar.Header>
        <Navbar.Item href="/docs" render={(props: Record<string, any>) => <a {...props} data-prefetch="intent" />}>
          Docs
        </Navbar.Item>
      </Navbar.Header>
    </Navbar>
  );
}
```

### External Links and Force Reload

::example{id=navbar-external-links}

### Positioning

::example{id=navbar-positioning}

### Programmatic Control

`isMenuOpen` takes a value, a two-way `Signal<boolean>` or an accessor (`defaultMenuOpen`, `onMenuOpenChange`). `useNavbar()` inside the bar returns `{ height, isHidden, isMenuOpen, setMenuOpen, navigate }` (`isHidden` / `isMenuOpen` are accessors; `isHidden` follows the JavaScript path only).

::example{id=navbar-programmatic-control}

## Styling Reference

The component’s parts emit these additional `data-slot` values: `navbar-header`, `navbar-brand`, `navbar-content`, `navbar-spacer`, `navbar-label`, `navbar-menu-toggle-icon`.

### CSS Classes

### Base & Variant Classes

| Class                                        | Applied                       |
| -------------------------------------------- | ----------------------------- |
| `navbar`                                     | root `nav`                    |
| `navbar--sticky` / `--static` / `--floating` | `position` (default `sticky`) |

### Layout Classes

| Class                                                                        | Applied                   |
| ---------------------------------------------------------------------------- | ------------------------- |
| `navbar__header`                                                             | `Navbar.Header`           |
| `navbar__header--sm` / `--md` / `--lg`                                       | `size` (default `md`)     |
| `navbar__header--max-sm` … `--max-2xl` / `--max-full`                        | `maxWidth` (default `lg`) |
| `navbar__brand` / `navbar__content` / `navbar__spacer` / `navbar__separator` | layout parts              |

### Item Classes

| Class                                     | Applied                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `navbar__item` (+ `--sm` / `--lg`)        | `Navbar.Item`; `data-current="true"` when current                                           |
| `navbar__label`                           | `Navbar.Label` (truncates)                                                                  |
| `navbar__menu-toggle` (+ `--sm` / `--lg`) | `Navbar.MenuToggle`; `data-selected` while open; default icon `.morph-burger` (`data-open`) |

### Menu Classes

| Class                                   | Applied                                      |
| --------------------------------------- | -------------------------------------------- |
| `navbar__menu`                          | `Navbar.Menu`; shown with `data-open="true"` |
| `navbar__menu-item` (+ `--sm` / `--lg`) | `Navbar.MenuItem`                            |

Root data attributes: `data-position`, `data-hide-on-scroll`, `data-hide-mode="js"` + `data-hidden` (JavaScript path), `data-menu-open`, `data-block-scroll`.

### CSS Variables

| Variable                       | Default                | What                                                |
| ------------------------------ | ---------------------- | --------------------------------------------------- |
| `--navbar-height`              | `4rem` (`height` prop) | bar height; the menu fills the rest of the viewport |
| `--navbar-max-width`           | per `maxWidth`         | header content width                                |
| `--navbar-transition-duration` | `300ms`                | hide / reveal slide                                 |

## API Reference

See the [full module API](/api/rivetjs/ui/navbar/) for every named export and part prop type.

| Prop (`Navbar`)                                       | Type                                                                         | Default     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| `position`                                            | `"sticky" \| "static" \| "floating"`                                         | `"sticky"`  |
| `size`                                                | `"sm" \| "md" \| "lg"`                                                       | `"md"`      |
| `maxWidth`                                            | `"sm" \| "md" \| "lg" \| "xl" \| "2xl" \| "full"`                            | `"lg"`      |
| `height`                                              | `string`                                                                     | `"4rem"`    |
| `hideOnScroll`                                        | `boolean`                                                                    | `false`     |
| `parentRef`                                           | `() => Element \| null \| undefined`                                         | window      |
| `isMenuOpen` / `defaultMenuOpen` / `onMenuOpenChange` | `boolean \| Signal<boolean> \| () => boolean` / `boolean` / `(open) => void` | — / `false` |
| `shouldBlockScroll`                                   | `boolean`                                                                    | `true`      |
| `navigate` / `useHref`                                | cdk router callbacks                                                         | —           |

`Navbar.Item` / `Navbar.MenuItem`: `href`, `isCurrent` (`false`), `forceReload` (`false`), `render`, plus cdk `Link` / `Button` props. `Navbar.MenuToggle`: `srLabel`, `children` (replaces the morph burger).

::api{symbol="@rivetjs/ui/navbar#NavbarRootProps"}

## Accessibility

- `nav` landmark; label it when the page has several.
- Current page: `aria-current="page"` (`isCurrent`, a value or an accessor).
- Menu toggle: `aria-expanded` + `aria-controls` = the menu id; `srLabel` (default "Toggle navigation menu") names it.
- Escape inside the bar closes the menu and focuses the toggle; `shouldBlockScroll` (default `true`) locks the page scroll while the menu is open.
- Hide / reveal and menu transitions honour `prefers-reduced-motion`.

the root is a `nav` landmark (give it an `aria-label` when there is more than one). `isCurrent` sets `aria-current="page"`. The menu toggle is a `button` with `aria-expanded` and `aria-controls`; Escape closes the menu and returns focus to the toggle.

## Related Components

- [Sidebar](/components/sidebar/)
- [AppLayout](/components/app-layout/)
- [Link](/components/link/)
- [Dropdown](/components/dropdown/)
