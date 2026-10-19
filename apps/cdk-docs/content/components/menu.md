---
title: Menu
description: "@rivetjs/cdk/menu: RAC MenuTrigger, Menu, MenuItem, MenuSection and SubmenuTrigger: actions, links, selection, submenus and typeahead in the overlay layer."
template: guide
status: experimental
related: [components/popover, foundations/overlays, foundations/keyboard-navigation]
---

A menu shows a list of actions or options that a user can choose. `MenuTrigger` wraps a `<Button>` and a `<Popover>` holding a `<Menu>`; items are `<MenuItem>`s (links when they have an `href`). Same parts, props and behaviour as React Aria Components `Menu`.

::example{id=aria-menu}

## Anatomy

```tsx
<MenuTrigger>
  <Button>Edit</Button>
  <Popover>
    <Menu onAction={(key) => …}>
      <MenuItem id="copy">Copy</MenuItem>
      <MenuSection>
        <Header>Share</Header>
        <MenuItem id="email">Email</MenuItem>
      </MenuSection>
      <Separator />
      <SubmenuTrigger>
        <MenuItem>More</MenuItem>
        <Popover>
          <Menu>…</Menu>
        </Popover>
      </SubmenuTrigger>
    </Menu>
  </Popover>
</MenuTrigger>
```

| Part | Element | Default class | Attributes |
| --- | --- | --- | --- |
| Trigger (`Button`) | `<button>` | `rv-Button` | `aria-haspopup="true"`, `aria-expanded`, `aria-controls` (while open), `data-pressed` |
| `Popover` | `<div>` | `rv-Popover` | `data-placement`, `data-entering`, `data-exiting`, `data-trigger="MenuTrigger"` |
| `Menu` | `<div role="menu">` | `rv-Menu` | `aria-labelledby` (the trigger), `data-empty` |
| `MenuItem` | `<div role="menuitem">` (`menuitemcheckbox` / `menuitemradio` with selection) or `<a>` | `rv-MenuItem` | `data-key`, `data-focused`, `data-focus-visible`, `data-hovered`, `data-pressed`, `data-selected`, `data-disabled`, `data-has-submenu`, `data-open`, `aria-haspopup` / `aria-expanded` (submenu trigger) |
| `MenuSection` | `<section role="group">` | `rv-MenuSection` | `aria-labelledby` (its `Header`) or `aria-label` |
| `Header` | `<header>` | `rv-Header` | `id` referenced by its section |
| `Separator` | `<div role="separator">` | `rv-Separator` | not focusable |
| `MenuLoadMoreItem` | `<div role="menuitem">` | `rv-MenuLoadingIndicator` | sentinel calling `onLoadMore` |

- The menu is named by its trigger; an icon trigger needs `aria-label` on the `Button`.
- Inside items, `<Text slot="label">`, `<Text slot="description">` and `<Keyboard>` set `aria-labelledby`, `aria-describedby` and the shortcut.

## Import

```tsx
import { Menu, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger, MenuLoadMoreItem } from "@rivetjs/cdk/menu";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Header } from "@rivetjs/cdk/header";
import { Separator } from "@rivetjs/cdk/separator";
import { Text } from "@rivetjs/cdk/text";
import { Keyboard } from "@rivetjs/cdk/keyboard";
```

Hooks for your own markup: `@rivetjs/cdk/menu/behaviour` (`menuTriggerProps(props, state)`, `menuProps(props, state)`, `menuEvent`, `menuKeys`); state: `@rivetjs/cdk/state/menu` (`createMenuTriggerState`, `createMenuState`, `createSubmenuTriggerState`).

## Props

### MenuTrigger

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `trigger` | `"press" \| "longPress" \| "contextMenu"` | `"press"` | `contextMenu` opens at the pointer on right click / :kbd[Shift]+:kbd[F10] (long press on iOS). |
| `isOpen` | `boolean \| Signal<boolean>` | none | Controlled open state. |
| `defaultOpen` | `boolean` | `false` | |
| `onOpenChange` | `(isOpen) => void` | none | |

