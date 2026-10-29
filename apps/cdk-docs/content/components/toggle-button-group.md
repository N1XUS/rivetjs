---
title: ToggleButtonGroup
description: ToggleButtonGroup from @rivetjs/cdk groups ToggleButtons with single (radio) or multiple selection, arrow-key focus and a Set of selected keys.
template: guide
status: experimental
related: [components/toggle-button, components/toolbar, components/radio-group, components/tabs]
---

`ToggleButtonGroup` turns a row of [ToggleButton](toggle-button.md)s into one control. Each button has an `id`, the group keeps the selected ids in a `Set`, and the arrow keys move focus between buttons. With `selectionMode="single"` (default) it is a `radiogroup` of radios; with `"multiple"` it is a `toolbar` of `aria-pressed` buttons.

::example{id=toggle-button-group-single}

## Anatomy

```html
<div role="radiogroup" aria-label="View" class="rv-ToggleButtonGroup" data-orientation="horizontal" aria-orientation="horizontal">
  <button type="button" role="radio" aria-checked="true" data-selected="true" class="rv-ToggleButton">List</button>
  <button type="button" role="radio" aria-checked="false" class="rv-ToggleButton">Grid</button>
</div>
```

| Attribute | Value |
| --- | --- |
| `role` | `radiogroup` (single) or `toolbar` (multiple) |
| `aria-orientation`, `data-orientation` | `horizontal` / `vertical` |
| `aria-disabled`, `data-disabled` | `"true"` with `isDisabled` |
| button `role="radio"` + `aria-checked` | single selection |
| button `aria-pressed` | multiple selection |
| button `data-selected` | `"true"` while selected (both modes) |
| `class` | `rv-ToggleButtonGroup`, or your `class` |

## Import

```ts
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | ToggleButtons, or `(renderProps) => content` | none | Each `ToggleButton` needs an `id` (its key). |
| `selectionMode` | `"single" \| "multiple"` | `"single"` | |
| `selectedKeys` | `Iterable<Key>` or `Signal<Iterable<Key>>` | none | A plain value is controlled (only `onSelectionChange` reports); a signal is two-way. |
| `defaultSelectedKeys` | `Iterable<Key>` | none | Initial selection (uncontrolled). |
| `disallowEmptySelection` | `boolean` | `false` | The last selected button can not be turned off. |
| `isDisabled` | `boolean` | `false` | Disables every button. |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Arrow keys: Left / Right or Up / Down. |
| `id`, `slot` | `string` | none | |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` | none | Name the group. |
| `class` | `string \| (rp) => string` | `rv-ToggleButtonGroup` | Function form gets the render props. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `ToggleButtonGroup`; see [Render](#render). |
| `style` | `object \| (rp) => object` | none | |
| `ref` | `ref()` / callback | none | The group `<div>`. |
| global DOM props | `GlobalDOMAttributes` | none | Forwarded to the `<div>`. |

### Events

| Event | Fires |
| --- | --- |
| `onSelectionChange(keys: Set<Key>)` | A press changed the selection (also when `disallowEmptySelection` keeps the key, as upstream). |

Button events (`onPress`, `onFocus`, …) stay on each [ToggleButton](toggle-button.md#events). Inside a group a button's own `isSelected` / `onChange` are not used: the group owns the selection.

### Render props

| Render prop | Type | Selector |
| --- | --- | --- |
| `orientation` | `() => Orientation` | `[data-orientation]` |
| `isDisabled` | `() => boolean` | `[data-disabled]` |
| `state` | `ToggleGroupState` | |

## Multiple selection and controlled state

`selectionMode="multiple"` lets any number of buttons be on. Pass a signal as `selectedKeys` to own the selection: the group writes it on every press, and writing it from outside updates every button.

::example{id=toggle-button-group-multiple}

## Options

`disallowEmptySelection` keeps at least one button on, `orientation="vertical"` stacks the group and switches the arrow keys, `isDisabled` disables every button (a button's own `isDisabled` disables only that one).

::example{id=toggle-button-group-options}

## Animated selection indicator

The group is a `SharedElementTransition` scope: a `<SelectionIndicator />` inside each `ToggleButton` renders under the selected one and slides between buttons.

::example{id=toggle-button-group-indicator}

## DOM events and attributes

`ToggleButtonGroup` forwards the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`) and `data-*` to its `<div>`. It handles `onKeyDown`, `onFocusIn` and `onFocusOut` itself (toolbar focus).

::example{id=toggle-button-group-events}

## Styling

| Selector | When |
| --- | --- |
| `.rv-ToggleButtonGroup` | always (unless you pass `class`) |
| `[data-orientation="vertical"]` | vertical |
| `[data-disabled]` | group disabled |
| `.rv-ToggleButton[data-selected]` | selected button (both modes) |
| `[aria-checked="true"]` / `[aria-pressed="true"]` | selected button, single / multiple |

### Tailwind

`aria-pressed:` / `aria-checked:` target the selected button; `orientation-vertical:` (from `@rivetjs/cdk/tailwind.css`) the vertical group. See [multiple](#multiple-selection-and-controlled-state) and the [indicator](#animated-selection-indicator) examples.

### Plain CSS

The first example on this page styles the group with `styles.css` (`.rv-ToggleButtonGroup .rv-ToggleButton[data-selected]`).

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `ToggleButtonGroup` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ToggleButtonGroup render={(props) => <div {...(props as {})} />}>…</ToggleButtonGroup>
```

## Custom markup

`@rivetjs/cdk/toggle-button-group/behaviour` exports `toggleButtonGroupProps(props, state)` (RA `useToggleButtonGroup`: role, `aria-orientation`, `aria-disabled`) and `toggleButtonGroupItemProps({ id, isDisabled }, state)` (RA `useToggleButtonGroupItem`: `{ buttonProps, isSelected, isDisabled }`) with the press handlers `toggleButtonGroupItemPointerDown` / `KeyDown` / `Click(event, props, state)`. The state is `createToggleGroupState(props)` from `@rivetjs/cdk/state/toggle-group` (`toggleKey`, `setSelected`, `isKeySelected`, `selectedKeysOf`).

## Accessibility

- Single selection is a `radiogroup` of `radio`s (`aria-checked`); multiple selection a `toolbar` of toggle buttons (`aria-pressed`).
- Name the group with `aria-label` / `aria-labelledby`; name icon-only buttons with their own `aria-label`.
- Arrow keys move between buttons, skipping disabled ones; Tab leaves the group, and focus coming back returns to the last focused button (RA toolbar).

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Previous / next button (horizontal; flipped in RTL). |
| :kbd[ArrowUp], :kbd[ArrowDown] | Previous / next button (vertical). |
| :kbd[Enter], :kbd[Space] | Toggle the focused button. |
| :kbd[Tab], :kbd[Shift]+:kbd[Tab] | Leave the group. |

## Resumability

- The server renders roles, `aria-checked` / `aria-pressed` and `data-selected` from the state; no script loads until the first interaction.
- The group state is signals: `defaultSelectedKeys` and a `selectedKeys` signal resume with their values.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ToggleButtonGroup`, `ToggleButtonGroupContext`, `ToggleGroupStateContext` | RAC `ToggleButtonGroup`, `ToggleButtonGroupContext`, `ToggleGroupStateContext` |
| `toggleButtonGroupProps` | react-aria `useToggleButtonGroup` |
| `toggleButtonGroupItemProps` | react-aria `useToggleButtonGroupItem` |
| `createToggleGroupState` | react-stately `useToggleGroupState` |

Deviations: `className` is `class`; render props are accessors; `selectedKeys` may be a two-way signal.

