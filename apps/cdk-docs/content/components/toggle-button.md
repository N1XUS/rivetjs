---
title: ToggleButton
description: ToggleButton from @rivetjs/cdk is a native button with an on/off state kept in a signal and exposed as aria-pressed and data-selected.
template: guide
status: experimental
related: [components/button, components/switch, components/checkbox, components/toolbar]
---

`ToggleButton` is a native `<button type="button">` that flips an on/off state on every press. The state is a `Signal<boolean>` (`isSelected`) or an internal one (`defaultSelected`), rendered as `aria-pressed` and `data-selected`, so screen readers announce "pressed" / "not pressed".

::example{id=toggle-button-controlled}

## Anatomy

```html
<button type="button" id="pin" class="rv-ToggleButton" aria-pressed="false">Pin</button>
<button type="button" id="star" class="rv-ToggleButton" aria-label="Favourite" aria-pressed="true" data-selected="true"><svg aria-hidden="true" …>…</svg></button>
```

| Attribute | Value |
| --- | --- |
| `aria-pressed` | `"true"` / `"false"`, follows the state |
| `data-selected` | `"true"` while on |
| `role="radio"`, `aria-checked` | instead of `aria-pressed` inside a single-selection [ToggleButtonGroup](toggle-button-group.md) |
| `data-pressed` | while a pointer or key holds it |
| `disabled`, `data-disabled` | with `isDisabled` |
| `class` | `rv-ToggleButton`, or your `class` |

## Import

