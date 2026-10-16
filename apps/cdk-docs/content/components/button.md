---
title: Button
description: Button from @rivetjs/cdk is a native button with press events for mouse, touch, keyboard and virtual clicks, a pending state and form props.
template: guide
status: experimental
related: [components/toggle-button, components/link, components/form, components/toolbar]
---

`Button` renders a native `<button>`: keyboard activation, focus, the Tab order and form submission are the browser's. On top it adds React Aria's press events (`onPress`, `onPressStart`, `onPressEnd`, `onPressUp`, `onPressChange`) with the pointer type, `data-*` interaction states (`data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`), accessor render props, and a pending state for submits that wait on the server.

::example{id=button-events}

## Anatomy

```html
<button type="button" id="save" class="rv-Button">Save</button>

<!-- isPending (here: pending), a ProgressBar child -->
<button type="button" id="send" class="rv-Button" aria-disabled="true" aria-labelledby="send send-progress" data-pending="true">
  Send
  <div id="send-progress" class="rv-ProgressBar" role="progressbar" aria-label="Sending"></div>
</button>
```

| Attribute | Value |
| --- | --- |
| `type` | the `type` prop, default `"button"`. A pending submit button renders `"button"` so it cannot submit twice. |
| `class` | `rv-Button`, or your `class` (it replaces the default). |
| `disabled`, `data-disabled` | with `isDisabled`. |
| `data-pressed` | while a pointer or key holds the button (written by the press handlers). |
| `data-hovered`, `data-focused`, `data-focus-visible` | hover (mouse / pen) and focus states, written by the handlers. |
| `data-pending`, `aria-disabled` | `"true"` while `isPending` is true. |
| `aria-labelledby` | while pending with an `aria-label` or `aria-labelledby`: the button plus its ProgressBar (`<id>-progress`), so the progress joins the name. |

The button provides `ProgressBarContext` (`{ id: "<id>-progress" }`): a `<ProgressBar>` inside takes that id.

## Import

