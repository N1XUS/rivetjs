---
title: DOM props
description: Every @rivetjs/cdk component forwards global DOM events and attributes to its element; part props objects reach inner parts. globalDOMProps for your own.
template: guide
status: experimental
related: [foundations/interactions, components/button, components/select]
---

Every component and part accepts the global DOM events and attributes of React Aria Components (`GlobalDOMAttributes`): mouse, touch, pointer, scroll, wheel, animation and transition events, their `…Capture` forms, and `dir`, `lang`, `hidden`, `inert`, `translate`. A component forwards them to its own element. Components made of several elements take one props object per inner part (`triggerProps`, `listBoxProps`, …), and data-driven items take them on the item objects.

::example{id=dom-props-forward}

```tsx title="src/routes/index.tsx"
import { Button } from "@rivetjs/cdk/button";
import { Select } from "@rivetjs/cdk/select";

<Button lang="en-GB" onPointerEnter={() => prefetch()} onContextMenu={(e) => openMenu(e)}>
  Save
</Button>;

<Select
  label="Size"
  items={sizes}
  onWheel={() => log("root")}
  triggerProps={{ onPointerEnter: () => log("trigger") }}
  listBoxProps={{ dir: "ltr" }}
  popoverProps={{ onAnimationEnd: () => log("shown") }}
/>;
```

## What is forwarded

| Group | Props |
| --- | --- |
| Mouse | `onClick`, `onAuxClick`, `onContextMenu`, `onDblClick`, `onMouseDown`, `onMouseEnter`, `onMouseLeave`, `onMouseMove`, `onMouseOut`, `onMouseOver`, `onMouseUp` |
| Touch | `onTouchCancel`, `onTouchEnd`, `onTouchMove`, `onTouchStart` |
| Pointer | `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onPointerEnter`, `onPointerLeave`, `onPointerOver`, `onPointerOut`, `onGotPointerCapture`, `onLostPointerCapture` |
| Scroll | `onScroll`, `onWheel` |
| Animation, transition | `onAnimationStart`, `onAnimationEnd`, `onAnimationIteration`, `onTransitionCancel`, `onTransitionEnd`, `onTransitionRun`, `onTransitionStart` |
| Capture | every event above with `Capture` (`onPointerDownCapture`) |
| Attributes | `dir`, `lang`, `hidden`, `inert`, `translate` |