```ts
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `(renderProps) => content` | none | Keep the label the same in both states; the state is `aria-pressed`. Render props are accessors (`isSelected()`). |
| `isSelected` | `Signal<boolean>` | none | Two-way state (controlled). Write it to toggle from code. Ignored inside a ToggleButtonGroup (the group owns the selection). |
| `defaultSelected` | `boolean` | `false` | Initial state of the internal signal (uncontrolled). |
| `isDisabled` | `boolean` | `false` | Native `disabled`; the state never changes. Inside a ToggleButtonGroup: disabled when the button or the group is. |
| `excludeFromTabOrder` | `boolean` | `false` | `tabindex="-1"`. |
| `autoFocus` | `boolean` | `false` | |
| `id` | `string \| number` (`Key`) | none | Standalone: the button's DOM id. Inside a [ToggleButtonGroup](toggle-button-group.md): the button's key in the group's `selectedKeys` (not rendered as the id). |
| `aria-label`, `aria-labelledby`, `aria-describedby` | `string` | none | Name icon toggles with `aria-label`. |
| `aria-controls`, `aria-expanded`, `aria-haspopup` | ARIA values | none | |
| `class`, `style` | value or `(renderProps) => value` | `rv-ToggleButton` | A `class` replaces the default class. Render props: `isHovered`, `isPressed`, `isSelected`, `isFocused`, `isFocusVisible`, `isDisabled`, `state`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<button>` of `ToggleButton`; see [Render](#render). |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |
| `label` | `string` | none | Deprecated alias of `aria-label`. |
| `selected`, `disabled` | `Signal<boolean>`, `boolean` | none | Deprecated aliases of `isSelected` / `isDisabled` (not in RAC; inside a group the group owns the selection, so only `disabled` counts there): use `isSelected` / `isDisabled`. |

### Events

| Event | Fires |
| --- | --- |
| `onChange(isSelected)` | The state changed through a press. Not when you write `isSelected` yourself. |
| `onPress(e)`, `onPressStart(e)`, `onPressEnd(e)` | Press events (see [Button](button.md#events)); the toggle runs before `onPress`. |
| `onPressChange(isPressed)` | The pressed (held) state changed. |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocused)` | Focus. |
| `onKeyDown(e)`, `onKeyUp(e)` | Keys, after the press handling. |

## Controlled and uncontrolled

Pass a signal as `isSelected` to own the state: the button writes it on every press, and writing it updates `aria-pressed`. Without one, `defaultSelected` sets the start of an internal state. `onChange(isSelected)` fires only when a press changes the state.

Inside a [ToggleButtonGroup](toggle-button-group.md), a button with an `id` takes its selection from the group (`selectedKeys`) instead.

## Events

::example{id=toggle-button-events}

## Disabled

A disabled toggle keeps its state and is skipped by Tab. `excludeFromTabOrder` keeps an enabled toggle out of the Tab order; arrow keys of a [Toolbar](toolbar.md) still reach it.

::example{id=toggle-button-disabled}

## DOM events and attributes

`ToggleButton` forwards the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`) to its `<button>`. It handles `onPointerDown` and `onClick` itself; your handler of the same name runs right after its own, so `onClick` already sees the new state.

::example{id=toggle-button-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-ToggleButton` | always (unless you pass `class`) |
| `[aria-pressed="true"]`, `[data-selected]` | on |
| `[data-pressed]` | held |
| `:disabled`, `[data-disabled]` | disabled |
| `:hover`, `:focus-visible` | CSS states |

### Tailwind

Tailwind's built-in `aria-pressed:` variant targets the on state; `data-[selected]:` is the same.

::example{id=toggle-button-tailwind}

### Plain CSS

::example{id=toggle-button-css}

### Starter theme

`@rivetjs/cdk/theme.css` styles `.rv-ToggleButton` like a Button and fills it while `aria-pressed="true"`.

## Animated selection indicator

A `<SelectionIndicator />` (`@rivetjs/cdk/selection-indicator`) in the children renders while the button is selected. Wrap the buttons in a `<SharedElementTransition>` (`@rivetjs/cdk/shared-element-transition`; RAC ToggleButtonGroup provides one): the indicator then enters, exits, or moves between buttons of the scope (see [Tabs](tabs.md#animated-selection-indicator)).

## Custom markup

`@rivetjs/cdk/toggle-button/behaviour` exports `toggleButtonAttrs(state)` (`type`, `aria-pressed` and `data-selected` bindings, `disabled` from the state's creation-time `disabled`), `toggleButtonPress(state)`, `toggleButtonPressOptions(state, options)`, the handlers `toggleButtonPointerDown(state, options, event)`, `toggleButtonKeyDown`, `toggleButtonClick`, and `isToggleSelected(state)` (untracked read).

`@rivetjs/cdk/state/toggle` (react-stately `useToggleState`):

| Export | |
| --- | --- |
| `createToggleState(options)` | `isSelected` (plain value = controlled, `Signal<boolean>` = two-way, or an accessor `() => boolean`), `defaultSelected`, `onChange`, `isReadOnly`, `isDisabled` (a value, or an accessor that stays live). |
| `state.selected()` | The shown selection; read it in bindings. |
| `state.defaultSelected`, `state.disabled`, `state.readOnly`, `state.isDisabled?` | Value restored on form reset; `isDisabled` at creation; read-only; the live `isDisabled` accessor when one was passed. |
| `setSelected(state, value)` | Set the selection (ignored while read-only); calls `onChange` when the value changes. |
| `toggle(state)` | Flip the selection, unless read-only or disabled. |
| `isToggleSelected(state)` | The current selection, including a write earlier in the same task. |

```tsx
const state = createToggleState({ defaultSelected: false });
<button {...toggleButtonAttrs(state)} onClick={() => toggleButtonPress(state)}>Bold</button>;
```

## Render

`render` replaces the default `<button>` with your own element (React Aria Components `render`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches.

```tsx
<ToggleButton render={(props) => <div {...(props as {})} />}>Bold</ToggleButton>
```

## Accessibility

- A native button with `aria-pressed`: announced as a toggle button, "pressed" or "not pressed".
- Keep the label constant ("Bold"), do not switch it to "Not bold".
- For a setting that takes effect at once (Wi-Fi, dark mode), a [Switch](switch.md) reads as on / off and submits with a form.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter], :kbd[Space] | Toggle. |
| :kbd[Tab] | Move focus. |

## Resumability

- The server renders `aria-pressed` and `data-selected` from the state; nothing runs before the first press.
- `isSelected` is a signal and resumes with its value.

## Upstream

| Rivet | Upstream |
| --- | --- |
| `ToggleButton` | RAC `ToggleButton` |
| `@rivetjs/cdk/toggle-button/behaviour` | react-aria `useToggleButton` |
| `@rivetjs/cdk/state/toggle` | react-stately `useToggleState` |

Deviations: the controlled state is one two-way signal (`isSelected`) instead of a value plus `onChange`; `class` is RAC `className`; render props are accessors.

For single / multiple selection across toggles see [ToggleButtonGroup](toggle-button-group.md).

## Not yet supported

- `onPressUp` and `preventFocusOnPress` props.

## Common mistakes

- **Switching the label with the state.** Screen readers already say "pressed".
- **Reading the signal after `onPress` for the old value.** The toggle runs first; `onPress` and `onChange` see the new state.
- **A toggle for a form setting.** It is not a form field and submits nothing; use a [Checkbox](checkbox.md) or [Switch](switch.md).
