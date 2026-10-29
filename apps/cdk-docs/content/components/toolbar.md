---
title: Toolbar
description: Toolbar from @rivetjs/cdk groups controls into one tab stop; arrow keys move focus between them, across groups, and Tab leaves the toolbar.
template: guide
status: experimental
related: [components/button, components/toggle-button, components/group, foundations/keyboard-navigation]
---

`Toolbar` renders a `<div role="toolbar">` around buttons, toggles, links and other controls. Arrow keys move focus between its focusable controls (across [Group](group.md)s and separators, without wrapping); Tab leaves the toolbar, and coming back returns focus to the control used last.

::example{id=toolbar-keyboard}

## Anatomy

```html
<div class="rv-Toolbar" role="toolbar" aria-label="Formatting" aria-orientation="horizontal"
     data-orientation="horizontal" data-rk="ArrowLeft ArrowRight">
  <button type="button" class="rv-ToggleButton" aria-pressed="false">Bold</button>
  <div role="group" class="rv-Group" aria-label="Align">…</div>
  <button type="button" class="rv-Button">Undo</button>
</div>
```

| Attribute | Value |
| --- | --- |
| `role` | `toolbar`, or `group` for a toolbar nested in another (from the server on) |
| `aria-orientation`, `data-orientation` | `horizontal` (default) / `vertical` |
| `aria-label` / `aria-labelledby` | the name (`aria-labelledby` is dropped when `aria-label` is set) |
| `data-rk` | arrow keys held while the toolbar's code loads (resumability) |
| `class` | `rv-Toolbar`, or your `class` |

## Import

```ts
import { Toolbar, ToolbarContext } from "@rivetjs/cdk/toolbar";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `({ orientation }) => content` | none | Any focusable controls. Render props are accessors: call them. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Which arrow keys move focus. |
| `aria-label`, `aria-labelledby` | `string` | none | Name every toolbar. |
| `id`, `slot` | `string` | none | `slot` picks props from `ToolbarContext`. |
| `class`, `style` | value or `({ orientation }) => value` | `rv-Toolbar` | |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Toolbar`; see [Render](#render). |
| `ref` | `ref()` | none | The `div`. |
| global DOM props | `GlobalDOMAttributes` | none | On the `div`. |

### Events

Toolbar has no events of its own; use the events of the controls inside.

## Orientation

Horizontal toolbars use :kbd[ArrowLeft] / :kbd[ArrowRight] (flipped in right-to-left text); vertical ones :kbd[ArrowUp] / :kbd[ArrowDown]. The other keys stay with the focused control.

::example{id=toolbar-orientation}

## Composing controls

Any focusable element takes part: [Button](button.md), [ToggleButton](toggle-button.md), [Link](link.md), inputs, and controls inside a [Group](group.md) or a nested `<Toolbar>` (it renders `role="group"`; the outer toolbar handles the keys).

::example{id=toolbar-composition}

## DOM events and attributes

Global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) land on the `div`. Toolbar handles `keydown`, `focusin` and `focusout` on it itself.

::example{id=toolbar-dom-events}

`on…Capture` handlers work on resumed pages too, the first event included.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Toolbar` | always |
| `[data-orientation=vertical]`, `[aria-orientation=vertical]` | vertical |
| `:focus-within` | focus inside |

### Tailwind

`@rivetjs/cdk/tailwind.css` provides `orientation-vertical:` and `orientation-horizontal:`.

::example{id=toolbar-tailwind}

### Plain CSS

::example{id=toolbar-css}

### Starter theme

`@rivetjs/cdk/theme.css` has no `.rv-Toolbar` rule; it styles the buttons inside.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `Toolbar` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<Toolbar render={(props) => <div {...(props as {})} />}>…</Toolbar>
```

## Custom markup

`@rivetjs/cdk/toolbar/behaviour` exports `toolbarProps(props, isInToolbar?)`, `toolbarKeys(orientation)` (the `data-rk` value) and the handlers `toolbarKeyDown(e, { orientation, direction? })`, `toolbarFocus(e)`, `toolbarBlur(e)`. Wire them as `onKeyDown`, `onFocusIn`, `onFocusOut` on your element. See [Keyboard navigation](../foundations/keyboard-navigation.md) for more toolbar examples.

## Accessibility

- `role="toolbar"` with a name and `aria-orientation`.
- Every control keeps its own tab stop; arrow keys move between them and Tab leaves the toolbar from its last (or, with :kbd[Shift], first) control.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowRight] / :kbd[ArrowDown] | Next control (horizontal / vertical); no wrap. |
| :kbd[ArrowLeft] / :kbd[ArrowUp] | Previous control; no wrap. |
| :kbd[Tab], :kbd[Shift+Tab] | Leave the toolbar. |

## Resumability

- The server renders the attributes; the key handlers load on the first key or focus inside. `data-rk` holds the arrow keys pressed while that code loads, so none is lost.
- The last focused control is browser-only state; it is not serialized.

## Testing

Focus a control (`user.tab()`), press arrow keys with `user.keyboard("{ArrowRight}")` and assert `document.activeElement`.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Toolbar` | RAC `Toolbar` |
| `@rivetjs/cdk/toolbar/behaviour` | react-aria `useToolbar` |

Deviations: bubbling listeners instead of capture-phase ones (a control that stops propagation of an arrow key keeps it); render props are accessors; `class` = RAC `className`.


## Common mistakes

- **No name.** Give each toolbar `aria-label` or `aria-labelledby`.
- **`tabindex="-1"` on the controls.** Not needed: Tab already leaves from the last control.
- **Expecting arrow keys to wrap.** They stop at the ends, as upstream.