### Menu

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` | `Iterable<T>` | none | Dynamic collection, with a `children` render function. |
| `onAction` | `(key) => void` | none | Item activated. |
| `selectionMode` | `"none" \| "single" \| "multiple"` | `"none"` | |
| `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange` | `Selection` | none | Value or Signal. |
| `disabledKeys` | `Iterable<Key>` | none | |
| `shouldCloseOnSelect` | `boolean` | `true` (`false` for multiple selection) | |
| `autoFocus` | `boolean \| "first" \| "last"` | set by MenuTrigger | |
| `escapeKeyBehavior` | `"clearSelection" \| "none"` | `"clearSelection"` | |
| `renderEmptyState` | `() => Content` | none | |
| `onClose` | `() => void` | closes the trigger | |
| `class`, `style` | value or `(renderProps) => …` | `rv-Menu` | Render props: `isEmpty`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Menu`; see [Render](#render). |

### MenuItem

| Prop | Type | Notes |
| --- | --- | --- |
| `id`, `value`, `textValue` | | `textValue` for typeahead when children are not plain text. |
| `isDisabled` | `boolean` | |
| `onAction` | `() => void` | Per-item action (also calls the menu's). |
| `shouldCloseOnSelect` | `boolean` | Overrides the menu / section. |
| `href`, `hrefLang`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `routerOptions` | | Link item (`<a>`). |
| `onPress…`, `onHover…`, `onFocus`, `onBlur`, `onFocusChange` | | Same events as RAC. |
| `class`, `style`, `children` | value or function | Render props: `isHovered`, `isPressed`, `isSelected`, `isFocused`, `isFocusVisible`, `isDisabled`, `selectionMode`, `selectionBehavior`, `hasSubmenu`, `isOpen`. |
| `render` | `(props, renderProps) => element` | Replaces the default `<div>` of `MenuItem`; see [Render](#render). |

### MenuSection, SubmenuTrigger, MenuLoadMoreItem

- `MenuSection`: own `selectionMode` / `selectedKeys` / `onSelectionChange` / `shouldCloseOnSelect`; `items` + render function.
- `SubmenuTrigger`: `delay` (ms before hover opens, default 200); children = trigger `MenuItem` + `Popover`.
- `MenuLoadMoreItem`: `onLoadMore`, `isLoading` (value or accessor), `scrollOffset`.

## Content

`Menu` takes static children or a dynamic collection: `items` plus a render function per item.

### Dynamic items

::example{id=menu-dynamic}

### Text slots and keyboard shortcuts

`<Text slot="label">` and `<Text slot="description">` split an item's primary and secondary text (`aria-labelledby` / `aria-describedby`); `<Keyboard>` shows its shortcut. Set `textValue` for typeahead when the children are not plain text. Only text and decorative icons belong inside items, never interactive elements.

::example{id=menu-slots}

### Sections

`<MenuSection>` groups items (`role="group"`). A `<Header>` inside it names the group; a section without a header needs an `aria-label`.

::example{id=menu-sections}

### Submenus

Wrap a trigger `<MenuItem>` and a `<Popover>` holding a `<Menu>` in a `<SubmenuTrigger>`. Submenus nest to any depth. A submenu opens on hover after `delay` ms (default 200), on :kbd[ArrowRight], :kbd[Enter] or :kbd[Space]; :kbd[ArrowLeft] or :kbd[Escape] close it and focus its trigger. While the pointer moves toward an open submenu, other items do not steal it (safe triangle). Each `Menu` has its own `onAction`; activating any item closes every menu.

::example{id=menu-submenu}

Dynamic collections render a `SubmenuTrigger` for entries with children (see [Dynamic items](#dynamic-items)).

### Separators

`<Separator />` between items or sections draws an unlabelled divider (`<div role="separator">` inside a menu); the keyboard skips it. See the [Sections](#sections) example.

### Links

An item with `href` renders an `<a>`; activating it follows the link and closes the menu.

::example{id=menu-links}

### Autocomplete

Inside `Autocomplete`, a `SearchField` filters a `Menu` while focus stays in the field (virtual focus on the items). The same composition works inside a menu `Popover`, with the field as a sibling of the `Menu`.

::example{id=autocomplete-menu}

## Selection

`selectionMode="single"` turns items into `menuitemradio`, `"multiple"` into `menuitemcheckbox` (with `aria-checked`). `selectedKeys` takes a value (initial selection, changes reported to `onSelectionChange`) or a `Signal<Selection>` (two-way). Multiple selection keeps the menu open (`shouldCloseOnSelect` defaults to `false`). Draw the indicator from the `isSelected` render prop or `[data-selected]`.

::example{id=menu-selection}

### Section-level selection

Each `MenuSection` can have its own `selectionMode`, `selectedKeys` and `onSelectionChange`, next to plain action items.

::example{id=menu-section-selection}

### Disabled items

`disabledKeys` on the `Menu` or `isDisabled` on a `MenuItem`: the item gets `aria-disabled` / `data-disabled`, the keyboard skips it and it never runs `onAction` or changes selection.

::example{id=menu-disabled}

## Actions and events

### Controlled open state

::example{id=menu-controlled}

### onAction and item events

::example{id=menu-events}

## Menu trigger

### Long press

`trigger="longPress"` opens the menu after a 500 ms press (touch or mouse) instead of a click; keyboard users press :kbd[Alt]+:kbd[ArrowDown]. A short press runs the `Button`'s own `onPress`, so the trigger keeps a primary action. The trigger is described by the localized "Long press or press Alt + ArrowDown to open menu" text.

::example{id=menu-long-press}

### Context menu

`trigger="contextMenu"` opens the menu at the pointer on right click, on long press on touch, or with :kbd[Shift]+:kbd[F10]; the trigger has no `aria-haspopup`.

## Placement

`Popover` props (`placement`, `offset`, `crossOffset`, `shouldFlip`, …) apply to the menu popover.

::example{id=menu-placement}

## DOM events and attributes

Native DOM props on `Menu` / `MenuItem` reach their elements; menu behaviour runs in one delegated handler on the menu, so item handlers resume without loading anything up front.

::example{id=menu-dom-events}

## Styling

| Selector | Matches | Tailwind |
| --- | --- | --- |
| `.rv-MenuItem[data-focused]`, `[data-focus-visible]` | Focused item | `data-focused:`, `data-focus-visible:` |
| `.rv-MenuItem[data-hovered]`, `[data-pressed]` | Hovered / pressed | `data-hovered:`, `data-pressed:` |
| `.rv-MenuItem[data-selected]` | Selected item | `data-selected:` |
| `.rv-MenuItem[data-disabled]` | Disabled item | `data-disabled:` |
| `.rv-MenuItem[data-open]` | Submenu trigger with open submenu | `data-open:` |
| `.rv-Popover[data-placement="top"]` | Popover side | `placement-top:` |
| `.rv-Popover[data-entering]`, `[data-exiting]` | Enter / leave frames | `entering:`, `exiting:` |

The popover renders at the end of `<body>`: select it by class, not as a descendant of the trigger.

### Tailwind

::example{id=menu-tailwind}

### Transitions

::example{id=menu-transition}

### Plain CSS

`@rivetjs/cdk/theme.css` is an optional starter look for the `rv-*` classes.

::example{id=menu-css}

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Menu` (`<div>`), `MenuSection` (`<section>`), `MenuItem` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Menu render={(props) => <div {...(props as {})} />}>…</Menu>
```

## Accessibility

- APG menu button: the trigger has `aria-haspopup`, `aria-expanded` and `aria-controls` while open; the menu is named by the trigger.
- Items are not in the tab order; focus moves into the menu on open and back to the trigger on close. A pointer open focuses the menu itself; a keyboard open focuses the first (or last) item.
- The page behind the menu is inert while it is open; hidden dismiss buttons at both ends let screen reader users close it.

| Key | Where | Action |
| --- | --- | --- |
| :kbd[Enter], :kbd[Space] | trigger | Open on the first item (`trigger="longPress"`: :kbd[Alt]+:kbd[ArrowDown] / :kbd[Alt]+:kbd[ArrowUp] only). |
| :kbd[ArrowDown] / :kbd[ArrowUp] | trigger | Open on the first / last item. |
| :kbd[ArrowDown], :kbd[ArrowUp], :kbd[Home], :kbd[End] | menu | Move focus over enabled items. |
| Letters | menu | Typeahead. |
| :kbd[Enter], :kbd[Space] | item | Activate / toggle selection; closes unless `shouldCloseOnSelect={false}`. |
| :kbd[ArrowRight] (:kbd[ArrowLeft] in RTL), :kbd[Enter], :kbd[Space] | submenu trigger | Open the submenu on its first item. |
| :kbd[ArrowLeft] (:kbd[ArrowRight] in RTL), :kbd[Escape] | submenu | Close the submenu, focus its trigger. |
| :kbd[Escape] | root menu | Close, focus the trigger. |
| :kbd[Tab] | menu | Close all menus; focus moves on. |

## Resumability

- Server HTML: the trigger only; a closed menu renders nothing. The trigger carries `data-rk` so a cold :kbd[ArrowDown] opens the menu instead of scrolling.
- Menu and item behaviour is one delegated handler on the menu element; item callbacks are registered by key.
- `onAction`, item events and render functions: inline arrows or local functions.

## Testing

`@rivetjs/testing/user` ships the ported `MenuTester` (React Aria test-utils): `user.createTester("Menu", { root: triggerButton })`, then `open()`, `getMenu()`, `getOptions()`, `toggleOptionSelection({ option })`, `close()`.

## Upstream

Ports React Aria Components `Menu.tsx` (`MenuTrigger`, `Menu`, `MenuItem`, `MenuSection`, `SubmenuTrigger`, `MenuLoadMoreItem`), react-aria `useMenuTrigger` / `useMenu` / `useMenuItem` / `useSubmenuTrigger` / `useSafelyMouseToSubmenu`, react-stately `useMenuTriggerState` / `useSubmenuTriggerState`.

Deviations:

- Render props are accessors.
- Virtualized menus: `<CollectionVirtualizer layout={ListLayout}>` around the `Menu` (see [Virtualizer](../foundations/virtualizer.md#collection-components)); submenus inside a virtualized menu are not covered. `isEmpty` counts rendered items.
- Filtering inside `Autocomplete` keeps empty sections.
- No `--trigger-width` on the popover.

### Not yet supported

- Popover exit transition state (`data-exiting`) on the menu popover is not observed yet.
