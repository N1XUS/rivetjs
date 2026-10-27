---
title: Group
description: Group from @rivetjs/cdk is a role=group container with focus-within, focus-visible and opt-in hover state for styling grouped controls.
template: guide
status: experimental
related: [components/toolbar, components/text-field, components/field]
---

`Group` renders a `<div role="group">` around related controls (an input with buttons, a date segment row) and exposes their shared state for styling: `data-hovered`, `data-focus-within` and `data-focus-visible` (written by its handlers), plus accessor render props.

::example{id=group-focus}

## Anatomy

```html
<div id="search" role="group" class="rv-Group" aria-label="Search" data-focus-within="true" data-focus-visible="true">
  <input aria-label="Query" />
  <button type="button">Go</button>
</div>
```

| Attribute | Value |
| --- | --- |
| `role` | `group` (default), `region` or `presentation` |
| `data-focus-within` | focus is inside |
| `data-focus-visible` | focus is inside and came from the keyboard |
| `data-hovered` | a mouse or pen pointer is over it (not while disabled) |
| `data-disabled`, `data-invalid`, `data-readonly` | `isDisabled` (or `aria-disabled`), `isInvalid` (or `aria-invalid`), `isReadOnly` |
| `aria-disabled`, `aria-invalid` | only when passed as props |

## Import

```ts
import { Group, GroupContext } from "@rivetjs/cdk/group";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `({ isHovered, isFocusWithin, isFocusVisible, isDisabled, isInvalid }) => content` | none | Render props are accessors: call them. |
| `role` | `"group" \| "region" \| "presentation"` | `"group"` | A `region` needs a name. |
| `isDisabled`, `isInvalid`, `isReadOnly` | `boolean \| () => boolean` | `false` | Data attributes only; they do not disable the controls inside. |
| `aria-disabled`, `aria-invalid` | ARIA values (or accessors) | none | Announced; also set the matching data attribute. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | |
| `id`, `slot` | `string` | none | `slot` picks props from `GroupContext`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-Group` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Group`; see [Render](#render). |
| `ref` | `ref()` | none | The `div`. |
| global DOM props | `GlobalDOMAttributes` | none | On the `div`. |

### Events

| Event | Fires |
| --- | --- |
| `onHoverStart(e)`, `onHoverEnd(e)` | A mouse or pen pointer entered / left (`e.pointerType`). |
| `onHoverChange(isHovering)` | Hover state changed. |
| `onFocus`, `onBlur`, `onFocusIn`, `onFocusOut` | Native focus events on the root; focus-in/out also run the group's state handling. |
| `onKeyDown`, `onKeyUp` | Native keyboard events on the root. Group itself adds no arrow-key navigation. |

## Focus within

Focus inside the group sets `data-focus-within`; keyboard focus also sets `data-focus-visible`, so a ring around the whole group shows only for keyboard users.

## Hover

A mouse or pen pointer over the group sets `data-hovered` and fires the hover callbacks (touch does not hover). The handlers resume on the first `pointerenter`.

::example{id=group-hover}

## States and roles

The state props are for styling: disable or mark the controls inside yourself. Use `aria-disabled` / `aria-invalid` to also announce the state on the group.

::example{id=group-states}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) land on the `div`, merged with Group's own focus and hover handlers (both run).

::example{id=group-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Group` | always |
| `[data-focus-within]`, `:focus-within` | focus inside |
| `[data-focus-visible]` | keyboard focus inside |
| `[data-hovered]`, `:hover` | hover |
| `[data-disabled]`, `[data-invalid]`, `[data-readonly]` | states |

### Tailwind

`@rivetjs/cdk/tailwind.css` provides `focused:` among its variants; `data-[focus-visible]:` and `data-[hovered]:` work with plain Tailwind.

::example{id=group-tailwind}

### Plain CSS

::example{id=group-css}

### Starter theme

`@rivetjs/cdk/theme.css` styles `.rv-Group` only inside date pickers (border, focus ring, invalid colour).

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Group` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Group render={(props) => <div {...(props as {})} />}>…</Group>
```

## Accessibility

- `role="group"` needs a name when it adds meaning (`aria-label` / `aria-labelledby`); use `role="presentation"` for layout only.
- `role="region"` is a landmark; name it.

### Keyboard

None of its own: Tab moves through the controls inside. For arrow-key navigation use a [Toolbar](toolbar.md).

## Resumability

- The server renders the static attributes; focus and hover handlers load on the first focus inside / pointer over it.
- Hover callbacks must be inline arrows or local functions.

## Testing

Focus a control inside (`user.tab()` from `@testing-library/user-event`) and assert `data-focus-within` / `data-focus-visible`; hover with `user.hover()` and assert `data-hovered`.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Group` | RAC `Group` (react-aria `useFocusRing({ within: true })`, `useHover`) |

Deviations: render props are accessors; `class` = RAC `className`; hover does not end by itself when the group becomes disabled (it ends at the next `pointerleave`).


## Common mistakes

- **Expecting `isDisabled` to disable the inputs.** It only sets `data-disabled`.
