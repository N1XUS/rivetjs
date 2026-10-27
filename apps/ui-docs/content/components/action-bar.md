---
title: ActionBar
description: "A floating toolbar for bulk actions on a selection: slides up at the bottom of the screen with the count and the actions."
template: reference
status: experimental
related: [components/toolbar, components/table, components/list-box]
---

`ActionBar` appears at the bottom centre of the screen while something is selected and holds the bulk actions for that selection. It is selection-agnostic: you decide when it is open (`isOpen`) and render the count and actions yourself, so it works with a DataGrid, a [Table](/components/table/), a [ListBox](/components/list-box/) or any custom list. The pill is the ui [Toolbar](/components/toolbar/) (arrow keys move between the actions).

## Usage

```tsx
import { ActionBar } from "@rivetjs/ui/action-bar";
```

::example{id=action-bar-basic}

## Anatomy

```tsx
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";

export default function Anatomy(props: { count: () => number }) {
  return (
    <ActionBar isOpen={() => props.count() > 0}>
      <ActionBar.Prefix>{props.count()} selected</ActionBar.Prefix>
      <ActionBar.Content>
        <Button variant="ghost" size="sm">
          <span class="action-bar__label">Archive</span>
        </Button>
      </ActionBar.Content>
      <ActionBar.Suffix>
        <Button variant="ghost" size="sm">
          Clear
        </Button>
      </ActionBar.Suffix>
    </ActionBar>
  );
}
```

The bar is always in the page: `isOpen` flips `data-open`, and CSS transitions slide it in and out (`@starting-style`; with `prefers-reduced-motion` it appears without a transition). The outer layer lets pointer events through; only the pill takes them.

Additional exported parts: `ActionBar.Root`.

## Examples

### With Data Grid

::example{id=action-bar-with-data-grid}

### Responsive Labels

Wrap button text in `.action-bar__label`: below 640px it is screen-reader-only, so the buttons become icon-only on phones and keep their accessible names.

::example{id=action-bar-responsive-labels}

### Resumability

Server-rendered (closed or open); the bar itself runs no code at load: `isOpen` is an attribute binding that updates when the selection signal changes, and the motion is CSS.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `action-bar-announcer`, `action-bar-wrapper`, `action-bar-prefix`, `action-bar-content`, `action-bar-suffix`.

### CSS Classes

| Class                                   | Applied                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `action-bar`                            | outer fixed layer (bottom centre, `pointer-events: none`); `data-open`, `data-orientation` |
| `action-bar--horizontal` / `--vertical` | `orientation`                                                                              |
| `action-bar__wrapper`                   | the pill (`toolbar toolbar--attached` with `isAttached`)                                   |
| `action-bar__prefix`                    | `ActionBar.Prefix` (live region)                                                           |
| `action-bar__content`                   | `ActionBar.Content`                                                                        |
| `action-bar__suffix`                    | `ActionBar.Suffix`                                                                         |
| `action-bar__label`                     | your button text; `sr-only` below 640px                                                    |

| CSS variable                       | Default  | What                                                       |
| ---------------------------------- | -------- | ---------------------------------------------------------- |
| `--action-bar-offset`              | `1.5rem` | distance from the viewport bottom (at least the safe area) |
| `--action-bar-transition-duration` | `200ms`  | enter / exit transition                                    |

## API Reference

See the [full module API](/api/rivetjs/ui/action-bar/) for every named export and part prop type.

| Prop (`ActionBar`) | Type                                  | Default        |
| ------------------ | ------------------------------------- | -------------- |
| `isOpen`           | `boolean \| () => boolean` (required) | —              |
| `aria-label`       | `string`                              | `"Actions"`    |
| `isAttached`       | `boolean`                             | `true`         |
| `orientation`      | `"horizontal" \| "vertical"`          | `"horizontal"` |
| `class`            | `string` (outer layer)                | —              |

`ActionBar.Prefix`, `ActionBar.Content`, `ActionBar.Suffix`: `children`, `class`, `div` attributes.

::api{symbol="@rivetjs/ui/action-bar#ActionBarRootProps"}

## Accessibility

the pill is a `toolbar` named by `aria-label` (default "Actions"); Tab enters it and arrow keys move between the actions. `ActionBar.Prefix` is a polite live region, so a count rendered there is announced when it changes while the bar is open. Icon-only buttons need their own `aria-label`.

## Related Components

- [Toolbar](/components/toolbar/)
- [Table](/components/table/)
- [ListBox](/components/list-box/)