Handlers get the native event with a typed `currentTarget` (`GlobalDOMAttributes<HTMLButtonElement>` types `onClick`'s `e.currentTarget` as the button).

Not in this set, as upstream: keyboard and focus events are props of focusable components (`onKeyDown`, `onKeyUp`, `onFocus`, `onBlur`, `onFocusChange`); text input events belong to inputs (below); drag and media events are not forwarded.

## Owned events

Some components handle one of these events themselves (Button's press runs from `onPointerDown`, `onPointerUp`, `onMouseDown`, `onClick`). An owned event is not dropped: the component's handler runs first, then yours, in the same listener. In the hero example, Button's `onClick` logs after `onPress`. A handler of yours cannot cancel the component's behaviour by calling `preventDefault()` first; react to the component's callbacks (`onPress`, `onSelectionChange`, `onOpenChange`) for that.

Owned attributes win: a Tabs panel's `hidden` / `inert` and a FieldError's `hidden` follow the component's state.

## Text input events

Text fields forward `TextInputDOMEvents` to their `<input>` / `<textarea>`: `onInput`, `onBeforeInput`, `onCompositionStart`, `onCompositionUpdate`, `onCompositionEnd`, `onCopy`, `onCut`, `onPaste`, `onSelect` (+ `Capture`). `onInput` is owned (the field updates its value first). Components: TextField, TextArea, ComboBox.

## Part props objects

| Component | Own props land on | Part props | Owned (component handles first) |
| --- | --- | --- | --- |
| [Button](../components/button.md), ToggleButton | `<button>` | | `onPointerDown`, `onPointerUp`, `onMouseDown`, `onClick` (ToggleButton: `onPointerDown`, `onClick`) |
| Link | the link element | | `onClick` |
| [Checkbox](../components/checkbox.md), [Switch](../components/switch.md) | `<label>` | CheckboxGroup items: on the item objects | `onMouseDown` |
| [RadioGroup](../components/radio-group.md) | `role="radiogroup"` element | items: on the item objects (`<label>`) | |
| [TextField, TextArea](../components/text-field.md) | root `<div>` | text input events → `<input>` / `<textarea>` | `onInput` |
| Label, Text, FieldError, Form, Group, Toolbar | their element | | FieldError: `hidden` |
| [Disclosure](../components/disclosure.md) | `<details>` | | |
| Breadcrumbs | `<ol>` | items: on the item objects (`<li>`) | |
| [ListBox](../components/listbox.md) | `role="listbox"` element | options and sections: on the item objects | `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onDblClick`, `onMouseDown`, `onPointerOver` |
| [Tabs](../components/tabs.md) | root `<div>` | `listProps` → tablist; items → tab; `item.panelProps` → panel | tablist: `onPointerDown`, `onClick`; panel: `hidden`, `inert` |
| [MenuTrigger](../components/menu.md) | trigger `<button>` | `menuProps` → `role="menu"`; items → menu item | `onClick` (trigger and menu) |
| [Select](../components/select.md) | root `<div>` | `triggerProps`, `valueProps`, `popoverProps`, `listBoxProps` | trigger: `onPointerDown`, `onMouseDown`, `onClick`; list box: `onPointerDown`, `onPointerUp`, `onPointerCancel`, `onClick`, `onMouseDown`, `onPointerOver` |
| [ComboBox](../components/combobox.md) | root `<div>` | text input events → `<input>`; `listBoxProps` | `onInput`; list box: `onClick`, `onMouseDown`, `hidden` |
| [Popover](../components/popover.md) | popover element | `triggerProps`, `arrowProps` | trigger: `onClick` |
| [Tooltip](../components/tooltip.md) | tooltip element | `arrowProps` | `onPointerEnter`, `onPointerLeave` |
| [DialogTrigger](../components/dialog.md) | modal element | `triggerProps` | trigger: `onClick` |
| Dialog | `<section>` | | |
| ModalOverlay | modal element | `overlayProps` → underlay | underlay: `onPointerDown` |
| Calendar, RangeCalendar | root `<div>` | `headingProps`, `gridProps` → `<table>`, `cellProps` | grid: `onMouseDown`, `onPointerDown`, `onPointerUp`, `onPointerOver`, `onPointerOut`, `onClick`, `onContextMenu` |
| DateField, TimeField | root `<div>` | `inputProps` → DateInput, `segmentProps` → each segment | DateInput: `onPointerDown`, `onPointerUp` |
| [DatePicker](../components/date-picker.md), DateRangePicker | root `<div>` | `groupProps`, `buttonProps`, `popoverProps`, `dialogProps`, plus the date input parts | group: `onPointerDown`, `onPointerUp`; button: `onClick` |
| Virtualizer, scroll viewports | scroll element | | `onScroll` (Virtualizer also `dir`; viewport also `onWheel`, `onPointerDown`) |

The component pages list the exact elements under their "DOM events and attributes" sections.

## In your own components

`@rivetjs/cdk/dom-props` exports the types and the filters the components use.

| Export | Does |
| --- | --- |
| `GlobalDOMAttributes<E>` | Props interface: the events (typed with `currentTarget: E`) and the five attributes. |
| `GlobalDOMEvents<E>` | The events only. |
| `globalDOMProps(props, owned?)` | The global events and attributes set on `props`, minus the `owned` names. Spread the result on your element. |
| `TextInputDOMEvents<E>` | Text input events of an `<input>` / `<textarea>` (default `E`: `HTMLInputElement`). |
| `textInputDOMProps(props, owned = ["onInput"])` | The text input events set on `props`, minus `owned`. |

Call the filters once in the component body, not inside JSX: a spread over `props` itself would put the whole props object on the element, children included. Name the events you handle in `owned` and call the caller's handler from yours.

::example{id=dom-props-custom}

## Resumability

- Forwarded handlers can be any function, handlers on item objects too.
- Handlers of an element resume on its first event, owned ones chained inside the component's own handler.
- Known limitation: `on…Capture` handlers do not resume yet.

## Upstream

`GlobalDOMAttributes` / `GlobalDOMEvents` from `@react-types/shared` and `filterDOMProps(props, { global: true })` from `@react-aria/utils`; `TextInputDOMEvents` from React Aria's `TextInputDOMProps`. React Aria Components forwards the same set to the same elements; Rivet chains owned events inside the component instead of `mergeProps`.