```ts
import { Button, ButtonContext, type PressEvent } from "@rivetjs/cdk/button";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content or `({ isHovered, isPressed, isFocused, isFocusVisible, isDisabled, isPending }) => content` | none | Render props are accessors: call them. |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | Pass `"submit"` to submit a form. |
| `isDisabled` | `boolean \| () => boolean` | `false` | Native `disabled`: no events, skipped by Tab. |
| `isPending` | `boolean \| () => boolean` (a signal works) | none | Pending: presses ignored, focus kept, a submit button stops submitting, announced while focused. Show a `ProgressBar` from the `isPending` render prop. |
| `preventFocusOnPress` | `boolean` | `false` | A pointer press does not move focus to the button. |
| `excludeFromTabOrder` | `boolean` | `false` | `tabindex="-1"`. |
| `autoFocus` | `boolean` | `false` | |
| `id`, `name`, `value` | `string` | none | `name` / `value` are submitted with the pressed submit button. |
| `form`, `formAction`, `formEncType`, `formMethod`, `formTarget`, `formNoValidate` | `string` / `boolean` | none | Native form attributes: submit a form by id, override its action / encoding / method / target, skip validation. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-details` | `string` (label / labelledby: or an accessor) | none | Name an icon-only button with `aria-label`. |
| `aria-expanded`, `aria-haspopup`, `aria-controls`, `aria-pressed`, `aria-current` | ARIA values or accessors | none | For buttons that drive other UI. |
| `slot` | `string` | none | Picks props from `ButtonContext`. |
| `class`, `style` | value or `(renderProps) => value` | `rv-Button` | Replaces the default class. |
| `ref` | `ref()` | none | The `<button>`. |
| global DOM props | `GlobalDOMAttributes` | none | See [DOM events and attributes](#dom-events-and-attributes). |

### Events

| Event | Fires |
| --- | --- |
| `onPress(e)` | A completed press: pointer released over the button, :kbd[Enter], :kbd[Space], or a virtual click (screen readers, `element.click()`). |
| `onPressStart(e)` | Pointer down, or the activation key down. |
| `onPressEnd(e)` | The press ended, completed or cancelled (pointer released outside). |
| `onPressUp(e)` | Pointer released over the button, whether or not the press started there. |
| `onPressChange(isPressed)` | The pressed state changed. |
| `onClick(e)` | The raw `click` (also fires for presses). Prefer `onPress`. |
| `onHoverStart(e)`, `onHoverEnd(e)`, `onHoverChange(isHovered)` | Mouse / pen hover. |
| `onFocus(e)`, `onBlur(e)`, `onFocusChange(isFocused)` | Focus. |
| `onKeyDown(e)`, `onKeyUp(e)` | Native key events, after the press handling. |

A `PressEvent` has `type`, `pointerType` (`"mouse" | "pen" | "touch" | "keyboard" | "virtual"`), `target`, the modifier keys, `x` / `y` relative to the target, `key` for keyboard presses, and `continuePropagation()`.

## Events

The example above logs every callback. A mouse click fires start, up, end and press with `pointerType: "mouse"`; :kbd[Enter] fires them with `"keyboard"`. Dragging the pointer off the button before releasing ends the press without `onPress`.

## Pending

A pending button keeps focus and stays in the Tab order (unlike `isDisabled`), ignores presses, renders `aria-disabled="true"` and `data-pending`; render a `ProgressBar` from the `isPending` render prop. A pending submit button renders `type="button"`, so neither a click nor :kbd[Enter] in a field submits again. Pass a signal and clear it when the request finishes.

::example{id=button-pending}

## Disabled and focus

`isDisabled` renders a disabled button (no events, not focusable). `excludeFromTabOrder` keeps an enabled button out of the Tab order (toolbars, repeated controls). `preventFocusOnPress` runs the press without moving focus, for buttons that act on the focused field.

::example{id=button-disabled}

## Forms

`type="submit"` and `type="reset"` work as in HTML. A submit button's `name` and `value` are sent with the form data (use `event.submitter`), `formNoValidate` skips constraint validation, and `form` links a button outside the `<form>` by the form's id.

::example{id=button-form}

## DOM events and attributes

`Button` takes the global DOM events and attributes (`GlobalDOMAttributes` from `@rivetjs/cdk/dom-props`: mouse, touch, pointer, scroll, wheel, animation and transition events with their `…Capture` forms, plus `dir`, `lang`, `hidden`, `inert`, `translate`) and forwards them to the `<button>`.

The button handles `onPointerDown`, `onPointerUp`, `onMouseDown`, `onClick` and `onPointerOver` itself (press and hover handling); your handler of the same name runs right after its own (`onClick` is the press option above). Your `onPointerOver` runs before the hover starts (React Aria starts it on `pointerenter`); your `onPointerEnter` / `onPointerLeave` are bound on the element as given (hover runs from the delegated `pointerover`). Focus and key events are the props in the events table.

::example{id=button-dom-events}

`on…Capture` handlers do not resume yet.

## Styling

| Selector | When |
| --- | --- |
| `.rv-Button` | always (unless you pass `class`) |
| `[data-pressed]` | held by a pointer or key |
| `[data-pending]` | pending |
| `:disabled`, `[data-disabled]` | `isDisabled` |
| `[data-hovered]` | mouse / pen over it |
| `[data-focused]`, `[data-focus-visible]` | focused / keyboard focused |
| `.rv-ProgressBar` | a pending ProgressBar inside |

### Tailwind

`class` replaces `rv-Button`; use Tailwind's data variants: `data-[pressed]:`, `data-[pending]:`, `data-[hovered]:`, `data-[focus-visible]:`, plus `disabled:`.

::example{id=button-tailwind}

### Plain CSS

::example{id=button-css}

### Starter theme

`@rivetjs/cdk/theme.css` gives `.rv-Button` a neutral starter look (border, padding, hover, `:disabled`). Import it after Tailwind's base layer, or on its own; every rule is in `:where()`, so your styles win.

## Render

`render` replaces the default `<button>` with your own element (React Aria Components `render`). It receives the part's props, including `ref`, `class`, `data-*` state attributes and handlers, and the render props (`isPressed()`, `isHovered()`, `isDisabled()` and the other accessors). Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<Button render={(props) => <a {...(props as {})} href="/docs" />}>Docs</Button>
```

## Custom markup

`@rivetjs/cdk/button/behaviour` exports `buttonProps(props)` (React Aria `useButton` attributes for a `button`, `a`, `div`, `span` or `input`) and the press handlers `buttonPointerDown`, `buttonPointerUp`, `buttonKeyDown`, `buttonClick`, `buttonMouseDown` and `buttonDragStart`, each taking `(event, pressOptions, isPending?)`. Wire them as inline arrows on your element.

## Accessibility

- A native `<button>`: role, focus and activation come from the browser.
- Name icon-only buttons with `aria-label`.
- Pending: `aria-disabled="true"` keeps the button focusable and announced; the ProgressBar joins the accessible name when the button is named by `aria-label` or `aria-labelledby`.

### Keyboard

| Key | Action |
| --- | --- |
| :kbd[Enter] | Press (fires on key down; native click). |
| :kbd[Space] | Press (fires on key up; native click). |
| :kbd[Tab] | Move focus; disabled and `excludeFromTabOrder` buttons are skipped. |

## Resumability

- The server renders the final `<button>`; no Button code runs before the first interaction. The press handlers load on the first pointer or key event and still see that event.
- Callbacks must be inline arrows or local functions (the browser resumes them by reference). A function from another library is not serializable. `.bind(…)` of your own function resumes inline in the prop or as a local constant, but not written inside an object literal.
- `isPending` as a signal stays live; render-prop children re-render when it flips.
- Press state lives in a per-element `WeakMap`, never serialized. A keyboard press on a native button ends at the native `click` (fired by :kbd[Enter] keydown or :kbd[Space] keyup) instead of a synthetic click on keyup.

## Testing

There is no dedicated tester. Render with `render` from `@rivetjs/runtime/testing`, then drive the button with `@testing-library/user-event` (a dependency of `@rivetjs/testing`) or the Angular CDK style helpers of `@rivetjs/testing/fake-events` (`dispatchPointerEvent`, `dispatchKeyboardEvent`, `dispatchMouseEvent`, `triggerFocus`). `element.click()` is a virtual press (`pointerType: "virtual"`).

```tsx
import { render } from "@rivetjs/runtime/testing";
import { Button } from "@rivetjs/cdk/button";

const presses: string[] = [];
render(() => <Button id="save" onPress={(e) => presses.push(e.pointerType)}>Save</Button>);
document.getElementById("save")!.click();
expect(presses).toEqual(["virtual"]);
```

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Button` | RAC `Button` |
| `@rivetjs/cdk/button/behaviour` | react-aria `useButton` |
| press events | react-aria `usePress` (local port in `button/press.ts`) |

Deviations:

- Render props are accessors (`isPressed()`); `class` = RAC `className`.
- While pending only the press and the owned handlers are disabled; other forwarded DOM events keep firing.
- Keyboard presses on a native button end at the native click (see Resumability).

## Not yet supported

- Nothing from the RAC Button API is missing except the dev warnings of `render` (wrong element type, ref not passed).

## Common mistakes

- **Expecting a submit button.** `Button` defaults to `type="button"`. Pass `type="submit"` in a form.
- **`isDisabled` for a busy state.** A disabled button loses focus and is skipped by screen readers' Tab; use `isPending` while waiting.
- **An icon without a name.** Pass `aria-label`.
- **A button for navigation.** Going to another page is a [Link](link.md).
- **A toggle made of a Button.** Use [ToggleButton](toggle-button.md): it keeps `aria-pressed` in step.
